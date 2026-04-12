import { state } from '../state.js';
import type { Packet, SpoofRule, ExcludedRule } from '../types/index.js';
import { compactToBytes, bytesToCompact } from './hex.js';

// ─── Selectors ────────────────────────────────────────────────────────────────
export function getSelectedPacket(): Packet | null {
  return state.selectedIdx >= 0 ? (state.packets[state.selectedIdx] ?? null) : null;
}

export function getSelectedRule(): SpoofRule | null {
  const pkt = getSelectedPacket();
  if (!pkt) return null;
  return state.spoofRules.find(r => r.cmd === pkt.cmd && r.isInbound === pkt.isInbound) ?? null;
}

export function getSelectedExcludedRule(): ExcludedRule | null {
  const pkt = getSelectedPacket();
  if (!pkt) return null;
  return state.excludedRules.find(r => r.cmd === pkt.cmd && r.isInbound === pkt.isInbound) ?? null;
}

export function getVisiblePayloadHex(pkt: Packet): string {
  return pkt.spoofedPayload ?? pkt.payload ?? '';
}

// ─── Detail view helpers ──────────────────────────────────────────────────────
export function isByteModified(byteOffset: number): boolean {
  const start = byteOffset * 2;
  return state.detail.compact.slice(start, start + 2) !== state.detail.original.slice(start, start + 2);
}

export function isRangeModified(byteLen: number): boolean {
  const start = state.detail.cursorByte * 2;
  const end   = start + byteLen * 2;
  return state.detail.compact.slice(start, end) !== state.detail.original.slice(start, end);
}

export function replaceBytesAtCursor(nextBytes: Uint8Array): boolean {
  const full = compactToBytes(state.detail.compact);
  const off  = state.detail.cursorByte;
  if (off + nextBytes.length > full.length) return false;
  let changed = false;
  for (let i = 0; i < nextBytes.length; i++) {
    if (full[off + i] !== nextBytes[i]) { changed = true; break; }
  }
  if (!changed) return false;
  full.set(nextBytes, off);
  state.detail.compact = bytesToCompact(full);
  return true;
}

// ─── Selection ────────────────────────────────────────────────────────────────
export function requestPacketSelection(idx: number): void {
  if (idx === state.selectedIdx && !state.editingRule) return;
  state.selectedIdx = idx;
  loadSelectedDetailFromPacket();
}

export function loadSelectedDetailFromPacket(preserveSearch = false): void {
  state.editingRule = null;
  const pkt = getSelectedPacket();
  if (!pkt) return;
  const visiblePayload = getVisiblePayloadHex(pkt);
  state.detail.lastIdx    = state.selectedIdx;
  state.detail.compact    = visiblePayload;
  state.detail.original   = visiblePayload;
  state.detail.packet     = pkt.packet ?? '';
  state.detail.cursorByte = 0;
  state.inspectorEd.key        = '';
  state.inspectorEd.cursorKey  = '';
  if (!preserveSearch) {
    state.searchState.results            = [];
    state.searchState.index              = -1;
    state.searchState.selectedPacketKey  = packetSearchKey();
  }
}

export function packetSearchKey(): string {
  const pkt = getSelectedPacket();
  return pkt ? `${state.selectedIdx}:${pkt.cmd}:${state.detail.compact.length}` : '';
}

// ─── Rule editing ─────────────────────────────────────────────────────────────
export function startEditingRule(rule: SpoofRule): void {
  state.editingRule = { cmd: rule.cmd, isInbound: rule.isInbound, payloadHex: rule.payloadHex };
  state.selectedIdx = -1;
  state.detail.compact    = rule.payloadHex;
  state.detail.original   = rule.payloadHex;
  state.detail.packet     = '';
  state.detail.lastIdx    = -3; // sentinel for rule-edit mode
  state.detail.cursorByte = 0;
  state.inspectorEd.key        = '';
  state.inspectorEd.cursorKey  = '';
  state.searchState.results = [];
  state.searchState.index   = -1;
}

// ─── Spoof sync ───────────────────────────────────────────────────────────────
export function queueSpoofSync(): void {
  if (state.editingRule) {
    state.pendingSave = {
      cmd: state.editingRule.cmd,
      isInbound: state.editingRule.isInbound,
      payloadHex: state.detail.compact,
    };
    return;
  }
  const pkt = getSelectedPacket();
  if (!pkt) return;
  state.pendingSave = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: state.detail.compact };

  // Auto-create rule and switch to rule-editing view on first edit
  if (!getSelectedRule()) {
    const newRule = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: state.detail.compact };
    if (!state.spoofRules.find(r => r.cmd === newRule.cmd && r.isInbound === newRule.isInbound))
      state.spoofRules.push(newRule);
    state.editingRule   = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: state.detail.compact };
    state.selectedIdx   = -1;
    state.detail.lastIdx = -3;
    state.detail.packet  = '';
    state.searchState.results = [];
    state.searchState.index   = -1;
  }
}

export function currentPlainPacketCompact(): string {
  const pkt = getSelectedPacket();
  if (!pkt) return '';
  const packetCompact = state.detail.packet || pkt.packet || '';
  if (!packetCompact || packetCompact.length < 48) return packetCompact;
  return packetCompact.slice(0, 48) + state.detail.compact;
}

export function restoreCurrentPayload(): void {
  state.detail.compact = state.detail.original;
  state.inspectorEd.key        = '';
  state.inspectorEd.cursorKey  = '';
  queueSpoofSync();
}
