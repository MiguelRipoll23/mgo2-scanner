import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import {
  CSTRING_SCAN_LIMIT,
  TF_Borders, TF_RowBg, TF_SizingFixedFit,
  CF_WidthFixed, CF_WidthStretch,
  IMGUI_COL_TEXT,
  IMGUI_COL_FRAME_BG, IMGUI_COL_FRAME_BG_HOVERED, IMGUI_COL_FRAME_BG_ACTIVE,
  COL_ORANGE,
  col32,
} from '../constants.js';
import { isRangeModified, replaceBytesAtCursor } from '../utils/packet.js';
import { queueSpoofSync } from '../utils/packet.js';

// ─── String decode helpers ────────────────────────────────────────────────────
export function decodePrintableAscii(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : '.';
  return out;
}

export function encodeAsciiPatch(text: string, prevBytes: Uint8Array): Uint8Array {
  const out = Uint8Array.from(prevBytes);
  for (let i = 0; i < Math.min(text.length, out.length); i++) {
    const ch = text[i];
    out[i] = ch === '.' ? prevBytes[i] : (ch.charCodeAt(0) & 0xff);
  }
  return out;
}

export function decodeCString(bytes: Uint8Array): string {
  const nul  = bytes.indexOf(0);
  const view = nul === -1 ? bytes : bytes.slice(0, nul);
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(view);
  } catch {
    return '';
  }
}

export function encodeCString(text: string, fieldLen: number): Uint8Array {
  const out   = new Uint8Array(fieldLen);
  const bytes = new TextEncoder().encode(text);
  out.set(bytes.slice(0, fieldLen - 1));
  return out;
}

// ─── Inspector field synchronisation ─────────────────────────────────────────
export function syncInspectorFields(buf: Uint8Array, dv: DataView, n: number): void {
  const off          = state.detail.cursorByte;
  const cursorKey    = `${state.detail.lastIdx}:${off}`;
  const key          = `${cursorKey}:${state.detail.compact}`;
  const cstringByteKey = String(off);

  const cstringByteChanged = state.inspectorEd.cstringByteKey !== cstringByteKey;
  if (cstringByteChanged) {
    state.inspectorEd.cstringByteKey = cstringByteKey;
    const scanLimit = Math.min(CSTRING_SCAN_LIMIT, n);
    const nullAt    = buf.slice(0, scanLimit).indexOf(0);
    if (nullAt === -1) {
      state.inspectorEd.cStringLen = scanLimit;
    } else if (nullAt === 0) {
      let runEnd = 1;
      while (runEnd < scanLimit && buf[runEnd] === 0) runEnd++;
      state.inspectorEd.cStringLen = runEnd;
    } else {
      state.inspectorEd.cStringLen = nullAt + 1;
    }
    state.inspectorEd.fields['cstring'] = decodeCString(buf.slice(0, scanLimit));
  }

  const cursorMoved = state.inspectorEd.cursorKey !== cursorKey;
  if (cursorMoved) state.inspectorEd.cursorKey = cursorKey;

  if (state.inspectorEd.key === key) return;
  state.inspectorEd.key = key;

  state.inspectorEd.fields = {
    uint8:   n >= 1 ? String(dv.getUint8(0))              : '',
    int8:    n >= 1 ? String(dv.getInt8(0))               : '',
    uint16:  n >= 2 ? String(dv.getUint16(0, false))      : '',
    int16:   n >= 2 ? String(dv.getInt16(0, false))       : '',
    uint32:  n >= 4 ? String(dv.getUint32(0, false))      : '',
    int32:   n >= 4 ? String(dv.getInt32(0, false))       : '',
    uint64:  n >= 8 ? dv.getBigUint64(0, false).toString(): '',
    int64:   n >= 8 ? dv.getBigInt64(0, false).toString() : '',
    float32: n >= 4 ? String(dv.getFloat32(0, false))     : '',
    float64: n >= 8 ? String(dv.getFloat64(0, false))     : '',
    binary:  n >= 1 ? dv.getUint8(0).toString(2).padStart(8, '0') : '',
    string:  decodePrintableAscii(buf.slice(0, Math.min(26, n))),
    cstring: state.inspectorEd.fields['cstring'] ?? '',
  };
}

// ─── Data Inspector panel ─────────────────────────────────────────────────────
export function renderDataInspector(): void {
  const compact = state.detail.compact;
  const off     = state.detail.cursorByte;

  ImGui.TextDisabled(`Cursor  0x${off.toString(16).toUpperCase().padStart(8, '0')}`);
  ImGui.Separator();

  if (!compact || compact.length < 2 || off * 2 >= compact.length) {
    ImGui.TextDisabled('(no data at cursor)');
    return;
  }

  const slice = compact.slice(off * 2);
  const n     = slice.length / 2;
  const buf   = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = parseInt(slice.slice(i * 2, i * 2 + 2), 16);
  const dv = new DataView(buf.buffer);
  syncInspectorFields(buf, dv, n);

  const flags = TF_Borders | TF_RowBg | TF_SizingFixedFit;
  if (!ImGui.BeginTable('##di', 2, flags)) return;
  ImGui.TableSetupColumn('Type',  CF_WidthFixed,   80);
  ImGui.TableSetupColumn('Value', CF_WidthStretch,  0);
  ImGui.TableHeadersRow();

  function renderRowLabel(label: string, modified: boolean): void {
    if (modified) ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
    ImGui.TextDisabled(label);
    if (modified) ImGui.PopStyleColor(1);
  }

  function row(label: string, val: unknown, modified = false): void {
    ImGui.TableNextRow();
    ImGui.TableSetColumnIndex(0); renderRowLabel(label, modified);
    ImGui.TableSetColumnIndex(1); ImGui.Text(String(val));
  }

  function na(label: string, modified = false): void {
    ImGui.TableNextRow();
    ImGui.TableSetColumnIndex(0); renderRowLabel(label, modified);
    ImGui.TableSetColumnIndex(1); ImGui.TextDisabled('--');
  }

  function editRow(
    label: string,
    fieldKey: string,
    byteLen: number,
    parseToBytes: (value: string) => Uint8Array | null,
  ): void {
    const modified = isRangeModified(byteLen);
    ImGui.TableNextRow();
    ImGui.TableSetColumnIndex(0);
    renderRowLabel(label, modified);
    ImGui.TableSetColumnIndex(1);
    ImGui.SetNextItemWidth(-1);
    const bufRef = [state.inspectorEd.fields[fieldKey] ?? ''];
    ImGui.PushStyleColor(IMGUI_COL_FRAME_BG,         col32(0, 0, 0, 0));
    ImGui.PushStyleColor(IMGUI_COL_FRAME_BG_HOVERED, col32(0.28, 0.33, 0.42, 0.38));
    ImGui.PushStyleColor(IMGUI_COL_FRAME_BG_ACTIVE,  col32(0, 0, 0, 0));
    if (ImGui.InputText(`##${fieldKey}`, bufRef, 256)) {
      state.inspectorEd.fields[fieldKey] = bufRef[0];
      const nextBytes = parseToBytes(bufRef[0]);
      if (nextBytes && replaceBytesAtCursor(nextBytes)) queueSpoofSync();
    }
    ImGui.PopStyleColor(3);
  }

  // Suppress the unused-variable warning for `row` — it's available for callers
  void row;

  n >= 1 ? editRow('uint8', 'uint8', 1, value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 0xff) return null;
    return Uint8Array.of(num);
  }) : na('uint8');

  n >= 1 ? editRow('int8', 'int8', 1, value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < -0x80 || num > 0x7f) return null;
    const out = new Uint8Array(1);
    new DataView(out.buffer).setInt8(0, num);
    return out;
  }) : na('int8');

  n >= 2 ? editRow('uint16', 'uint16', 2, value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 0xffff) return null;
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, num, false);
    return out;
  }) : na('uint16');

  n >= 2 ? editRow('int16', 'int16', 2, value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < -0x8000 || num > 0x7fff) return null;
    const out = new Uint8Array(2);
    new DataView(out.buffer).setInt16(0, num, false);
    return out;
  }) : na('int16');

  n >= 4 ? editRow('uint32', 'uint32', 4, value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 0xffffffff) return null;
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, num >>> 0, false);
    return out;
  }) : na('uint32');

  n >= 4 ? editRow('int32', 'int32', 4, value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < -0x80000000 || num > 0x7fffffff) return null;
    const out = new Uint8Array(4);
    new DataView(out.buffer).setInt32(0, num | 0, false);
    return out;
  }) : na('int32');

  try {
    n >= 8 ? editRow('uint64', 'uint64', 8, value => {
      try {
        const num = BigInt(value);
        if (num < 0n || num > 0xffffffffffffffffn) return null;
        const out = new Uint8Array(8);
        new DataView(out.buffer).setBigUint64(0, num, false);
        return out;
      } catch { return null; }
    }) : na('uint64');

    n >= 8 ? editRow('int64', 'int64', 8, value => {
      try {
        const num = BigInt(value);
        if (num < -0x8000000000000000n || num > 0x7fffffffffffffffn) return null;
        const out = new Uint8Array(8);
        new DataView(out.buffer).setBigInt64(0, num, false);
        return out;
      } catch { return null; }
    }) : na('int64');
  } catch {
    na('uint64');
    na('int64');
  }

  n >= 4 ? editRow('float32', 'float32', 4, value => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const out = new Uint8Array(4);
    new DataView(out.buffer).setFloat32(0, num, false);
    return out;
  }) : na('float32');

  n >= 8 ? editRow('float64', 'float64', 8, value => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const out = new Uint8Array(8);
    new DataView(out.buffer).setFloat64(0, num, false);
    return out;
  }) : na('float64');

  n >= 1 ? editRow('binary', 'binary', 1, value => {
    if (!/^[01]{1,8}$/.test(value)) return null;
    return Uint8Array.of(parseInt(value.padStart(8, '0'), 2));
  }) : na('binary');

  n >= 1 ? editRow('string', 'string', Math.min(26, n), value => {
    return encodeAsciiPatch(value.slice(0, Math.min(26, n)), buf.slice(0, Math.min(26, n)));
  }) : na('string');

  const cStringLen = state.inspectorEd.cStringLen;
  n >= 1 ? editRow('cstring', 'cstring', cStringLen, value => {
    return encodeCString(value, cStringLen);
  }) : na('cstring');

  ImGui.EndTable();
}
