import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import { CMD_NAMES, cmdHex } from '../constants.js';
import {
  TF_Borders, TF_RowBg, TF_SizingFixedFit, TF_ScrollY,
  CF_WidthFixed, CF_WidthStretch,
  IMGUI_COL_BUTTON, IMGUI_COL_BUTTON_HOVERED, IMGUI_COL_BUTTON_ACTIVE,
  COL_GREEN, COL_PURPLE,
  col32,
} from '../constants.js';
import { startEditingRule } from '../utils/packet.js';

export function renderSpoofRulesSection(): void {
  const actionGap          = 6;
  const spoofingWasEnabled = state.spoofingEnabled;

  ImGui.Dummy(new ImVec2(0, 4));

  if (spoofingWasEnabled) {
    ImGui.PushStyleColor(IMGUI_COL_BUTTON,         col32(0.80, 0.24, 0.24, 1.0));
    ImGui.PushStyleColor(IMGUI_COL_BUTTON_HOVERED, col32(0.92, 0.30, 0.30, 1.0));
    ImGui.PushStyleColor(IMGUI_COL_BUTTON_ACTIVE,  col32(0.68, 0.18, 0.18, 1.0));
  }
  if (ImGui.Button(state.spoofingEnabled ? 'Stop testing' : 'Start testing')) {
    state.pendingSpoofingEnabled = !state.spoofingEnabled;
    state.spoofingEnabled        = !state.spoofingEnabled;
  }
  if (spoofingWasEnabled) ImGui.PopStyleColor(3);

  ImGui.SameLine(0, actionGap);
  if (ImGui.Button('Clear rules')) state.showClearRulesConfirm = true;
  ImGui.Dummy(new ImVec2(0, 4));

  ImGui.Spacing();
  ImGui.TextDisabled(`Test Rules (${state.spoofRules.length})`);

  if (state.spoofRules.length === 0) {
    ImGui.TextDisabled('  No active rules.');
    return;
  }

  const flags = TF_Borders | TF_RowBg | TF_SizingFixedFit | TF_ScrollY;
  if (!ImGui.BeginTable('##sr', 4, flags, new ImVec2(0, -1))) return;
  try {
    ImGui.TableSetupScrollFreeze(0, 1);
    ImGui.TableSetupColumn('Dir',     CF_WidthFixed,   28);
    ImGui.TableSetupColumn('ID',      CF_WidthFixed,   56);
    ImGui.TableSetupColumn('Name',    CF_WidthStretch,  0);
    ImGui.TableSetupColumn('Actions', CF_WidthFixed,  112);
    ImGui.TableHeadersRow();

    for (const rule of state.spoofRules) {
      const k           = `${rule.isInbound ? 1 : 0}_${rule.cmd}`;
      const rowHeight   = 30;
      const textOffsetY = Math.max(0, Math.floor((rowHeight - ImGui.GetTextLineHeight()) * 0.5) - 1);
      const btnOffsetY  = Math.max(0, Math.floor((rowHeight - 24) * 0.5));

      ImGui.PushStyleColor(0, rule.isInbound ? COL_GREEN : COL_PURPLE);
      ImGui.TableNextRow(0, rowHeight);

      ImGui.TableSetColumnIndex(0);
      ImGui.SetCursorPosY(ImGui.GetCursorPosY() + textOffsetY);
      ImGui.Text(rule.isInbound ? 'IN' : 'OUT');
      ImGui.PopStyleColor(1);

      ImGui.TableSetColumnIndex(1);
      ImGui.SetCursorPosY(ImGui.GetCursorPosY() + textOffsetY);
      ImGui.Text(cmdHex(rule.cmd));

      ImGui.TableSetColumnIndex(2);
      ImGui.SetCursorPosY(ImGui.GetCursorPosY() + textOffsetY);
      ImGui.Text(CMD_NAMES[rule.cmd] ?? '');

      ImGui.TableSetColumnIndex(3);
      ImGui.SetCursorPosY(ImGui.GetCursorPosY() + btnOffsetY);
      if (ImGui.Button(`Edit##${k}`)) startEditingRule(rule);
      ImGui.SameLine(0, 4);
      if (ImGui.Button(`Delete##${k}`))
        state.pendingDeleteConfirmRule = { cmd: rule.cmd, isInbound: rule.isInbound };
    }
  } finally {
    ImGui.EndTable();
  }
}
