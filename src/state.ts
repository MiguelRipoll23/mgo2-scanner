import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Packet {
  cmd: number;
  payloadLen: number;
  payload: Buffer;
  spoofedPayload: Buffer | null;
  packet: Buffer;
  isInbound: boolean;
  timestamp: number;
}

export interface SpoofRule {
  cmd: number;
  isInbound: boolean;
  payloadHex: string;
}

export interface ExcludedRule {
  cmd: number;
  isInbound: boolean;
}

export interface TcpStatus {
  port: number;
  connected: boolean;
  attachedClient: boolean;
}

const RULES_PATH = path.join(__dirname, '..', 'test-rules.json');
const MAX_PACKETS = 2000;

const emitter = new EventEmitter();
emitter.setMaxListeners(64);

// ─── Packet ring buffer ───────────────────────────────────────────────────────
const _packets: Packet[] = [];
const _excluded = new Map<string, ExcludedRule>();
const _tcpStatuses = new Map<number, TcpStatus>();
let _keepUpstreamOpen = false;

// ─── Spoof rules ──────────────────────────────────────────────────────────────
const _rules = new Map<string, SpoofRule>();
let _spoofingEnabled = false;

function _key(cmd: number, isInbound: boolean): string {
  return `${isInbound ? 'in' : 'out'}:${cmd}`;
}

function addPacket(pkt: Packet): void {
  if (_excluded.has(_key(pkt.cmd, pkt.isInbound))) return;
  _packets.push(pkt);
  if (_packets.length > MAX_PACKETS) _packets.shift();
  emitter.emit('packet', pkt);
}

function getPackets(): Packet[] { return _packets; }

function getSpoofRule(cmd: number, isInbound: boolean): SpoofRule | null {
  return _rules.get(_key(cmd, isInbound)) ?? null;
}

function getSpoofRules(): SpoofRule[] { return Array.from(_rules.values()); }

function getExcludedRule(cmd: number, isInbound: boolean): ExcludedRule | null {
  return _excluded.get(_key(cmd, isInbound)) ?? null;
}

function getExcludedRules(): ExcludedRule[] { return Array.from(_excluded.values()); }

function isSpoofingEnabled(): boolean { return _spoofingEnabled; }

function isKeepUpstreamOpen(): boolean { return _keepUpstreamOpen; }

function setSpoofingEnabled(enabled: boolean): void {
  _spoofingEnabled = !!enabled;
  emitter.emit('spoofingChanged', _spoofingEnabled);
}

function setKeepUpstreamOpen(enabled: boolean): void {
  _keepUpstreamOpen = !!enabled;
  emitter.emit('keepUpstreamChanged', _keepUpstreamOpen);
}

function forceCloseUpstream(): void {
  emitter.emit('forceCloseUpstream');
}

function setExcludedRule(cmd: number, isInbound: boolean, enabled: boolean): void {
  const key = _key(cmd, isInbound);
  if (enabled) _excluded.set(key, { cmd, isInbound });
  else _excluded.delete(key);
  emitter.emit('excludedChanged');
}

function setTcpStatus(port: number, status: Omit<TcpStatus, 'port'>): void {
  _tcpStatuses.set(port, { port, ...status });
  emitter.emit('tcpStatusChanged');
}

function getTcpStatuses(): TcpStatus[] {
  return Array.from(_tcpStatuses.values()).sort((a, b) => a.port - b.port);
}

function setSpoofRule(cmd: number, isInbound: boolean, payloadHex: string): void {
  _rules.set(_key(cmd, isInbound), { cmd, isInbound, payloadHex });
  saveSpoofRules();
  emitter.emit('rulesChanged');
}

function deleteSpoofRule(cmd: number, isInbound: boolean): void {
  _rules.delete(_key(cmd, isInbound));
  saveSpoofRules();
  emitter.emit('rulesChanged');
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function saveSpoofRules(): void {
  try {
    const arr = Array.from(_rules.values()).map(r => ({
      cmd: r.cmd, isInbound: r.isInbound, payloadHex: r.payloadHex,
    }));
    fs.writeFileSync(RULES_PATH, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.error('[state] Failed to save spoof rules:', (e as Error).message);
  }
}

function loadSpoofRules(): void {
  try {
    if (!fs.existsSync(RULES_PATH)) return;
    const arr = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8')) as unknown[];
    for (const r of arr) {
      if (
        typeof r === 'object' && r !== null &&
        'cmd' in r && typeof (r as Record<string, unknown>).cmd === 'number' &&
        'isInbound' in r && typeof (r as Record<string, unknown>).isInbound === 'boolean' &&
        'payloadHex' in r && typeof (r as Record<string, unknown>).payloadHex === 'string'
      ) {
        const rule = r as SpoofRule;
        _rules.set(_key(rule.cmd, rule.isInbound), rule);
      }
    }
    console.log(`[state] Loaded ${_rules.size} spoof rule(s) from disk`);
  } catch (e) {
    console.error('[state] Failed to load spoof rules:', (e as Error).message);
  }
}

loadSpoofRules();

const state = {
  emitter,
  addPacket,
  getPackets,
  getSpoofRule,
  getSpoofRules,
  getExcludedRule,
  getExcludedRules,
  isSpoofingEnabled,
  isKeepUpstreamOpen,
  setSpoofingEnabled,
  setKeepUpstreamOpen,
  forceCloseUpstream,
  setExcludedRule,
  setTcpStatus,
  getTcpStatuses,
  setSpoofRule,
  deleteSpoofRule,
};

export default state;
