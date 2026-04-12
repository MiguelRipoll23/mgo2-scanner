import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import { CMD_NAMES, cmdHex } from '../constants.js';
import {
  SPOOF_SECTION_H,
  IMGUI_COL_TEXT,
  COL_GREEN, COL_PURPLE, COL_ORANGE,
} from '../constants.js';
import { loadSelectedDetailFromPacket } from '../utils/packet.js';
import { renderHexTable, handleHexCursorKeys } from './hexTable.js';
import { renderSpoofRulesSection } from './spoofRules.js';

export function renderCenterPanel(): void {
  const hasSel = state.selectedIdx >= 0 && state.packets[state.selectedIdx] != null;

  // ── Top area: hex view or placeholder ────────────────────────────────────────
  ImGui.BeginChild('##cptop', new ImVec2(0, -(SPOOF_SECTION_H + 6)), 0, 0);
  try {
    if (state.editingRule) {
      ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
      ImGui.Text('Rule');
      ImGui.PopStyleColor(1);
      ImGui.SameLine(0, 8);
      ImGui.Text(cmdHex(state.editingRule.cmd));
      if (CMD_NAMES[state.editingRule.cmd]) {
        ImGui.SameLine(0, 8);
        ImGui.Text(CMD_NAMES[state.editingRule.cmd]);
      }
      ImGui.Separator();
      renderHexTable(state.detail.compact, -1);
      handleHexCursorKeys(state.detail.compact);
    } else if (!hasSel) {
      ImGui.Spacing();
      ImGui.TextDisabled('  No packet selected.');
      ImGui.TextDisabled('  Click a row in the packet list on the left.');
    } else {
      const pkt = state.packets[state.selectedIdx];

      if (state.detail.lastIdx !== state.selectedIdx) {
        loadSelectedDetailFromPacket();
      }

      ImGui.PushStyleColor(IMGUI_COL_TEXT, pkt.isInbound ? COL_GREEN : COL_PURPLE);
      ImGui.Text(pkt.isInbound ? 'IN' : 'OUT');
      ImGui.PopStyleColor(1);
      ImGui.SameLine(0, 8);
      ImGui.Text(cmdHex(pkt.cmd));
      if (CMD_NAMES[pkt.cmd]) { ImGui.SameLine(0, 8); ImGui.Text(CMD_NAMES[pkt.cmd]); }
      ImGui.SameLine(0, 12);
      ImGui.TextDisabled(`${pkt.payloadLen} bytes`);
      ImGui.Separator();

      renderHexTable(state.detail.compact, -1);
      handleHexCursorKeys(state.detail.compact);
    }
  } finally {
    ImGui.EndChild();
  }

  if (state.spoofRules.length === 0) ImGui.Separator();

  // ── Spoof rules: fixed height, always visible ─────────────────────────────
  ImGui.BeginChild('##ss', new ImVec2(0, SPOOF_SECTION_H), 0, 0);
  try {
    renderSpoofRulesSection();
  } finally {
    ImGui.EndChild();
  }
}
