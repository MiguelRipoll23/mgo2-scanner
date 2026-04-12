import { BPR } from '../constants.js';

export function fmtHexSpaced(h: string): string {
  if (!h) return '';
  return h.replace(/../g, m => m.toUpperCase() + ' ').trimEnd();
}

export function parseHexInput(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase();
}

export function toHexLines(compact: string): string {
  if (!compact) return '';
  const rows: string[] = [];
  for (let i = 0; i < compact.length; i += BPR * 2)
    rows.push(fmtHexSpaced(compact.slice(i, i + BPR * 2)));
  return rows.join('\n');
}

export function toAsciiLines(compact: string): string {
  if (!compact) return '';
  const rows: string[] = [];
  for (let i = 0; i < compact.length; i += BPR * 2) {
    let row = '';
    for (let j = i; j < Math.min(i + BPR * 2, compact.length); j += 2) {
      const b = parseInt(compact.slice(j, j + 2), 16);
      row += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

// '.' = keep original byte; anything else = use char code
export function applyAsciiToHex(newAscii: string, prevCompact: string): string {
  const str = newAscii.replace(/\n/g, '');
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '.') {
      const orig = prevCompact.slice(i * 2, i * 2 + 2);
      hex += orig.length === 2 ? orig : '00';
    } else {
      hex += ch.charCodeAt(0).toString(16).padStart(2, '0');
    }
  }
  return hex;
}

export function compactToBytes(compact: string): Uint8Array {
  const out = new Uint8Array(compact.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToCompact(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function clampCursor(next: number, nBytes: number): number {
  return Math.max(0, Math.min(nBytes - 1, next));
}
