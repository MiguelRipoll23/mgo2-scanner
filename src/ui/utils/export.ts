import { state } from '../state.js';
import { CMD_NAMES, cmdHex } from '../constants.js';
import { compactToBytes } from './hex.js';
import { getSelectedPacket, currentPlainPacketCompact } from './packet.js';
import { ImGui } from '/jsimgui/mod.js';

// ─── CAB archive builder (uncompressed, CFHEADER format) ─────────────────────
// Generates a minimal but structurally valid Cabinet (.cab) file containing
// one or more uncompressed files.
export function buildCab(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const HEADER_SZ = 36;
  const FOLDER_SZ = 8;
  const MAX_BLOCK = 32768;
  const enc       = new TextEncoder();

  let totalBytes = 0;
  for (const f of files) totalBytes += f.data.length;
  const allData = new Uint8Array(totalBytes);
  let wpos = 0;
  for (const f of files) { allData.set(f.data, wpos); wpos += f.data.length; }

  const dataBlocks: Uint8Array[] = [];
  for (let i = 0; i < allData.length; i += MAX_BLOCK)
    dataBlocks.push(allData.slice(i, Math.min(i + MAX_BLOCK, allData.length)));
  if (dataBlocks.length === 0) dataBlocks.push(new Uint8Array(0));

  const now     = new Date();
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9)
                | (((now.getMonth() + 1)        & 0x0f) << 5)
                |  (now.getDate()               & 0x1f);
  const dosTime = ((now.getHours()              & 0x1f) << 11)
                | ((now.getMinutes()             & 0x3f) << 5)
                |  (Math.floor(now.getSeconds() / 2)    & 0x1f);

  const cffileEntries: Uint8Array[] = [];
  let uoff = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const entry = new Uint8Array(16 + nameBytes.length + 1);
    const dv    = new DataView(entry.buffer);
    dv.setUint32( 0, f.data.length, true);
    dv.setUint32( 4, uoff,          true);
    dv.setUint16( 8, 0,             true);
    dv.setUint16(10, dosDate,       true);
    dv.setUint16(12, dosTime,       true);
    dv.setUint16(14, 0x20,          true);
    entry.set(nameBytes, 16);
    cffileEntries.push(entry);
    uoff += f.data.length;
  }

  const cfDataEntries = dataBlocks.map(block => {
    const entry = new Uint8Array(8 + block.length);
    const dv    = new DataView(entry.buffer);
    dv.setUint32(0, 0,            true);
    dv.setUint16(4, block.length, true);
    dv.setUint16(6, block.length, true);
    entry.set(block, 8);
    return entry;
  });

  const cffileSize     = cffileEntries.reduce((s, e) => s + e.length, 0);
  const cfdataSize     = cfDataEntries.reduce((s, e) => s + e.length, 0);
  const coffFirstFile  = HEADER_SZ + FOLDER_SZ;
  const coffFolderData = coffFirstFile + cffileSize;
  const totalSize      = HEADER_SZ + FOLDER_SZ + cffileSize + cfdataSize;

  const cab = new Uint8Array(totalSize);
  const hdv = new DataView(cab.buffer);

  cab[0] = 0x4d; cab[1] = 0x53; cab[2] = 0x43; cab[3] = 0x46; // "MSCF"
  hdv.setUint32( 4, 0,               true);
  hdv.setUint32( 8, totalSize,       true);
  hdv.setUint32(12, 0,               true);
  hdv.setUint32(16, coffFirstFile,   true);
  hdv.setUint32(20, 0,               true);
  cab[24] = 3; cab[25] = 1;
  hdv.setUint16(26, 1,               true);
  hdv.setUint16(28, files.length,    true);
  hdv.setUint16(30, 0,               true);
  hdv.setUint16(32, 0,               true);
  hdv.setUint16(34, 0,               true);

  hdv.setUint32(HEADER_SZ,     coffFolderData,    true);
  hdv.setUint16(HEADER_SZ + 4, dataBlocks.length, true);
  hdv.setUint16(HEADER_SZ + 6, 0,                 true);

  let p = coffFirstFile;
  for (const e of cffileEntries) { cab.set(e, p); p += e.length; }
  for (const e of cfDataEntries)  { cab.set(e, p); p += e.length; }

  return cab;
}

export function fmtDatetime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Export all captured packets as CSV ───────────────────────────────────────
export function exportAllPackets(): void {
  if (state.packets.length === 0) return;

  function csvField(value: unknown): string {
    const s = value == null ? '' : String(value);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  }

  const rows: string[][] = [['Timestamp', 'Direction', 'Command ID', 'Command Name', 'Packet']];
  for (const pkt of state.packets) {
    rows.push([
      pkt.timestamp,
      pkt.isInbound ? 'IN' : 'OUT',
      cmdHex(pkt.cmd),
      CMD_NAMES[pkt.cmd] ?? '',
      pkt.packet ?? '',
    ]);
  }
  const csv  = rows.map(r => r.map(csvField).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' });
  triggerDownload(blob, `capture-${fmtDatetime()}.csv`);
}

// ─── Export the currently selected packet as binary ───────────────────────────
export function exportCurrentPacket(): void {
  const compact = currentPlainPacketCompact();
  if (!compact) return;
  const bytes = compactToBytes(compact);
  const blob  = new Blob([bytes], { type: 'application/octet-stream' });
  const pkt   = getSelectedPacket();
  triggerDownload(blob, `${cmdHex(pkt?.cmd ?? 0).slice(2)}-${pkt?.isInbound ? 'in' : 'out'}-${fmtDatetime()}.bin`);
}

export function copyCurrentPacket(): void {
  const compact = currentPlainPacketCompact();
  if (!compact) return;
  const text = compact.toUpperCase();
  try {
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text); return; }
  } catch { /* fall through */ }
  ImGui.SetClipboardText(text);
}

// ─── Export the currently editing rule payload as binary ─────────────────────
export function exportCurrentRule(): void {
  if (!state.editingRule || !state.detail.compact) return;
  const bytes = compactToBytes(state.detail.compact);
  const blob  = new Blob([bytes], { type: 'application/octet-stream' });
  triggerDownload(
    blob,
    `${cmdHex(state.editingRule.cmd).slice(2)}-${state.editingRule.isInbound ? 'in' : 'out'}-${fmtDatetime()}.bin`,
  );
}

export function copyCurrentRule(): void {
  if (!state.editingRule || !state.detail.compact) return;
  const text = state.detail.compact.toUpperCase();
  try {
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text); return; }
  } catch { /* fall through */ }
  ImGui.SetClipboardText(text);
}
