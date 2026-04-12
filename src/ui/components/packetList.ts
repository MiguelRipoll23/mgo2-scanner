import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import { CMD_NAMES, cmdHex } from '../constants.js';
import {
  TF_ScrollY, TF_Borders, TF_RowBg, TF_SizingFixedFit,
  CF_WidthFixed, CF_WidthStretch,
  SEL_SpanAllColumns,
  COL_GREEN, COL_PURPLE,
} from '../constants.js';
import { requestPacketSelection } from '../utils/packet.js';

export function renderPacketList(): void {
  if (!ImGui.BeginTabBar('##lp_tabs')) return;
  try {
    if (!ImGui.BeginTabItem(`Packets (${state.packets.length})##lp_tab`)) return;
    try {
      const flags = TF_ScrollY | TF_Borders | TF_RowBg | TF_SizingFixedFit;
      if (ImGui.BeginTable('##pl', 3, flags, new ImVec2(0, -1))) {
        try {
          ImGui.TableSetupScrollFreeze(0, 1);
          ImGui.TableSetupColumn('Dir',  CF_WidthFixed,  36);
          ImGui.TableSetupColumn('ID',   CF_WidthFixed,  54);
          ImGui.TableSetupColumn('Name', CF_WidthStretch, 0);
          ImGui.TableHeadersRow();

          for (let i = 0; i < state.packets.length; i++) {
            const pkt = state.packets[i];
            ImGui.PushStyleColor(0, pkt.isInbound ? COL_GREEN : COL_PURPLE);
            ImGui.TableNextRow();
            ImGui.TableSetColumnIndex(0);
            if (ImGui.Selectable(
              `${pkt.isInbound ? 'IN' : 'OUT'}##r${i}`,
              state.selectedIdx === i,
              SEL_SpanAllColumns,
            )) requestPacketSelection(i);
            ImGui.TableSetColumnIndex(1); ImGui.Text(cmdHex(pkt.cmd));
            ImGui.TableSetColumnIndex(2); ImGui.Text(CMD_NAMES[pkt.cmd] ?? '');
            ImGui.PopStyleColor(1);
          }

          if (state.autoScroll) ImGui.SetScrollHereY(1.0);
        } finally {
          ImGui.EndTable();
        }
      }
    } finally {
      ImGui.EndTabItem();
    }
  } finally {
    ImGui.EndTabBar();
  }
}
