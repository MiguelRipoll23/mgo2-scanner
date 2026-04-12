import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import { renderDataInspector } from './dataInspector.js';
import { exportCurrentPacket, copyCurrentPacket, exportCurrentRule, copyCurrentRule } from '../utils/export.js';
import { getSelectedExcludedRule } from '../utils/packet.js';

export function renderRightSidebar(vpH: number): void {
  const inspectorH = Math.floor((vpH - 48) * 0.62);

  ImGui.BeginChild('##di_pane', new ImVec2(0, inspectorH), 0, 0);
  try {
    if (ImGui.BeginTabBar('##inspector_tabs')) {
      try {
        if (ImGui.BeginTabItem('Data Inspector')) {
          renderDataInspector();
          ImGui.EndTabItem();
        }
      } finally {
        ImGui.EndTabBar();
      }
    }
  } finally {
    ImGui.EndChild();
  }

  ImGui.BeginChild('##actions_pane', new ImVec2(0, 0), 0, 0);
  try {
    if (ImGui.BeginTabBar('##actions_tabs')) {
      try {
        if (ImGui.BeginTabItem('Actions')) {
          const hasSel = state.selectedIdx >= 0 && state.packets[state.selectedIdx] != null;

          if (!hasSel && !state.editingRule) {
            ImGui.TextDisabled('No packet selected.');
          } else if (state.editingRule) {
            ImGui.Spacing();
            const actionGap = 6;
            const actionW   = Math.floor((ImGui.GetContentRegionAvail().x - actionGap) / 2);
            if (ImGui.Button('Export##rule', new ImVec2(actionW, 0))) exportCurrentRule();
            ImGui.SameLine(0, actionGap);
            if (ImGui.Button('Copy##rule', new ImVec2(actionW, 0))) copyCurrentRule();
          } else if (hasSel) {
            const pkt = state.packets[state.selectedIdx];

            ImGui.Spacing();
            const actionGap = 6;
            const actionW   = Math.floor((ImGui.GetContentRegionAvail().x - actionGap) / 2);
            if (ImGui.Button('Export', new ImVec2(actionW, 0))) exportCurrentPacket();
            ImGui.SameLine(0, actionGap);
            if (ImGui.Button('Copy', new ImVec2(actionW, 0))) copyCurrentPacket();

            ImGui.Spacing();
            const excludeFuture: [boolean] = [!!getSelectedExcludedRule()];
            if (ImGui.Checkbox('Must ignore', excludeFuture)) {
              state.pendingExcludedRule = {
                cmd:       pkt.cmd,
                isInbound: pkt.isInbound,
                enabled:   excludeFuture[0],
              };
            }
          }
          ImGui.EndTabItem();
        }
      } finally {
        ImGui.EndTabBar();
      }
    }
  } finally {
    ImGui.EndChild();
  }
}
