'use strict';
const fs     = require('fs');
const path   = require('path');
const { EventEmitter } = require('events');

const RULES_PATH  = path.join(__dirname, '..', 'spoof-rules.json');
const MAX_PACKETS = 2000;

const emitter = new EventEmitter();
emitter.setMaxListeners(64);

// ─── Packet ring buffer ───────────────────────────────────────────────────────
const _packets = [];
const _excluded = new Map();
const _tcpStatuses = new Map();
let _keepUpstreamOpen = false;

function addPacket(pkt) {
  if (_excluded.has(_key(pkt.cmd, pkt.isInbound))) return;
  _packets.push(pkt);
  if (_packets.length > MAX_PACKETS) _packets.shift();
  emitter.emit('packet', pkt);
}

function getPackets() { return _packets; }

// ─── Spoof rules ──────────────────────────────────────────────────────────────
const _rules = new Map();
let _spoofingEnabled = false;

function _key(cmd, isInbound) { return `${isInbound ? 'in' : 'out'}:${cmd}`; }

function getSpoofRule(cmd, isInbound) {
  return _rules.get(_key(cmd, isInbound)) || null;
}

function getSpoofRules() { return Array.from(_rules.values()); }
function getExcludedRule(cmd, isInbound) {
  return _excluded.get(_key(cmd, isInbound)) || null;
}
function getExcludedRules() { return Array.from(_excluded.values()); }
function isSpoofingEnabled() { return _spoofingEnabled; }
function isKeepUpstreamOpen() { return _keepUpstreamOpen; }
function setSpoofingEnabled(enabled) {
  _spoofingEnabled = !!enabled;
  emitter.emit('spoofingChanged', _spoofingEnabled);
}
function setKeepUpstreamOpen(enabled) {
  _keepUpstreamOpen = !!enabled;
  emitter.emit('keepUpstreamChanged', _keepUpstreamOpen);
}
function setExcludedRule(cmd, isInbound, enabled) {
  const key = _key(cmd, isInbound);
  if (enabled) _excluded.set(key, { cmd, isInbound });
  else _excluded.delete(key);
  emitter.emit('excludedChanged');
}
function setTcpStatus(port, status) {
  _tcpStatuses.set(port, { port, ...status });
  emitter.emit('tcpStatusChanged');
}
function getTcpStatuses() {
  return Array.from(_tcpStatuses.values()).sort((a, b) => a.port - b.port);
}

function setSpoofRule(cmd, isInbound, payloadHex) {
  _rules.set(_key(cmd, isInbound), { cmd, isInbound, payloadHex });
  saveSpoofRules();
  emitter.emit('rulesChanged');
}

function deleteSpoofRule(cmd, isInbound) {
  _rules.delete(_key(cmd, isInbound));
  saveSpoofRules();
  emitter.emit('rulesChanged');
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function saveSpoofRules() {
  try {
    const arr = Array.from(_rules.values()).map(r => ({
      cmd: r.cmd, isInbound: r.isInbound, payloadHex: r.payloadHex,
    }));
    fs.writeFileSync(RULES_PATH, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.error('[state] Failed to save spoof rules:', e.message);
  }
}

function loadSpoofRules() {
  try {
    if (!fs.existsSync(RULES_PATH)) return;
    const arr = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    for (const r of arr) {
      if (typeof r.cmd === 'number' && typeof r.isInbound === 'boolean' && typeof r.payloadHex === 'string') {
        _rules.set(_key(r.cmd, r.isInbound), r);
      }
    }
    console.log(`[state] Loaded ${_rules.size} spoof rule(s) from disk`);
  } catch (e) {
    console.error('[state] Failed to load spoof rules:', e.message);
  }
}

loadSpoofRules();

module.exports = {
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
  setExcludedRule,
  setTcpStatus,
  getTcpStatuses,
  setSpoofRule,
  deleteSpoofRule,
};
