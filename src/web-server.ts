// HTTP server on port 8080:
//   GET /           → serves public/index.html
//   GET /app.js     → serves public/app.js
//   GET /jsimgui/*  → serves node_modules/@mori2003/jsimgui/build/*
//   WebSocket /ws   → live packet stream + spoof rule management

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import state from './state.js';
import type { Packet, SpoofRule, ExcludedRule, TcpStatus } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WEB_PORT   = 8080;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IMGUI_DIR  = path.join(__dirname, '..', 'node_modules', '@mori2003', 'jsimgui', 'build');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.css':  'text/css; charset=utf-8',
};

function serveFile(res: http.ServerResponse, filePath: string): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

// ─── WebSocket message types ──────────────────────────────────────────────────

interface SerializedPacket {
  type: 'packet';
  cmd: number;
  payloadLen: number;
  payload: string;
  spoofedPayload: string | null;
  packet: string | null;
  isInbound: boolean;
  timestamp: number;
}

type ServerMessage =
  | SerializedPacket
  | { type: 'spoofRules';       rules: SpoofRule[] }
  | { type: 'spoofingState';    enabled: boolean }
  | { type: 'excludedRules';    rules: ExcludedRule[] }
  | { type: 'keepUpstreamState'; enabled: boolean }
  | { type: 'tcpStatuses';      statuses: TcpStatus[] };

function trySend(ws: WebSocket, obj: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
  }
}

function serializePkt(pkt: Packet): SerializedPacket {
  return {
    type:           'packet',
    cmd:            pkt.cmd,
    payloadLen:     pkt.payloadLen,
    payload:        pkt.payload.toString('hex'),
    spoofedPayload: pkt.spoofedPayload ? pkt.spoofedPayload.toString('hex') : null,
    packet:         pkt.packet ? pkt.packet.toString('hex') : null,
    isInbound:      pkt.isInbound,
    timestamp:      pkt.timestamp,
  };
}

function serializeRule(r: SpoofRule): SpoofRule {
  return { cmd: r.cmd, isInbound: r.isInbound, payloadHex: r.payloadHex };
}

function serializeExcludedRule(r: ExcludedRule): ExcludedRule {
  return { cmd: r.cmd, isInbound: r.isInbound };
}

function startWebServer(): Promise<http.Server> {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = (req.url ?? '/').split('?')[0];

      if (url === '/' || url === '/index.html') {
        return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
      }
      if (url === '/app.js') {
        return serveFile(res, path.join(PUBLIC_DIR, 'app.js'));
      }
      if (url.startsWith('/jsimgui/')) {
        const name = path.basename(url);
        return serveFile(res, path.join(IMGUI_DIR, name));
      }

      res.writeHead(404);
      res.end('Not found');
    });

    // ─── WebSocket ────────────────────────────────────────────────────────────
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', ws => {
      // Send all existing packets on connect
      const pkts = state.getPackets();
      for (const pkt of pkts) {
        trySend(ws, serializePkt(pkt));
      }
      // Send current state
      trySend(ws, { type: 'spoofRules',       rules: state.getSpoofRules().map(serializeRule) });
      trySend(ws, { type: 'spoofingState',    enabled: state.isSpoofingEnabled() });
      trySend(ws, { type: 'excludedRules',    rules: state.getExcludedRules().map(serializeExcludedRule) });
      trySend(ws, { type: 'keepUpstreamState', enabled: state.isKeepUpstreamOpen() });
      trySend(ws, { type: 'tcpStatuses',      statuses: state.getTcpStatuses() });

      // Stream new packets
      const onPacket      = (pkt: Packet)  => trySend(ws, serializePkt(pkt));
      const onRules       = ()             => trySend(ws, { type: 'spoofRules',       rules: state.getSpoofRules().map(serializeRule) });
      const onSpoofing    = (en: boolean)  => trySend(ws, { type: 'spoofingState',    enabled: en });
      const onExcluded    = ()             => trySend(ws, { type: 'excludedRules',    rules: state.getExcludedRules().map(serializeExcludedRule) });
      const onKeepUpstream = (en: boolean) => trySend(ws, { type: 'keepUpstreamState', enabled: en });
      const onTcpStatuses = ()             => trySend(ws, { type: 'tcpStatuses',      statuses: state.getTcpStatuses() });

      state.emitter.on('packet',             onPacket);
      state.emitter.on('rulesChanged',       onRules);
      state.emitter.on('spoofingChanged',    onSpoofing);
      state.emitter.on('excludedChanged',    onExcluded);
      state.emitter.on('keepUpstreamChanged', onKeepUpstream);
      state.emitter.on('tcpStatusChanged',   onTcpStatuses);

      ws.on('message', (raw: RawData) => {
        let msg: unknown;
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        if (typeof msg !== 'object' || msg === null) return;
        const m = msg as Record<string, unknown>;

        if (m.type === 'setSpoofRule') {
          const { cmd, isInbound, payloadHex } = m;
          if (typeof cmd === 'number' && typeof isInbound === 'boolean' && typeof payloadHex === 'string') {
            state.setSpoofRule(cmd, isInbound, payloadHex);
          }
        } else if (m.type === 'deleteSpoofRule') {
          const { cmd, isInbound } = m;
          if (typeof cmd === 'number' && typeof isInbound === 'boolean') {
            state.deleteSpoofRule(cmd, isInbound);
          }
        } else if (m.type === 'setSpoofingEnabled') {
          if (typeof m.enabled === 'boolean') state.setSpoofingEnabled(m.enabled);
        } else if (m.type === 'setExcludedRule') {
          const { cmd, isInbound, enabled } = m;
          if (typeof cmd === 'number' && typeof isInbound === 'boolean' && typeof enabled === 'boolean') {
            state.setExcludedRule(cmd, isInbound, enabled);
          }
        } else if (m.type === 'setKeepUpstreamOpen') {
          if (typeof m.enabled === 'boolean') state.setKeepUpstreamOpen(m.enabled);
        }
      });

      ws.on('close', () => {
        state.emitter.off('packet',             onPacket);
        state.emitter.off('rulesChanged',       onRules);
        state.emitter.off('spoofingChanged',    onSpoofing);
        state.emitter.off('excludedChanged',    onExcluded);
        state.emitter.off('keepUpstreamChanged', onKeepUpstream);
        state.emitter.off('tcpStatusChanged',   onTcpStatuses);
      });
    });

    server.listen(WEB_PORT, '0.0.0.0', () => {
      console.log(`[WEB] UI available at http://0.0.0.0:${WEB_PORT}`);
      resolve(server);
    });
  });
}

export default startWebServer;
