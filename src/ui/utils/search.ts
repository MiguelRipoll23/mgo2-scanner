import { state } from '../state.js';
import type { SearchResult } from '../types/index.js';
import { compactToBytes, parseHexInput } from './hex.js';
import { getSelectedPacket, getVisiblePayloadHex, loadSelectedDetailFromPacket, packetSearchKey } from './packet.js';

export function buildSearchNeedle(type: string, value: string): Uint8Array | null {
  try {
    if (type === 'string') {
      const bytes = new TextEncoder().encode(value);
      return bytes.length ? bytes : null;
    }
    if (type === 'hex') {
      const compact = parseHexInput(value);
      if (!compact || compact.length % 2 !== 0) return null;
      return compactToBytes(compact);
    }
    if (type === 'uint8') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 0xff) return null;
      return Uint8Array.of(num);
    }
    if (type === 'uint16') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 0xffff) return null;
      const out = new Uint8Array(2);
      new DataView(out.buffer).setUint16(0, num, false);
      return out;
    }
    if (type === 'uint32') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 0xffffffff) return null;
      const out = new Uint8Array(4);
      new DataView(out.buffer).setUint32(0, num >>> 0, false);
      return out;
    }
  } catch {
    // fall through
  }
  return null;
}

export function runSearch(): void {
  const needle = buildSearchNeedle(state.searchState.type, state.searchState.value);
  state.searchState.results            = [];
  state.searchState.index              = -1;
  state.searchState.selectedPacketKey  = packetSearchKey();
  if (!needle || needle.length === 0) return;

  for (let packetIdx = 0; packetIdx < state.packets.length; packetIdx++) {
    const pkt = state.packets[packetIdx];
    if (state.searchState.direction === 'in'  && !pkt.isInbound) continue;
    if (state.searchState.direction === 'out' &&  pkt.isInbound) continue;

    const payloadHex = getVisiblePayloadHex(pkt);
    const haystack   = payloadHex ? compactToBytes(payloadHex) : null;
    if (!haystack || needle.length > haystack.length) continue;

    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let match = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) { match = false; break; }
      }
      if (match) {
        state.searchState.results.push({ packetIdx, start: i, len: needle.length } as SearchResult);
      }
    }
  }

  if (state.searchState.results.length > 0) {
    state.searchState.index = 0;
    const first = state.searchState.results[0];
    state.selectedIdx = first.packetIdx;
    loadSelectedDetailFromPacket(true);
    state.detail.cursorByte = first.start;
  }
}

export function currentSearchMatch(): SearchResult | null {
  const { index, results } = state.searchState;
  if (index < 0 || index >= results.length) return null;
  return results[index];
}

export function searchMove(delta: number): void {
  if (state.searchState.results.length === 0) return;
  state.searchState.index =
    (state.searchState.index + delta + state.searchState.results.length) %
    state.searchState.results.length;
  const match = state.searchState.results[state.searchState.index];
  if (state.selectedIdx !== match.packetIdx) {
    state.selectedIdx = match.packetIdx;
    loadSelectedDetailFromPacket(true);
  }
  state.detail.cursorByte = match.start;
}

export function isSearchHighlighted(byteOffset: number): boolean {
  const match = currentSearchMatch();
  return (
    !!match &&
    match.packetIdx === state.selectedIdx &&
    byteOffset >= match.start &&
    byteOffset < match.start + match.len
  );
}
