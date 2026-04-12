import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import {
  BPR,
  TF_Borders, TF_RowBg, TF_ScrollY,
  CF_WidthFixed, CF_WidthStretch,
  IMGUI_COL_TEXT,
  COL_ORANGE, COL_BLUE,
} from '../constants.js';
import { toHexLines, toAsciiLines, applyAsciiToHex, parseHexInput, clampCursor } from '../utils/hex.js';
import { isByteModified } from '../utils/packet.js';
import { isSearchHighlighted } from '../utils/search.js';

// ─── ImHex-style hex table with per-byte cursor ───────────────────────────────
export function renderHexTable(compact: string, tableH: number): void {
  if (!compact || compact.length < 2) return;
  const nBytes = compact.length / 2;
  const nCols  = 1 + BPR + 1; // Offset + 16 bytes + ASCII = 18

  const flags = TF_ScrollY | TF_Borders | TF_RowBg;
  if (!ImGui.BeginTable('##ht', nCols, flags, new ImVec2(0, tableH))) return;

  ImGui.TableSetupScrollFreeze(0, 1);
  ImGui.TableSetupColumn('Offset', CF_WidthFixed, 72);
  for (let i = 0; i < BPR; i++) {
    const hdr = i.toString(16).toUpperCase().padStart(2, '0');
    ImGui.TableSetupColumn(hdr, CF_WidthFixed, i === 8 ? 26 : 22);
  }
  ImGui.TableSetupColumn('Decoded text', CF_WidthFixed, 134);
  ImGui.TableHeadersRow();

  for (let row = 0; row < nBytes; row += BPR) {
    ImGui.TableNextRow();

    // Offset column
    ImGui.TableSetColumnIndex(0);
    ImGui.TextDisabled(row.toString(16).toUpperCase().padStart(8, '0'));

    // Byte columns — each is an individual Selectable
    for (let b = 0; b < BPR; b++) {
      const off = row + b;
      ImGui.TableSetColumnIndex(b + 1);
      if (off < nBytes) {
        const hexByte  = compact.slice(off * 2, off * 2 + 2).toUpperCase();
        const isCursor = off === state.detail.cursorByte;
        const modified = isByteModified(off);
        const searched = isSearchHighlighted(off);
        if (searched)       ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_BLUE);
        else if (modified)  ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
        if (ImGui.Selectable(`${hexByte}##b${off}`, isCursor, 0)) {
          state.detail.cursorByte = off;
        }
        if (searched || modified) ImGui.PopStyleColor(1);
      }
    }

    // ASCII column
    ImGui.TableSetColumnIndex(BPR + 1);
    let ascii       = '';
    let rowModified = false;
    let rowSearched = false;
    for (let b = 0; b < BPR; b++) {
      const off = row + b;
      if (off < nBytes) {
        const byte = parseInt(compact.slice(off * 2, off * 2 + 2), 16);
        ascii += (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : '.';
        rowModified ||= isByteModified(off);
        rowSearched ||= isSearchHighlighted(off);
      }
    }
    if (rowSearched)       ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_BLUE);
    else if (rowModified)  ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
    ImGui.TextDisabled(ascii);
    if (rowSearched || rowModified) ImGui.PopStyleColor(1);
  }

  ImGui.EndTable();
}

// ─── Two-column editable hex / ASCII editor ───────────────────────────────────
export interface HexEditorState {
  hex:     string;
  ascii:   string;
  compact: string;
}

export function renderHexEditor(ed: HexEditorState, uid: string, height: number, hexColW: number): boolean {
  let changed = false;

  const hb = [ed.hex];
  if (ImGui.InputTextMultiline(`##hex_${uid}`, hb, 8192, new ImVec2(hexColW, height))) {
    ed.hex = hb[0];
    const c = parseHexInput(ed.hex);
    if (c.length % 2 === 0) { ed.compact = c; ed.ascii = toAsciiLines(c); changed = true; }
  }

  ImGui.SameLine(0, 4);

  const ab = [ed.ascii];
  if (ImGui.InputTextMultiline(`##ascii_${uid}`, ab, 4096, new ImVec2(-1, height))) {
    ed.ascii   = ab[0];
    const c    = applyAsciiToHex(ed.ascii, ed.compact);
    ed.compact = c;
    ed.hex     = toHexLines(c);
    changed    = true;
  }
  return changed;
}

// ─── Keyboard navigation for the hex cursor ───────────────────────────────────
export function handleHexCursorKeys(compact: string): void {
  if (!compact || ImGui.IsAnyItemActive()) return;
  const nBytes = compact.length / 2;
  if (nBytes <= 0) return;

  const key   = ImGui.Key;
  let next    = state.detail.cursorByte;
  if (key && ImGui.IsKeyPressed(key._LeftArrow))  next -= 1;
  if (key && ImGui.IsKeyPressed(key._RightArrow)) next += 1;
  if (key && ImGui.IsKeyPressed(key._UpArrow))    next -= BPR;
  if (key && ImGui.IsKeyPressed(key._DownArrow))  next += BPR;

  state.detail.cursorByte = clampCursor(next, nBytes);
}
