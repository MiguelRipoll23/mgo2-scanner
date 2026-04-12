import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import {
  WF_NoMove, WF_NoResize, WF_NoCollapse, WF_NoTitleBar, WF_MenuBar,
  IMGUI_COL_MENUBAR_BG,
  COL_TESTING_BG,
} from '../constants.js';
import { exportAllPackets, exportCurrentPacket } from '../utils/export.js';
import { renderPacketList }    from './packetList.js';
import { renderCenterPanel }   from './centerPanel.js';
import { renderRightSidebar }  from './rightSidebar.js';
import { renderSearchWindow }  from './searchWindow.js';
import {
  renderClearRulesConfirmModal,
  renderDeleteRuleConfirmModal,
  renderDisableKeepUpstreamConfirmModal,
  renderConnectionStateModal,
} from './modals.js';

export function renderMainWindow(vpW: number, vpH: number): void {
  // ── Apply green menubar tint while testing is active ──────────────────────
  if (state.spoofingEnabled) {
    ImGui.PushStyleColor(IMGUI_COL_MENUBAR_BG, COL_TESTING_BG);
  }

  ImGui.SetNextWindowPos(new ImVec2(0, 0));
  ImGui.SetNextWindowSize(new ImVec2(vpW, vpH));
  ImGui.Begin('##main', null,
    WF_NoMove | WF_NoResize | WF_NoCollapse | WF_NoTitleBar | WF_MenuBar);

  if (state.spoofingEnabled) ImGui.PopStyleColor(1);

  try {
    // ── Menu bar ──────────────────────────────────────────────────────────────
    if (ImGui.BeginMenuBar()) {
      try {
        ImGui.Text('MGO2 SCANNER');

        // Testing state indicator in menu bar
        if (state.spoofingEnabled) {
          ImGui.SameLine(0, 12);
          ImGui.Text('[TESTING]');
        }

        ImGui.SameLine(0, 20);

        if (ImGui.BeginMenu('View')) {
          if (ImGui.MenuItem('Auto-scroll', '', state.autoScroll)) state.autoScroll = !state.autoScroll;
          if (ImGui.MenuItem('Keep upstream open', '', state.keepUpstreamOpen)) {
            if (state.keepUpstreamOpen && state.tcpStatuses.some(s => s.connected)) {
              state.showDisableKeepUpstreamConfirm = true;
            } else {
              state.keepUpstreamOpen        = !state.keepUpstreamOpen;
              state.pendingKeepUpstreamOpen = state.keepUpstreamOpen;
            }
          }
          ImGui.Separator();
          if (ImGui.MenuItem('Connection State')) state.showConnectionStateModal = true;
          ImGui.EndMenu();
        }

        if (ImGui.BeginMenu('Edit')) {
          if (ImGui.MenuItem('Clear Packets')) {
            state.packets.length  = 0;
            state.selectedIdx     = -1;
            state.detail.compact  = '';
            state.detail.original = '';
            state.detail.packet   = '';
            state.detail.lastIdx  = -2;
            state.detail.cursorByte = 0;
          }
          if (ImGui.MenuItem('Clear Test Rules')) state.showClearRulesConfirm = true;
          ImGui.Separator();
          if (ImGui.MenuItem('Search value')) state.searchState.open = true;
          ImGui.EndMenu();
        }

        // ── Export menu — replaces the old SmallButton ────────────────────────
        if (ImGui.BeginMenu('Export')) {
          const hasSel = state.selectedIdx >= 0 && state.packets[state.selectedIdx] != null;
          ImGui.BeginDisabled(!hasSel);
          if (ImGui.MenuItem('Export Selected')) exportCurrentPacket();
          ImGui.EndDisabled();

          ImGui.BeginDisabled(state.packets.length === 0);
          if (ImGui.MenuItem('Export All')) exportAllPackets();
          ImGui.EndDisabled();

          ImGui.EndMenu();
        }

      } finally {
        ImGui.EndMenuBar();
      }
    }

    // ── Panel layout ──────────────────────────────────────────────────────────
    const lpW = 300;
    const rpW = 240;
    const cpW = vpW - lpW - rpW - 16;

    ImGui.BeginChild('##lp', new ImVec2(lpW, 0), 1, 0);
    try { renderPacketList(); } finally { ImGui.EndChild(); }

    ImGui.SameLine(0, 4);

    ImGui.BeginChild('##cp', new ImVec2(cpW, 0), 1, 0);
    try { renderCenterPanel(); } finally { ImGui.EndChild(); }

    ImGui.SameLine(0, 4);

    ImGui.BeginChild('##rp', new ImVec2(0, 0), 1, 0);
    try { renderRightSidebar(vpH); } finally { ImGui.EndChild(); }

  } finally {
    ImGui.End();
  }

  renderSearchWindow(vpW, vpH);
  renderClearRulesConfirmModal(vpW, vpH);
  renderDeleteRuleConfirmModal(vpW, vpH);
  renderDisableKeepUpstreamConfirmModal(vpW, vpH);
  renderConnectionStateModal(vpW, vpH);
}
