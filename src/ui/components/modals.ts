import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import { WF_NoResize, COL_GREEN, COL_RED } from '../constants.js';
import { sendWS } from '../websocket.js';

export function renderClearRulesConfirmModal(vpW: number, vpH: number): void {
  if (!state.showClearRulesConfirm) return;
  ImGui.SetNextWindowPos(
    new ImVec2(Math.floor((vpW - 320) * 0.5), Math.floor((vpH - 90) * 0.5)),
    4,
  );
  ImGui.SetNextWindowSize(new ImVec2(320, 90), 4);
  ImGui.Begin('Clear Test Rules', null, WF_NoResize);
  try {
    ImGui.TextWrapped(
      `Clear all ${state.spoofRules.length} test rule${state.spoofRules.length !== 1 ? 's' : ''}? This cannot be undone.`,
    );
    if (ImGui.Button('Clear all')) { state.pendingClearRules = true; state.showClearRulesConfirm = false; }
    ImGui.SameLine(0, 8);
    if (ImGui.Button('Cancel')) state.showClearRulesConfirm = false;
  } finally {
    ImGui.End();
  }
}

export function renderDeleteRuleConfirmModal(vpW: number, vpH: number): void {
  if (!state.pendingDeleteConfirmRule) return;
  ImGui.SetNextWindowPos(
    new ImVec2(Math.floor((vpW - 360) * 0.5), Math.floor((vpH - 90) * 0.5)),
    4,
  );
  ImGui.SetNextWindowSize(new ImVec2(360, 90), 4);
  ImGui.Begin('Delete Test Rule', null, WF_NoResize);
  try {
    const r      = state.pendingDeleteConfirmRule;
    const rName  = state.spoofRules.find(sr => sr.cmd === r.cmd)?.cmd
      ? ` ${(r as unknown as Record<string, unknown>)['name'] ?? ''}` : '';
    void rName;
    ImGui.TextWrapped(`Delete test rule for 0x${r.cmd.toString(16).toUpperCase().padStart(4, '0')} (${r.isInbound ? 'IN' : 'OUT'})?`);
    if (ImGui.Button('Delete')) {
      state.pendingDelete = { cmd: r.cmd, isInbound: r.isInbound };
      if (
        state.editingRule &&
        state.editingRule.cmd === r.cmd &&
        state.editingRule.isInbound === r.isInbound
      ) {
        state.editingRule    = null;
        state.detail.lastIdx = -2;
      }
      state.pendingDeleteConfirmRule = null;
    }
    ImGui.SameLine(0, 8);
    if (ImGui.Button('Cancel')) state.pendingDeleteConfirmRule = null;
  } finally {
    ImGui.End();
  }
}

export function renderDisableKeepUpstreamConfirmModal(vpW: number, vpH: number): void {
  if (!state.showDisableKeepUpstreamConfirm) return;
  ImGui.SetNextWindowPos(
    new ImVec2(Math.floor((vpW - 340) * 0.5), Math.floor((vpH - 90) * 0.5)),
    4,
  );
  ImGui.SetNextWindowSize(new ImVec2(340, 90), 4);
  ImGui.Begin('Close upstream connections', null, WF_NoResize);
  try {
    ImGui.TextWrapped('Active upstream connections will be closed. Continue?');
    if (ImGui.Button('Close connections')) {
      state.keepUpstreamOpen              = false;
      state.pendingKeepUpstreamOpen       = false;
      state.pendingForceCloseUpstream     = true;
      state.showDisableKeepUpstreamConfirm = false;
    }
    ImGui.SameLine(0, 8);
    if (ImGui.Button('Cancel')) state.showDisableKeepUpstreamConfirm = false;
  } finally {
    ImGui.End();
  }
}

export function renderConnectionStateModal(vpW: number, vpH: number): void {
  if (!state.showConnectionStateModal) return;
  ImGui.SetNextWindowPos(
    new ImVec2(Math.floor((vpW - 210) * 0.5), Math.floor((vpH - 68) * 0.5)),
    4,
  );
  ImGui.SetNextWindowSize(new ImVec2(210, 68), 4);
  const openRef: [boolean] = [state.showConnectionStateModal];
  ImGui.Begin('Connection State', openRef, WF_NoResize);
  state.showConnectionStateModal = openRef[0];
  try {
    const activePorts = state.tcpStatuses
      .filter(s => s.connected)
      .map(s => String(s.port));
    ImGui.TextDisabled('Upstream');
    ImGui.SameLine(0, 8);
    ImGui.PushStyleColor(0, activePorts.length ? COL_GREEN : COL_RED);
    ImGui.Text(activePorts.length ? activePorts.join(', ') : 'None');
    ImGui.PopStyleColor(1);
    ImGui.TextDisabled('WebSocket');
    ImGui.SameLine(0, 8);
    ImGui.PushStyleColor(0, state.wsReady ? COL_GREEN : COL_RED);
    ImGui.Text(state.wsReady ? 'connected' : 'disconnected');
    ImGui.PopStyleColor(1);
  } finally {
    ImGui.End();
  }
}

// Re-export sendWS so modals can dispatch actions inline (keeps import fan-out low)
export { sendWS };
