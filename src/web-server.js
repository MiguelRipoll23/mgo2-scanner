'use strict';
// HTTP server on port 8080:
//   GET /           → serves public/index.html
//   GET /app.js     → serves public/app.js
//   GET /jsimgui/*  → serves node_modules/@mori2003/jsimgui/build/*
//   WebSocket /ws   → live packet stream + spoof rule management

const http = require('http');
const path = require('path');
const fs   = require('fs');
const { WebSocketServer } = require('ws');
const state = require('./state.js');

const WEB_PORT   = 8080;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IMGUI_DIR  = path.join(__dirname, '..', 'node_modules', '@mori2003', 'jsimgui', 'build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.css':  'text/css; charset=utf-8',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

function startWebServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];

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
        trySend(ws, { type: 'packet', ...serializePkt(pkt) });
      }
      // Send current spoof rules
      trySend(ws, { type: 'spoofRules', rules: state.getSpoofRules().map(serializeRule) });
      trySend(ws, { type: 'spoofingState', enabled: state.isSpoofingEnabled() });
      trySend(ws, { type: 'excludedRules', rules: state.getExcludedRules().map(serializeExcludedRule) });
      trySend(ws, { type: 'keepUpstreamState', enabled: state.isKeepUpstreamOpen() });
      trySend(ws, { type: 'tcpStatuses', statuses: state.getTcpStatuses() });

      // Stream new packets
      const onPacket = pkt => trySend(ws, { type: 'packet', ...serializePkt(pkt) });
      const onRules  = ()  => trySend(ws, { type: 'spoofRules', rules: state.getSpoofRules().map(serializeRule) });
      const onSpoofing = enabled => trySend(ws, { type: 'spoofingState', enabled });
      const onExcluded = () => trySend(ws, { type: 'excludedRules', rules: state.getExcludedRules().map(serializeExcludedRule) });
      const onKeepUpstream = enabled => trySend(ws, { type: 'keepUpstreamState', enabled });
      const onTcpStatuses = () => trySend(ws, { type: 'tcpStatuses', statuses: state.getTcpStatuses() });

      state.emitter.on('packet',       onPacket);
      state.emitter.on('rulesChanged', onRules);
      state.emitter.on('spoofingChanged', onSpoofing);
      state.emitter.on('excludedChanged', onExcluded);
      state.emitter.on('keepUpstreamChanged', onKeepUpstream);
      state.emitter.on('tcpStatusChanged', onTcpStatuses);

      ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'setSpoofRule') {
          const { cmd, isInbound, payloadHex } = msg;
          if (typeof cmd === 'number' && typeof isInbound === 'boolean' && typeof payloadHex === 'string') {
            state.setSpoofRule(cmd, isInbound, payloadHex);
          }
        } else if (msg.type === 'deleteSpoofRule') {
          const { cmd, isInbound } = msg;
          if (typeof cmd === 'number' && typeof isInbound === 'boolean') {
            state.deleteSpoofRule(cmd, isInbound);
          }
        } else if (msg.type === 'setSpoofingEnabled') {
          state.setSpoofingEnabled(msg.enabled);
        } else if (msg.type === 'setExcludedRule') {
          const { cmd, isInbound, enabled } = msg;
          if (typeof cmd === 'number' && typeof isInbound === 'boolean') {
            state.setExcludedRule(cmd, isInbound, enabled);
          }
        } else if (msg.type === 'setKeepUpstreamOpen') {
          state.setKeepUpstreamOpen(msg.enabled);
        }
      });

      ws.on('close', () => {
        state.emitter.off('packet',       onPacket);
        state.emitter.off('rulesChanged', onRules);
        state.emitter.off('spoofingChanged', onSpoofing);
        state.emitter.off('excludedChanged', onExcluded);
        state.emitter.off('keepUpstreamChanged', onKeepUpstream);
        state.emitter.off('tcpStatusChanged', onTcpStatuses);
      });
    });

    server.listen(WEB_PORT, '127.0.0.1', () => {
      console.log(`[WEB] UI available at http://127.0.0.1:${WEB_PORT}`);
      resolve(server);
    });
  });
}

function trySend(ws, obj) {
  if (ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch {}
  }
}

function serializePkt(pkt) {
  return {
    cmd:           pkt.cmd,
    payloadLen:    pkt.payloadLen,
    payload:       pkt.payload.toString('hex'),
    spoofedPayload: pkt.spoofedPayload ? pkt.spoofedPayload.toString('hex') : null,
    packet:        pkt.packet ? pkt.packet.toString('hex') : null,
    isInbound:     pkt.isInbound,
    timestamp:     pkt.timestamp,
  };
}

function serializeRule(r) {
  return { cmd: r.cmd, isInbound: r.isInbound, payloadHex: r.payloadHex };
}

function serializeExcludedRule(r) {
  return { cmd: r.cmd, isInbound: r.isInbound };
}

module.exports = startWebServer;
