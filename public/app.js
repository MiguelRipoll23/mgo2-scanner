// src/ui/main.ts
import { ImGuiImplWeb, ImGui as ImGui12 } from "/jsimgui/mod.js";

// src/ui/state.ts
var state = {
  // ── Core data ────────────────────────────────────────────────────────────────
  packets: [],
  spoofRules: [],
  excludedRules: [],
  tcpStatuses: [],
  // ── WebSocket ────────────────────────────────────────────────────────────────
  ws: null,
  wsReady: false,
  // ── App state ────────────────────────────────────────────────────────────────
  spoofingEnabled: false,
  keepUpstreamOpen: false,
  autoScroll: false,
  selectedIdx: -1,
  // ── Current-packet detail (updated on selection change) ───────────────────
  detail: {
    compact: "",
    // current payload hex (may be edited)
    original: "",
    // as-captured payload hex — never changed by edits
    packet: "",
    // full packet header + plaintext payload hex
    lastIdx: -2,
    cursorByte: 0
  },
  // ── Data-inspector editor state ──────────────────────────────────────────
  inspectorEd: {
    key: "",
    cursorKey: "",
    cStringLen: 1,
    cstringByteKey: "",
    fields: {}
  },
  // ── Search ───────────────────────────────────────────────────────────────
  searchState: {
    open: false,
    type: "string",
    value: "",
    results: [],
    index: -1,
    direction: "both",
    selectedPacketKey: ""
  },
  // ── Deferred WS sends (processed after ImGui calls) ──────────────────────
  pendingDelete: null,
  pendingSave: null,
  pendingClearRules: false,
  pendingSpoofingEnabled: null,
  pendingExcludedRule: null,
  pendingKeepUpstreamOpen: null,
  pendingForceCloseUpstream: false,
  // ── UI visibility flags ───────────────────────────────────────────────────
  showConnectionStateModal: false,
  showDisableKeepUpstreamConfirm: false,
  showClearRulesConfirm: false,
  // ── Rule editing ─────────────────────────────────────────────────────────
  editingRule: null,
  pendingDeleteConfirmRule: null
};

// src/ui/constants.ts
import { ImGui } from "/jsimgui/mod.js";
var IMGUI_COL_TEXT = ImGui.Col?.Text ?? 0;
var IMGUI_COL_FRAME_BG = ImGui.Col?.FrameBg ?? 7;
var IMGUI_COL_FRAME_BG_HOVERED = ImGui.Col?.FrameBgHovered ?? 8;
var IMGUI_COL_FRAME_BG_ACTIVE = ImGui.Col?.FrameBgActive ?? 9;
var IMGUI_COL_BUTTON = ImGui.Col?.Button ?? 21;
var IMGUI_COL_BUTTON_HOVERED = ImGui.Col?.ButtonHovered ?? 22;
var IMGUI_COL_BUTTON_ACTIVE = ImGui.Col?.ButtonActive ?? 23;
var IMGUI_COL_MENUBAR_BG = ImGui.Col?.MenuBarBg ?? 13;
function col32(r, g, b, a = 1) {
  return ((Math.round(a * 255) & 255) << 24 | (Math.round(b * 255) & 255) << 16 | (Math.round(g * 255) & 255) << 8 | Math.round(r * 255) & 255) >>> 0;
}
var COL_GREEN = col32(0.4, 0.95, 0.4);
var COL_PURPLE = col32(0.78, 0.45, 0.95);
var COL_RED = col32(0.95, 0.4, 0.4);
var COL_ORANGE = col32(0.95, 0.62, 0.18);
var COL_BLUE = col32(0.4, 0.72, 0.98);
var COL_TESTING_BG = col32(0.05, 0.22, 0.05);
var CMD_NAMES = {
  // Common
  3: "DISCONNECT",
  5: "KEEP_ALIVE",
  // Gate server
  8194: "GATE_LIST",
  8195: "GATE_HELLO",
  8196: "GATE_ACK",
  8197: "GET_LOBBY_LIST",
  8200: "GET_NEWS",
  8201: "GET_NEWS_START",
  8202: "GET_NEWS_ITEM",
  8203: "GET_NEWS_END",
  // Account server — session & characters
  12291: "CHECK_SESSION",
  12292: "CHECK_SESSION_RESP",
  12360: "GET_CHARACTER_LIST",
  12361: "GET_CHARACTER_LIST_RESP",
  12545: "CREATE_CHARACTER",
  12546: "CREATE_CHARACTER_RESP",
  12547: "SELECT_CHARACTER",
  12548: "SELECT_CHARACTER_RESP",
  12549: "DELETE_CHARACTER",
  12550: "DELETE_CHARACTER_RESP",
  // Game server — character info
  16640: "GET_CHARACTER_INFO",
  16641: "GET_CHARACTER_INFO_RESP",
  16642: "GET_PERSONAL_STATS",
  16643: "GET_PERSONAL_STATS_RESP",
  16656: "UPDATE_GAMEPLAY_OPTIONS",
  16657: "UPDATE_GAMEPLAY_OPTIONS_RESP",
  16658: "UPDATE_UI_SETTINGS",
  16659: "UPDATE_UI_SETTINGS_RESP",
  16660: "UPDATE_CHAT_MACROS",
  16661: "UPDATE_CHAT_MACROS_RESP",
  16666: "GET_CHAT_MACROS",
  16667: "GET_GAMEPLAY_OPTIONS",
  16672: "GET_GAMEPLAY_OPTIONS_RESP",
  16673: "GET_CHAT_MACROS_RESP",
  16674: "GET_PERSONAL_INFO",
  16676: "GET_GEAR",
  16677: "GET_SKILLS",
  16680: "GET_POST_GAME_INFO",
  16681: "GET_POST_GAME_INFO_RESP",
  16688: "UPDATE_PERSONAL_INFO",
  16689: "UPDATE_PERSONAL_INFO_RESP",
  16704: "GET_SKILL_SETS",
  16705: "UPDATE_SKILL_SETS",
  16706: "GET_GEAR_SETS",
  16707: "UPDATE_GEAR_SETS",
  16708: "UPDATE_GEAR_SETS_RESP",
  16720: "GET_LOBBY_DISCONNECT",
  16721: "GET_LOBBY_DISCONNECT_RESP",
  16928: "GET_CHARACTER_CARD",
  16929: "GET_CHARACTER_CARD_RESP",
  // Game server — game list
  17152: "GET_GAME_LIST",
  17153: "GET_GAME_LIST_START",
  17154: "GET_GAME_LIST_ITEM",
  17155: "GET_GAME_LIST_END",
  17156: "GET_HOST_SETTINGS",
  17157: "GET_HOST_SETTINGS_RESP",
  17168: "CHECK_HOST_SETTINGS",
  17169: "CHECK_HOST_SETTINGS_RESP",
  17170: "GET_GAME_DETAILS",
  17171: "GET_GAME_DETAILS_RESP",
  17174: "CREATE_GAME",
  17175: "CREATE_GAME_RESP",
  17184: "JOIN_GAME",
  17185: "JOIN_GAME_RESP",
  17186: "JOIN_GAME_FAILED",
  // Game server — in-game
  17216: "PLAYER_CONNECTED",
  17217: "PLAYER_CONNECTED_RESP",
  17218: "PLAYER_DISCONNECTED",
  17219: "PLAYER_DISCONNECTED_RESP",
  17220: "SET_PLAYER_TEAM",
  17221: "SET_PLAYER_TEAM_RESP",
  17222: "KICK_PLAYER",
  17223: "KICK_PLAYER_RESP",
  17224: "HOST_PASS",
  17225: "HOST_PASS_RESP",
  17232: "UPDATE_STATS",
  17233: "UPDATE_STATS_RESP",
  17280: "QUIT_GAME",
  17281: "QUIT_GAME_RESP",
  17296: "HOST_UPDATE_STATS",
  17297: "HOST_UPDATE_STATS_RESP",
  17298: "SET_GAME",
  17299: "SET_GAME_RESP",
  17304: "UPDATE_PINGS",
  17305: "UPDATE_PINGS_RESP",
  17312: "PASS_ROUND",
  17313: "PASS_ROUND_RESP",
  17314: "PASS_ROUND_UNK",
  17315: "PASS_ROUND_UNK_RESP",
  17344: "HOST_UNK_43C0",
  17345: "HOST_UNK_43C0_RESP",
  17354: "START_ROUND",
  17355: "START_ROUND_RESP",
  17360: "TRAINING_CONNECT",
  17361: "TRAINING_CONNECT_RESP",
  // Game server — chat
  17408: "SEND_CHAT",
  17409: "SEND_CHAT_RESP",
  17472: "CHAT_UNK_4440",
  17473: "CHAT_UNK_4440_RESP",
  // Game server — friends / blocked
  17664: "ADD_FRIENDS_BLOCKED",
  17665: "ADD_FRIENDS_BLOCKED_RESP",
  17680: "REMOVE_FRIENDS_BLOCKED",
  17681: "REMOVE_FRIENDS_BLOCKED_RESP",
  17792: "GET_FRIENDS_BLOCKED_LIST",
  17793: "GET_FRIENDS_BLOCKED_LIST_RESP",
  // Game server — search / history
  17920: "SEARCH_PLAYER",
  17921: "SEARCH_PLAYER_START",
  17922: "SEARCH_PLAYER_RESULT",
  17923: "SEARCH_PLAYER_END",
  18048: "GET_MATCH_HISTORY",
  18049: "GET_MATCH_HISTORY_1",
  18050: "GET_MATCH_HISTORY_2",
  18051: "GET_MATCH_HISTORY_3",
  // Game server — session auth
  18176: "SESSION_AUTH",
  18177: "SESSION_AUTH_RESP",
  // Game server — messages
  18432: "SEND_MESSAGE",
  18433: "SEND_MESSAGE_RESP",
  18464: "GET_MESSAGES",
  18465: "GET_MESSAGES_START",
  18466: "GET_MESSAGES_ITEM",
  18467: "GET_MESSAGES_END",
  18496: "GET_MESSAGE_CONTENTS",
  18497: "GET_MESSAGE_CONTENTS_RESP",
  18528: "ADD_SENT_MESSAGE",
  18529: "ADD_SENT_MESSAGE_RESP",
  // Game server — flash news
  19024: "FLASH_NEWS",
  // Game server — lobby info
  18688: "GET_GAME_LOBBY_INFO",
  18689: "GET_GAME_LOBBY_INFO_START",
  18690: "GET_GAME_LOBBY_INFO_ITEM",
  18691: "GET_GAME_LOBBY_INFO_END",
  18832: "GET_GAME_ENTRY_INFO",
  18833: "GET_GAME_ENTRY_INFO_RESP",
  // Game server — clans
  19200: "CREATE_CLAN",
  19201: "CREATE_CLAN_RESP",
  19204: "DISBAND_CLAN",
  19205: "DISBAND_CLAN_RESP",
  19216: "GET_CLAN_LIST",
  19217: "GET_CLAN_LIST_START",
  19218: "GET_CLAN_LIST_ITEM",
  19219: "GET_CLAN_LIST_END",
  19232: "GET_CLAN_MEMBER_INFO",
  19233: "GET_CLAN_MEMBER_INFO_RESP",
  19248: "ACCEPT_CLAN_JOIN",
  19249: "ACCEPT_CLAN_JOIN_RESP",
  19250: "DECLINE_CLAN_JOIN",
  19251: "DECLINE_CLAN_JOIN_RESP",
  19254: "BANISH_CLAN_MEMBER",
  19255: "BANISH_CLAN_MEMBER_RESP",
  19264: "LEAVE_CLAN",
  19265: "LEAVE_CLAN_RESP",
  19266: "APPLY_TO_CLAN",
  19267: "APPLY_TO_CLAN_RESP",
  19270: "UPDATE_CLAN_STATE",
  19271: "UPDATE_CLAN_STATE_RESP",
  19272: "GET_CLAN_EMBLEM_LOBBY",
  19273: "GET_CLAN_EMBLEM_LOBBY_RESP",
  19274: "GET_CLAN_EMBLEM",
  19275: "GET_CLAN_EMBLEM_RESP",
  19276: "GET_CLAN_EMBLEM_WIP",
  19277: "GET_CLAN_EMBLEM_WIP_RESP",
  19280: "SET_CLAN_EMBLEM",
  19281: "SET_CLAN_EMBLEM_RESP",
  19282: "GET_CLAN_ROSTER",
  19283: "GET_CLAN_ROSTER_RESP",
  19296: "TRANSFER_CLAN_LEADERSHIP",
  19297: "TRANSFER_CLAN_LEADERSHIP_RESP",
  19298: "SET_EMBLEM_EDITOR",
  19299: "SET_EMBLEM_EDITOR_RESP",
  19300: "UPDATE_CLAN_COMMENT",
  19301: "UPDATE_CLAN_COMMENT_RESP",
  19302: "UPDATE_CLAN_NOTICE",
  19303: "UPDATE_CLAN_NOTICE_RESP",
  19312: "GET_CLAN_STATS",
  19313: "GET_CLAN_STATS_RESP",
  19328: "GET_CLAN_INFO",
  19329: "GET_CLAN_INFO_RESP",
  19344: "SEARCH_CLAN",
  19345: "SEARCH_CLAN_START",
  19346: "SEARCH_CLAN_RESULT",
  19347: "SEARCH_CLAN_END"
};
function cmdHex(cmd) {
  return "0x" + cmd.toString(16).toUpperCase().padStart(4, "0");
}
var WF_NoMove = 4;
var WF_NoResize = 2;
var WF_NoCollapse = 32;
var WF_NoTitleBar = 1;
var WF_MenuBar = 1024;
var TF_RowBg = 64;
var TF_Borders = 1920;
var TF_ScrollY = 33554432;
var TF_SizingFixedFit = 8192;
var CF_WidthFixed = 16;
var CF_WidthStretch = 8;
var SEL_SpanAllColumns = 2;
var BPR = 16;
var MAX_PACKETS = 2e3;
var CSTRING_SCAN_LIMIT = 32;
var SPOOF_SECTION_H = 180;
var SEARCH_TYPES = ["uint8", "uint16", "uint32", "string", "hex"];

// src/ui/utils/hex.ts
function parseHexInput(raw) {
  return raw.replace(/\s+/g, "").toLowerCase();
}
function compactToBytes(compact) {
  const out = new Uint8Array(compact.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToCompact(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function clampCursor(next, nBytes) {
  return Math.max(0, Math.min(nBytes - 1, next));
}

// src/ui/utils/packet.ts
function getSelectedPacket() {
  return state.selectedIdx >= 0 ? state.packets[state.selectedIdx] ?? null : null;
}
function getSelectedRule() {
  const pkt = getSelectedPacket();
  if (!pkt) return null;
  return state.spoofRules.find((r) => r.cmd === pkt.cmd && r.isInbound === pkt.isInbound) ?? null;
}
function getSelectedExcludedRule() {
  const pkt = getSelectedPacket();
  if (!pkt) return null;
  return state.excludedRules.find((r) => r.cmd === pkt.cmd && r.isInbound === pkt.isInbound) ?? null;
}
function getVisiblePayloadHex(pkt) {
  return pkt.spoofedPayload ?? pkt.payload ?? "";
}
function isByteModified(byteOffset) {
  const start = byteOffset * 2;
  return state.detail.compact.slice(start, start + 2) !== state.detail.original.slice(start, start + 2);
}
function isRangeModified(byteLen) {
  const start = state.detail.cursorByte * 2;
  const end = start + byteLen * 2;
  return state.detail.compact.slice(start, end) !== state.detail.original.slice(start, end);
}
function replaceBytesAtCursor(nextBytes) {
  const full = compactToBytes(state.detail.compact);
  const off = state.detail.cursorByte;
  if (off + nextBytes.length > full.length) return false;
  let changed = false;
  for (let i = 0; i < nextBytes.length; i++) {
    if (full[off + i] !== nextBytes[i]) {
      changed = true;
      break;
    }
  }
  if (!changed) return false;
  full.set(nextBytes, off);
  state.detail.compact = bytesToCompact(full);
  return true;
}
function requestPacketSelection(idx) {
  if (idx === state.selectedIdx && !state.editingRule) return;
  state.selectedIdx = idx;
  loadSelectedDetailFromPacket();
}
function loadSelectedDetailFromPacket(preserveSearch = false) {
  state.editingRule = null;
  const pkt = getSelectedPacket();
  if (!pkt) return;
  const visiblePayload = getVisiblePayloadHex(pkt);
  state.detail.lastIdx = state.selectedIdx;
  state.detail.compact = visiblePayload;
  state.detail.original = visiblePayload;
  state.detail.packet = pkt.packet ?? "";
  state.detail.cursorByte = 0;
  state.inspectorEd.key = "";
  state.inspectorEd.cursorKey = "";
  if (!preserveSearch) {
    state.searchState.results = [];
    state.searchState.index = -1;
    state.searchState.selectedPacketKey = packetSearchKey();
  }
}
function packetSearchKey() {
  const pkt = getSelectedPacket();
  return pkt ? `${state.selectedIdx}:${pkt.cmd}:${state.detail.compact.length}` : "";
}
function startEditingRule(rule) {
  state.editingRule = { cmd: rule.cmd, isInbound: rule.isInbound, payloadHex: rule.payloadHex };
  state.selectedIdx = -1;
  state.detail.compact = rule.payloadHex;
  state.detail.original = rule.payloadHex;
  state.detail.packet = "";
  state.detail.lastIdx = -3;
  state.detail.cursorByte = 0;
  state.inspectorEd.key = "";
  state.inspectorEd.cursorKey = "";
  state.searchState.results = [];
  state.searchState.index = -1;
}
function queueSpoofSync() {
  if (state.editingRule) {
    state.pendingSave = {
      cmd: state.editingRule.cmd,
      isInbound: state.editingRule.isInbound,
      payloadHex: state.detail.compact
    };
    return;
  }
  const pkt = getSelectedPacket();
  if (!pkt) return;
  state.pendingSave = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: state.detail.compact };
  if (!getSelectedRule()) {
    const newRule = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: state.detail.compact };
    if (!state.spoofRules.find((r) => r.cmd === newRule.cmd && r.isInbound === newRule.isInbound))
      state.spoofRules.push(newRule);
    state.editingRule = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: state.detail.compact };
    state.selectedIdx = -1;
    state.detail.lastIdx = -3;
    state.detail.packet = "";
    state.searchState.results = [];
    state.searchState.index = -1;
  }
}
function currentPlainPacketCompact() {
  const pkt = getSelectedPacket();
  if (!pkt) return "";
  const packetCompact = state.detail.packet || pkt.packet || "";
  if (!packetCompact || packetCompact.length < 48) return packetCompact;
  return packetCompact.slice(0, 48) + state.detail.compact;
}

// src/ui/websocket.ts
function connectWS() {
  const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}/ws`);
  state.ws = ws;
  ws.onopen = () => {
    state.wsReady = true;
    setStatus("connected");
  };
  ws.onclose = () => {
    state.wsReady = false;
    setStatus("disconnected - retrying...");
    setTimeout(connectWS, 2e3);
  };
  ws.onerror = () => setStatus("WS error");
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.type === "packet") {
      state.packets.push(msg);
      if (state.packets.length > MAX_PACKETS) state.packets.shift();
      if (state.selectedIdx >= state.packets.length) state.selectedIdx = state.packets.length - 1;
    } else if (msg.type === "spoofRules") {
      state.spoofRules.length = 0;
      for (const r of msg.rules) state.spoofRules.push(r);
      if (state.editingRule) {
        const still = state.spoofRules.find(
          (r) => r.cmd === state.editingRule.cmd && r.isInbound === state.editingRule.isInbound
        );
        if (!still) state.editingRule = null;
      }
      if (state.selectedIdx >= 0 && state.packets[state.selectedIdx]) loadSelectedDetailFromPacket();
    } else if (msg.type === "excludedRules") {
      state.excludedRules.length = 0;
      for (const r of msg.rules) state.excludedRules.push(r);
    } else if (msg.type === "spoofingState") {
      state.spoofingEnabled = !!msg.enabled;
    } else if (msg.type === "keepUpstreamState") {
      state.keepUpstreamOpen = !!msg.enabled;
    } else if (msg.type === "tcpStatuses") {
      state.tcpStatuses.length = 0;
      for (const s of msg.statuses) state.tcpStatuses.push(s);
    }
  };
}
function sendWS(obj) {
  if (state.wsReady && state.ws && state.ws.readyState === WebSocket.OPEN)
    state.ws.send(JSON.stringify(obj));
}
function setStatus(txt) {
  const el = document.getElementById("status");
  if (el) el.textContent = txt;
}

// src/ui/components/mainWindow.ts
import { ImGui as ImGui11, ImVec2 as ImVec29 } from "/jsimgui/mod.js";

// src/ui/utils/export.ts
import { ImGui as ImGui2 } from "/jsimgui/mod.js";
function fmtDatetime() {
  const d = /* @__PURE__ */ new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function exportAllPackets() {
  if (state.packets.length === 0) return;
  function csvField(value) {
    const s = value == null ? "" : String(value);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const rows = [["Timestamp", "Direction", "Command ID", "Command Name", "Packet"]];
  for (const pkt of state.packets) {
    rows.push([
      pkt.timestamp,
      pkt.isInbound ? "IN" : "OUT",
      cmdHex(pkt.cmd),
      CMD_NAMES[pkt.cmd] ?? "",
      pkt.packet ?? ""
    ]);
  }
  const csv = rows.map((r) => r.map(csvField).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
  triggerDownload(blob, `capture-${fmtDatetime()}.csv`);
}
function exportCurrentPacket() {
  const compact = currentPlainPacketCompact();
  if (!compact) return;
  const bytes = compactToBytes(compact);
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const pkt = getSelectedPacket();
  triggerDownload(blob, `${cmdHex(pkt?.cmd ?? 0).slice(2)}-${pkt?.isInbound ? "in" : "out"}-${fmtDatetime()}.bin`);
}
function copyCurrentPacket() {
  const compact = currentPlainPacketCompact();
  if (!compact) return;
  const text = compact.toUpperCase();
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
  } catch {
  }
  ImGui2.SetClipboardText(text);
}
function exportCurrentRule() {
  if (!state.editingRule || !state.detail.compact) return;
  const bytes = compactToBytes(state.detail.compact);
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  triggerDownload(
    blob,
    `${cmdHex(state.editingRule.cmd).slice(2)}-${state.editingRule.isInbound ? "in" : "out"}-${fmtDatetime()}.bin`
  );
}
function copyCurrentRule() {
  if (!state.editingRule || !state.detail.compact) return;
  const text = state.detail.compact.toUpperCase();
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
  } catch {
  }
  ImGui2.SetClipboardText(text);
}

// src/ui/components/packetList.ts
import { ImGui as ImGui3, ImVec2 } from "/jsimgui/mod.js";
function renderPacketList() {
  if (!ImGui3.BeginTabBar("##lp_tabs")) return;
  try {
    if (!ImGui3.BeginTabItem(`Packets (${state.packets.length})##lp_tab`)) return;
    try {
      const flags = TF_ScrollY | TF_Borders | TF_RowBg | TF_SizingFixedFit;
      if (ImGui3.BeginTable("##pl", 3, flags, new ImVec2(0, -1))) {
        try {
          ImGui3.TableSetupScrollFreeze(0, 1);
          ImGui3.TableSetupColumn("Dir", CF_WidthFixed, 36);
          ImGui3.TableSetupColumn("ID", CF_WidthFixed, 54);
          ImGui3.TableSetupColumn("Name", CF_WidthStretch, 0);
          ImGui3.TableHeadersRow();
          for (let i = 0; i < state.packets.length; i++) {
            const pkt = state.packets[i];
            ImGui3.PushStyleColor(0, pkt.isInbound ? COL_GREEN : COL_PURPLE);
            ImGui3.TableNextRow();
            ImGui3.TableSetColumnIndex(0);
            if (ImGui3.Selectable(
              `${pkt.isInbound ? "IN" : "OUT"}##r${i}`,
              state.selectedIdx === i,
              SEL_SpanAllColumns
            )) requestPacketSelection(i);
            ImGui3.TableSetColumnIndex(1);
            ImGui3.Text(cmdHex(pkt.cmd));
            ImGui3.TableSetColumnIndex(2);
            ImGui3.Text(CMD_NAMES[pkt.cmd] ?? "");
            ImGui3.PopStyleColor(1);
          }
          if (state.autoScroll) ImGui3.SetScrollHereY(1);
        } finally {
          ImGui3.EndTable();
        }
      }
    } finally {
      ImGui3.EndTabItem();
    }
  } finally {
    ImGui3.EndTabBar();
  }
}

// src/ui/components/centerPanel.ts
import { ImGui as ImGui6, ImVec2 as ImVec24 } from "/jsimgui/mod.js";

// src/ui/components/hexTable.ts
import { ImGui as ImGui4, ImVec2 as ImVec22 } from "/jsimgui/mod.js";

// src/ui/utils/search.ts
function buildSearchNeedle(type, value) {
  try {
    if (type === "string") {
      const bytes = new TextEncoder().encode(value);
      return bytes.length ? bytes : null;
    }
    if (type === "hex") {
      const compact = parseHexInput(value);
      if (!compact || compact.length % 2 !== 0) return null;
      return compactToBytes(compact);
    }
    if (type === "uint8") {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 255) return null;
      return Uint8Array.of(num);
    }
    if (type === "uint16") {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 65535) return null;
      const out = new Uint8Array(2);
      new DataView(out.buffer).setUint16(0, num, false);
      return out;
    }
    if (type === "uint32") {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 4294967295) return null;
      const out = new Uint8Array(4);
      new DataView(out.buffer).setUint32(0, num >>> 0, false);
      return out;
    }
  } catch {
  }
  return null;
}
function runSearch() {
  const needle = buildSearchNeedle(state.searchState.type, state.searchState.value);
  state.searchState.results = [];
  state.searchState.index = -1;
  state.searchState.selectedPacketKey = packetSearchKey();
  if (!needle || needle.length === 0) return;
  for (let packetIdx = 0; packetIdx < state.packets.length; packetIdx++) {
    const pkt = state.packets[packetIdx];
    if (state.searchState.direction === "in" && !pkt.isInbound) continue;
    if (state.searchState.direction === "out" && pkt.isInbound) continue;
    const payloadHex = getVisiblePayloadHex(pkt);
    const haystack = payloadHex ? compactToBytes(payloadHex) : null;
    if (!haystack || needle.length > haystack.length) continue;
    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let match = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        state.searchState.results.push({ packetIdx, start: i, len: needle.length });
      }
    }
  }
  if (state.searchState.results.length > 0) {
    state.searchState.index = 0;
    const first = state.searchState.results[0];
    state.selectedIdx = first.packetIdx;
    loadSelectedDetailFromPacket(true);
    state.detail.cursorByte = first.start;
  }
}
function currentSearchMatch() {
  const { index, results } = state.searchState;
  if (index < 0 || index >= results.length) return null;
  return results[index];
}
function searchMove(delta) {
  if (state.searchState.results.length === 0) return;
  state.searchState.index = (state.searchState.index + delta + state.searchState.results.length) % state.searchState.results.length;
  const match = state.searchState.results[state.searchState.index];
  if (state.selectedIdx !== match.packetIdx) {
    state.selectedIdx = match.packetIdx;
    loadSelectedDetailFromPacket(true);
  }
  state.detail.cursorByte = match.start;
}
function isSearchHighlighted(byteOffset) {
  const match = currentSearchMatch();
  return !!match && match.packetIdx === state.selectedIdx && byteOffset >= match.start && byteOffset < match.start + match.len;
}

// src/ui/components/hexTable.ts
function renderHexTable(compact, tableH) {
  if (!compact || compact.length < 2) return;
  const nBytes = compact.length / 2;
  const nCols = 1 + BPR + 1;
  const flags = TF_ScrollY | TF_Borders | TF_RowBg;
  if (!ImGui4.BeginTable("##ht", nCols, flags, new ImVec22(0, tableH))) return;
  ImGui4.TableSetupScrollFreeze(0, 1);
  ImGui4.TableSetupColumn("Offset", CF_WidthFixed, 72);
  for (let i = 0; i < BPR; i++) {
    const hdr = i.toString(16).toUpperCase().padStart(2, "0");
    ImGui4.TableSetupColumn(hdr, CF_WidthFixed, i === 8 ? 26 : 22);
  }
  ImGui4.TableSetupColumn("Decoded text", CF_WidthFixed, 134);
  ImGui4.TableHeadersRow();
  for (let row = 0; row < nBytes; row += BPR) {
    ImGui4.TableNextRow();
    ImGui4.TableSetColumnIndex(0);
    ImGui4.TextDisabled(row.toString(16).toUpperCase().padStart(8, "0"));
    for (let b = 0; b < BPR; b++) {
      const off = row + b;
      ImGui4.TableSetColumnIndex(b + 1);
      if (off < nBytes) {
        const hexByte = compact.slice(off * 2, off * 2 + 2).toUpperCase();
        const isCursor = off === state.detail.cursorByte;
        const modified = isByteModified(off);
        const searched = isSearchHighlighted(off);
        if (searched) ImGui4.PushStyleColor(IMGUI_COL_TEXT, COL_BLUE);
        else if (modified) ImGui4.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
        if (ImGui4.Selectable(`${hexByte}##b${off}`, isCursor, 0)) {
          state.detail.cursorByte = off;
        }
        if (searched || modified) ImGui4.PopStyleColor(1);
      }
    }
    ImGui4.TableSetColumnIndex(BPR + 1);
    let ascii = "";
    let rowModified = false;
    let rowSearched = false;
    for (let b = 0; b < BPR; b++) {
      const off = row + b;
      if (off < nBytes) {
        const byte = parseInt(compact.slice(off * 2, off * 2 + 2), 16);
        ascii += byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".";
        rowModified ||= isByteModified(off);
        rowSearched ||= isSearchHighlighted(off);
      }
    }
    if (rowSearched) ImGui4.PushStyleColor(IMGUI_COL_TEXT, COL_BLUE);
    else if (rowModified) ImGui4.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
    ImGui4.TextDisabled(ascii);
    if (rowSearched || rowModified) ImGui4.PopStyleColor(1);
  }
  ImGui4.EndTable();
}
function handleHexCursorKeys(compact) {
  if (!compact || ImGui4.IsAnyItemActive()) return;
  const nBytes = compact.length / 2;
  if (nBytes <= 0) return;
  const key = ImGui4.Key;
  let next = state.detail.cursorByte;
  if (key && ImGui4.IsKeyPressed(key._LeftArrow)) next -= 1;
  if (key && ImGui4.IsKeyPressed(key._RightArrow)) next += 1;
  if (key && ImGui4.IsKeyPressed(key._UpArrow)) next -= BPR;
  if (key && ImGui4.IsKeyPressed(key._DownArrow)) next += BPR;
  state.detail.cursorByte = clampCursor(next, nBytes);
}

// src/ui/components/spoofRules.ts
import { ImGui as ImGui5, ImVec2 as ImVec23 } from "/jsimgui/mod.js";
function renderSpoofRulesSection() {
  const actionGap = 6;
  const spoofingWasEnabled = state.spoofingEnabled;
  ImGui5.Dummy(new ImVec23(0, 4));
  if (spoofingWasEnabled) {
    ImGui5.PushStyleColor(IMGUI_COL_BUTTON, col32(0.8, 0.24, 0.24, 1));
    ImGui5.PushStyleColor(IMGUI_COL_BUTTON_HOVERED, col32(0.92, 0.3, 0.3, 1));
    ImGui5.PushStyleColor(IMGUI_COL_BUTTON_ACTIVE, col32(0.68, 0.18, 0.18, 1));
  }
  if (ImGui5.Button(state.spoofingEnabled ? "Stop testing" : "Start testing")) {
    state.pendingSpoofingEnabled = !state.spoofingEnabled;
    state.spoofingEnabled = !state.spoofingEnabled;
  }
  if (spoofingWasEnabled) ImGui5.PopStyleColor(3);
  ImGui5.SameLine(0, actionGap);
  if (ImGui5.Button("Clear rules")) state.showClearRulesConfirm = true;
  ImGui5.Dummy(new ImVec23(0, 4));
  ImGui5.Spacing();
  ImGui5.TextDisabled(`Test Rules (${state.spoofRules.length})`);
  if (state.spoofRules.length === 0) {
    ImGui5.TextDisabled("  No active rules.");
    return;
  }
  const flags = TF_Borders | TF_RowBg | TF_SizingFixedFit | TF_ScrollY;
  if (!ImGui5.BeginTable("##sr", 4, flags, new ImVec23(0, -1))) return;
  try {
    ImGui5.TableSetupScrollFreeze(0, 1);
    ImGui5.TableSetupColumn("Dir", CF_WidthFixed, 28);
    ImGui5.TableSetupColumn("ID", CF_WidthFixed, 56);
    ImGui5.TableSetupColumn("Name", CF_WidthStretch, 0);
    ImGui5.TableSetupColumn("Actions", CF_WidthFixed, 112);
    ImGui5.TableHeadersRow();
    for (const rule of state.spoofRules) {
      const k = `${rule.isInbound ? 1 : 0}_${rule.cmd}`;
      const rowHeight = 30;
      const textOffsetY = Math.max(0, Math.floor((rowHeight - ImGui5.GetTextLineHeight()) * 0.5) - 1);
      const btnOffsetY = Math.max(0, Math.floor((rowHeight - 24) * 0.5));
      ImGui5.PushStyleColor(0, rule.isInbound ? COL_GREEN : COL_PURPLE);
      ImGui5.TableNextRow(0, rowHeight);
      ImGui5.TableSetColumnIndex(0);
      ImGui5.SetCursorPosY(ImGui5.GetCursorPosY() + textOffsetY);
      ImGui5.Text(rule.isInbound ? "IN" : "OUT");
      ImGui5.PopStyleColor(1);
      ImGui5.TableSetColumnIndex(1);
      ImGui5.SetCursorPosY(ImGui5.GetCursorPosY() + textOffsetY);
      ImGui5.Text(cmdHex(rule.cmd));
      ImGui5.TableSetColumnIndex(2);
      ImGui5.SetCursorPosY(ImGui5.GetCursorPosY() + textOffsetY);
      ImGui5.Text(CMD_NAMES[rule.cmd] ?? "");
      ImGui5.TableSetColumnIndex(3);
      ImGui5.SetCursorPosY(ImGui5.GetCursorPosY() + btnOffsetY);
      if (ImGui5.Button(`Edit##${k}`)) startEditingRule(rule);
      ImGui5.SameLine(0, 4);
      if (ImGui5.Button(`Delete##${k}`))
        state.pendingDeleteConfirmRule = { cmd: rule.cmd, isInbound: rule.isInbound };
    }
  } finally {
    ImGui5.EndTable();
  }
}

// src/ui/components/centerPanel.ts
function renderCenterPanel() {
  const hasSel = state.selectedIdx >= 0 && state.packets[state.selectedIdx] != null;
  ImGui6.BeginChild("##cptop", new ImVec24(0, -(SPOOF_SECTION_H + 6)), 0, 0);
  try {
    if (state.editingRule) {
      ImGui6.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
      ImGui6.Text("Rule");
      ImGui6.PopStyleColor(1);
      ImGui6.SameLine(0, 8);
      ImGui6.Text(cmdHex(state.editingRule.cmd));
      if (CMD_NAMES[state.editingRule.cmd]) {
        ImGui6.SameLine(0, 8);
        ImGui6.Text(CMD_NAMES[state.editingRule.cmd]);
      }
      ImGui6.Separator();
      renderHexTable(state.detail.compact, -1);
      handleHexCursorKeys(state.detail.compact);
    } else if (!hasSel) {
      ImGui6.Spacing();
      ImGui6.TextDisabled("  No packet selected.");
      ImGui6.TextDisabled("  Click a row in the packet list on the left.");
    } else {
      const pkt = state.packets[state.selectedIdx];
      if (state.detail.lastIdx !== state.selectedIdx) {
        loadSelectedDetailFromPacket();
      }
      ImGui6.PushStyleColor(IMGUI_COL_TEXT, pkt.isInbound ? COL_GREEN : COL_PURPLE);
      ImGui6.Text(pkt.isInbound ? "IN" : "OUT");
      ImGui6.PopStyleColor(1);
      ImGui6.SameLine(0, 8);
      ImGui6.Text(cmdHex(pkt.cmd));
      if (CMD_NAMES[pkt.cmd]) {
        ImGui6.SameLine(0, 8);
        ImGui6.Text(CMD_NAMES[pkt.cmd]);
      }
      ImGui6.SameLine(0, 12);
      ImGui6.TextDisabled(`${pkt.payloadLen} bytes`);
      ImGui6.Separator();
      renderHexTable(state.detail.compact, -1);
      handleHexCursorKeys(state.detail.compact);
    }
  } finally {
    ImGui6.EndChild();
  }
  if (state.spoofRules.length === 0) ImGui6.Separator();
  ImGui6.BeginChild("##ss", new ImVec24(0, SPOOF_SECTION_H), 0, 0);
  try {
    renderSpoofRulesSection();
  } finally {
    ImGui6.EndChild();
  }
}

// src/ui/components/rightSidebar.ts
import { ImGui as ImGui8, ImVec2 as ImVec26 } from "/jsimgui/mod.js";

// src/ui/components/dataInspector.ts
import { ImGui as ImGui7 } from "/jsimgui/mod.js";
function decodePrintableAscii(bytes) {
  let out = "";
  for (const byte of bytes) out += byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".";
  return out;
}
function encodeAsciiPatch(text, prevBytes) {
  const out = Uint8Array.from(prevBytes);
  for (let i = 0; i < Math.min(text.length, out.length); i++) {
    const ch = text[i];
    out[i] = ch === "." ? prevBytes[i] : ch.charCodeAt(0) & 255;
  }
  return out;
}
function decodeCString(bytes) {
  const nul = bytes.indexOf(0);
  const view = nul === -1 ? bytes : bytes.slice(0, nul);
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(view);
  } catch {
    return "";
  }
}
function encodeCString(text, fieldLen) {
  const out = new Uint8Array(fieldLen);
  const bytes = new TextEncoder().encode(text);
  out.set(bytes.slice(0, fieldLen - 1));
  return out;
}
function syncInspectorFields(buf, dv, n) {
  const off = state.detail.cursorByte;
  const cursorKey = `${state.detail.lastIdx}:${off}`;
  const key = `${cursorKey}:${state.detail.compact}`;
  const cstringByteKey = String(off);
  const cstringByteChanged = state.inspectorEd.cstringByteKey !== cstringByteKey;
  if (cstringByteChanged) {
    state.inspectorEd.cstringByteKey = cstringByteKey;
    const scanLimit = Math.min(CSTRING_SCAN_LIMIT, n);
    const nullAt = buf.slice(0, scanLimit).indexOf(0);
    if (nullAt === -1) {
      state.inspectorEd.cStringLen = scanLimit;
    } else if (nullAt === 0) {
      let runEnd = 1;
      while (runEnd < scanLimit && buf[runEnd] === 0) runEnd++;
      state.inspectorEd.cStringLen = runEnd;
    } else {
      state.inspectorEd.cStringLen = nullAt + 1;
    }
    state.inspectorEd.fields["cstring"] = decodeCString(buf.slice(0, scanLimit));
  }
  const cursorMoved = state.inspectorEd.cursorKey !== cursorKey;
  if (cursorMoved) state.inspectorEd.cursorKey = cursorKey;
  if (state.inspectorEd.key === key) return;
  state.inspectorEd.key = key;
  state.inspectorEd.fields = {
    uint8: n >= 1 ? String(dv.getUint8(0)) : "",
    int8: n >= 1 ? String(dv.getInt8(0)) : "",
    uint16: n >= 2 ? String(dv.getUint16(0, false)) : "",
    int16: n >= 2 ? String(dv.getInt16(0, false)) : "",
    uint32: n >= 4 ? String(dv.getUint32(0, false)) : "",
    int32: n >= 4 ? String(dv.getInt32(0, false)) : "",
    uint64: n >= 8 ? dv.getBigUint64(0, false).toString() : "",
    int64: n >= 8 ? dv.getBigInt64(0, false).toString() : "",
    float32: n >= 4 ? String(dv.getFloat32(0, false)) : "",
    float64: n >= 8 ? String(dv.getFloat64(0, false)) : "",
    binary: n >= 1 ? dv.getUint8(0).toString(2).padStart(8, "0") : "",
    string: decodePrintableAscii(buf.slice(0, Math.min(26, n))),
    cstring: state.inspectorEd.fields["cstring"] ?? ""
  };
}
function renderDataInspector() {
  const compact = state.detail.compact;
  const off = state.detail.cursorByte;
  ImGui7.TextDisabled(`Cursor  0x${off.toString(16).toUpperCase().padStart(8, "0")}`);
  ImGui7.Separator();
  if (!compact || compact.length < 2 || off * 2 >= compact.length) {
    ImGui7.TextDisabled("(no data at cursor)");
    return;
  }
  const slice = compact.slice(off * 2);
  const n = slice.length / 2;
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = parseInt(slice.slice(i * 2, i * 2 + 2), 16);
  const dv = new DataView(buf.buffer);
  syncInspectorFields(buf, dv, n);
  const flags = TF_Borders | TF_RowBg | TF_SizingFixedFit;
  if (!ImGui7.BeginTable("##di", 2, flags)) return;
  ImGui7.TableSetupColumn("Type", CF_WidthFixed, 80);
  ImGui7.TableSetupColumn("Value", CF_WidthStretch, 0);
  ImGui7.TableHeadersRow();
  function renderRowLabel(label, modified) {
    if (modified) ImGui7.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
    ImGui7.TextDisabled(label);
    if (modified) ImGui7.PopStyleColor(1);
  }
  function row(label, val, modified = false) {
    ImGui7.TableNextRow();
    ImGui7.TableSetColumnIndex(0);
    renderRowLabel(label, modified);
    ImGui7.TableSetColumnIndex(1);
    ImGui7.Text(String(val));
  }
  function na(label, modified = false) {
    ImGui7.TableNextRow();
    ImGui7.TableSetColumnIndex(0);
    renderRowLabel(label, modified);
    ImGui7.TableSetColumnIndex(1);
    ImGui7.TextDisabled("--");
  }
  function editRow(label, fieldKey, byteLen, parseToBytes) {
    const modified = isRangeModified(byteLen);
    ImGui7.TableNextRow();
    ImGui7.TableSetColumnIndex(0);
    renderRowLabel(label, modified);
    ImGui7.TableSetColumnIndex(1);
    ImGui7.SetNextItemWidth(-1);
    const bufRef = [state.inspectorEd.fields[fieldKey] ?? ""];
    ImGui7.PushStyleColor(IMGUI_COL_FRAME_BG, col32(0, 0, 0, 0));
    ImGui7.PushStyleColor(IMGUI_COL_FRAME_BG_HOVERED, col32(0.28, 0.33, 0.42, 0.38));
    ImGui7.PushStyleColor(IMGUI_COL_FRAME_BG_ACTIVE, col32(0, 0, 0, 0));
    if (ImGui7.InputText(`##${fieldKey}`, bufRef, 256)) {
      state.inspectorEd.fields[fieldKey] = bufRef[0];
      const nextBytes = parseToBytes(bufRef[0]);
      if (nextBytes && replaceBytesAtCursor(nextBytes)) queueSpoofSync();
    }
    ImGui7.PopStyleColor(3);
  }
  n >= 1 ? editRow("uint8", "uint8", 1, (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    return Uint8Array.of(num);
  }) : na("uint8");
  n >= 1 ? editRow("int8", "int8", 1, (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < -128 || num > 127) return null;
    const out = new Uint8Array(1);
    new DataView(out.buffer).setInt8(0, num);
    return out;
  }) : na("int8");
  n >= 2 ? editRow("uint16", "uint16", 2, (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 65535) return null;
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, num, false);
    return out;
  }) : na("uint16");
  n >= 2 ? editRow("int16", "int16", 2, (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < -32768 || num > 32767) return null;
    const out = new Uint8Array(2);
    new DataView(out.buffer).setInt16(0, num, false);
    return out;
  }) : na("int16");
  n >= 4 ? editRow("uint32", "uint32", 4, (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 4294967295) return null;
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, num >>> 0, false);
    return out;
  }) : na("uint32");
  n >= 4 ? editRow("int32", "int32", 4, (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < -2147483648 || num > 2147483647) return null;
    const out = new Uint8Array(4);
    new DataView(out.buffer).setInt32(0, num | 0, false);
    return out;
  }) : na("int32");
  try {
    n >= 8 ? editRow("uint64", "uint64", 8, (value) => {
      try {
        const num = BigInt(value);
        if (num < 0n || num > 0xffffffffffffffffn) return null;
        const out = new Uint8Array(8);
        new DataView(out.buffer).setBigUint64(0, num, false);
        return out;
      } catch {
        return null;
      }
    }) : na("uint64");
    n >= 8 ? editRow("int64", "int64", 8, (value) => {
      try {
        const num = BigInt(value);
        if (num < -0x8000000000000000n || num > 0x7fffffffffffffffn) return null;
        const out = new Uint8Array(8);
        new DataView(out.buffer).setBigInt64(0, num, false);
        return out;
      } catch {
        return null;
      }
    }) : na("int64");
  } catch {
    na("uint64");
    na("int64");
  }
  n >= 4 ? editRow("float32", "float32", 4, (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const out = new Uint8Array(4);
    new DataView(out.buffer).setFloat32(0, num, false);
    return out;
  }) : na("float32");
  n >= 8 ? editRow("float64", "float64", 8, (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const out = new Uint8Array(8);
    new DataView(out.buffer).setFloat64(0, num, false);
    return out;
  }) : na("float64");
  n >= 1 ? editRow("binary", "binary", 1, (value) => {
    if (!/^[01]{1,8}$/.test(value)) return null;
    return Uint8Array.of(parseInt(value.padStart(8, "0"), 2));
  }) : na("binary");
  n >= 1 ? editRow("string", "string", Math.min(26, n), (value) => {
    return encodeAsciiPatch(value.slice(0, Math.min(26, n)), buf.slice(0, Math.min(26, n)));
  }) : na("string");
  const cStringLen = state.inspectorEd.cStringLen;
  n >= 1 ? editRow("cstring", "cstring", cStringLen, (value) => {
    return encodeCString(value, cStringLen);
  }) : na("cstring");
  ImGui7.EndTable();
}

// src/ui/components/rightSidebar.ts
function renderRightSidebar(vpH) {
  const inspectorH = Math.floor((vpH - 48) * 0.62);
  ImGui8.BeginChild("##di_pane", new ImVec26(0, inspectorH), 0, 0);
  try {
    if (ImGui8.BeginTabBar("##inspector_tabs")) {
      try {
        if (ImGui8.BeginTabItem("Data Inspector")) {
          renderDataInspector();
          ImGui8.EndTabItem();
        }
      } finally {
        ImGui8.EndTabBar();
      }
    }
  } finally {
    ImGui8.EndChild();
  }
  ImGui8.BeginChild("##actions_pane", new ImVec26(0, 0), 0, 0);
  try {
    if (ImGui8.BeginTabBar("##actions_tabs")) {
      try {
        if (ImGui8.BeginTabItem("Actions")) {
          const hasSel = state.selectedIdx >= 0 && state.packets[state.selectedIdx] != null;
          if (!hasSel && !state.editingRule) {
            ImGui8.TextDisabled("No packet selected.");
          } else if (state.editingRule) {
            ImGui8.Spacing();
            const actionGap = 6;
            const actionW = Math.floor((ImGui8.GetContentRegionAvail().x - actionGap) / 2);
            if (ImGui8.Button("Export##rule", new ImVec26(actionW, 0))) exportCurrentRule();
            ImGui8.SameLine(0, actionGap);
            if (ImGui8.Button("Copy##rule", new ImVec26(actionW, 0))) copyCurrentRule();
          } else if (hasSel) {
            const pkt = state.packets[state.selectedIdx];
            ImGui8.Spacing();
            const actionGap = 6;
            const actionW = Math.floor((ImGui8.GetContentRegionAvail().x - actionGap) / 2);
            if (ImGui8.Button("Export", new ImVec26(actionW, 0))) exportCurrentPacket();
            ImGui8.SameLine(0, actionGap);
            if (ImGui8.Button("Copy", new ImVec26(actionW, 0))) copyCurrentPacket();
            ImGui8.Spacing();
            const excludeFuture = [!!getSelectedExcludedRule()];
            if (ImGui8.Checkbox("Must ignore", excludeFuture)) {
              state.pendingExcludedRule = {
                cmd: pkt.cmd,
                isInbound: pkt.isInbound,
                enabled: excludeFuture[0]
              };
            }
          }
          ImGui8.EndTabItem();
        }
      } finally {
        ImGui8.EndTabBar();
      }
    }
  } finally {
    ImGui8.EndChild();
  }
}

// src/ui/components/searchWindow.ts
import { ImGui as ImGui9, ImVec2 as ImVec27 } from "/jsimgui/mod.js";
function renderSearchWindow(vpW, _vpH) {
  if (!state.searchState.open) return;
  const winW = 284;
  const winH = 96;
  ImGui9.SetNextWindowPos(new ImVec27(vpW - winW - 8, 28), 4);
  ImGui9.SetNextWindowSize(new ImVec27(winW, winH), 4);
  const swOpen = [true];
  ImGui9.Begin("Search value", swOpen, WF_NoResize);
  if (!swOpen[0]) state.searchState.open = false;
  try {
    ImGui9.SetNextItemWidth(-50);
    const valueRef = [state.searchState.value];
    if (ImGui9.InputText("##search_value", valueRef, 256)) state.searchState.value = valueRef[0];
    ImGui9.SameLine(0, 4);
    if (ImGui9.Button("Find##sf")) runSearch();
    const gap = 4;
    ImGui9.SetNextItemWidth(76);
    if (ImGui9.BeginCombo("##search_type_combo", state.searchState.type)) {
      try {
        for (const type of SEARCH_TYPES) {
          if (ImGui9.Selectable(`${type}##search_window_type_${type}`, state.searchState.type === type))
            state.searchState.type = type;
        }
      } finally {
        ImGui9.EndCombo();
      }
    }
    ImGui9.SameLine(0, gap);
    const SEARCH_DIRECTIONS = ["in/out", "in", "out"];
    const dirLabel = state.searchState.direction === "both" ? "in/out" : state.searchState.direction;
    ImGui9.SetNextItemWidth(76);
    if (ImGui9.BeginCombo("##search_direction_combo", dirLabel)) {
      try {
        for (const d of SEARCH_DIRECTIONS) {
          const val = d === "in/out" ? "both" : d;
          if (ImGui9.Selectable(`${d}##search_window_direction_${d}`, state.searchState.direction === val))
            state.searchState.direction = val;
        }
      } finally {
        ImGui9.EndCombo();
      }
    }
    ImGui9.SameLine(0, gap);
    ImGui9.BeginDisabled(state.searchState.results.length === 0);
    if (ImGui9.Button("Previous")) searchMove(-1);
    ImGui9.SameLine(0, gap);
    if (ImGui9.Button("Next")) searchMove(1);
    ImGui9.EndDisabled();
    const resultText = state.searchState.results.length === 0 ? "No results" : `${state.searchState.index + 1} / ${state.searchState.results.length}`;
    ImGui9.TextDisabled(resultText);
  } finally {
    ImGui9.End();
  }
}

// src/ui/components/modals.ts
import { ImGui as ImGui10, ImVec2 as ImVec28 } from "/jsimgui/mod.js";
function renderClearRulesConfirmModal(vpW, vpH) {
  if (!state.showClearRulesConfirm) return;
  ImGui10.SetNextWindowPos(
    new ImVec28(Math.floor((vpW - 320) * 0.5), Math.floor((vpH - 90) * 0.5)),
    4
  );
  ImGui10.SetNextWindowSize(new ImVec28(320, 90), 4);
  ImGui10.Begin("Clear Test Rules", null, WF_NoResize);
  try {
    ImGui10.TextWrapped(
      `Clear all ${state.spoofRules.length} test rule${state.spoofRules.length !== 1 ? "s" : ""}? This cannot be undone.`
    );
    if (ImGui10.Button("Clear all")) {
      state.pendingClearRules = true;
      state.showClearRulesConfirm = false;
    }
    ImGui10.SameLine(0, 8);
    if (ImGui10.Button("Cancel")) state.showClearRulesConfirm = false;
  } finally {
    ImGui10.End();
  }
}
function renderDeleteRuleConfirmModal(vpW, vpH) {
  if (!state.pendingDeleteConfirmRule) return;
  ImGui10.SetNextWindowPos(
    new ImVec28(Math.floor((vpW - 360) * 0.5), Math.floor((vpH - 90) * 0.5)),
    4
  );
  ImGui10.SetNextWindowSize(new ImVec28(360, 90), 4);
  ImGui10.Begin("Delete Test Rule", null, WF_NoResize);
  try {
    const r = state.pendingDeleteConfirmRule;
    const rName = state.spoofRules.find((sr) => sr.cmd === r.cmd)?.cmd ? ` ${r["name"] ?? ""}` : "";
    ImGui10.TextWrapped(`Delete test rule for 0x${r.cmd.toString(16).toUpperCase().padStart(4, "0")} (${r.isInbound ? "IN" : "OUT"})?`);
    if (ImGui10.Button("Delete")) {
      state.pendingDelete = { cmd: r.cmd, isInbound: r.isInbound };
      if (state.editingRule && state.editingRule.cmd === r.cmd && state.editingRule.isInbound === r.isInbound) {
        state.editingRule = null;
        state.detail.lastIdx = -2;
      }
      state.pendingDeleteConfirmRule = null;
    }
    ImGui10.SameLine(0, 8);
    if (ImGui10.Button("Cancel")) state.pendingDeleteConfirmRule = null;
  } finally {
    ImGui10.End();
  }
}
function renderDisableKeepUpstreamConfirmModal(vpW, vpH) {
  if (!state.showDisableKeepUpstreamConfirm) return;
  ImGui10.SetNextWindowPos(
    new ImVec28(Math.floor((vpW - 340) * 0.5), Math.floor((vpH - 90) * 0.5)),
    4
  );
  ImGui10.SetNextWindowSize(new ImVec28(340, 90), 4);
  ImGui10.Begin("Close upstream connections", null, WF_NoResize);
  try {
    ImGui10.TextWrapped("Active upstream connections will be closed. Continue?");
    if (ImGui10.Button("Close connections")) {
      state.keepUpstreamOpen = false;
      state.pendingKeepUpstreamOpen = false;
      state.pendingForceCloseUpstream = true;
      state.showDisableKeepUpstreamConfirm = false;
    }
    ImGui10.SameLine(0, 8);
    if (ImGui10.Button("Cancel")) state.showDisableKeepUpstreamConfirm = false;
  } finally {
    ImGui10.End();
  }
}
function renderConnectionStateModal(vpW, vpH) {
  if (!state.showConnectionStateModal) return;
  ImGui10.SetNextWindowPos(
    new ImVec28(Math.floor((vpW - 210) * 0.5), Math.floor((vpH - 68) * 0.5)),
    4
  );
  ImGui10.SetNextWindowSize(new ImVec28(210, 68), 4);
  const openRef = [state.showConnectionStateModal];
  ImGui10.Begin("Connection State", openRef, WF_NoResize);
  state.showConnectionStateModal = openRef[0];
  try {
    const activePorts = state.tcpStatuses.filter((s) => s.connected).map((s) => String(s.port));
    ImGui10.TextDisabled("Upstream");
    ImGui10.SameLine(0, 8);
    ImGui10.PushStyleColor(0, activePorts.length ? COL_GREEN : COL_RED);
    ImGui10.Text(activePorts.length ? activePorts.join(", ") : "None");
    ImGui10.PopStyleColor(1);
    ImGui10.TextDisabled("WebSocket");
    ImGui10.SameLine(0, 8);
    ImGui10.PushStyleColor(0, state.wsReady ? COL_GREEN : COL_RED);
    ImGui10.Text(state.wsReady ? "connected" : "disconnected");
    ImGui10.PopStyleColor(1);
  } finally {
    ImGui10.End();
  }
}

// src/ui/components/mainWindow.ts
function renderMainWindow(vpW, vpH) {
  if (state.spoofingEnabled) {
    ImGui11.PushStyleColor(IMGUI_COL_MENUBAR_BG, COL_TESTING_BG);
  }
  ImGui11.SetNextWindowPos(new ImVec29(0, 0));
  ImGui11.SetNextWindowSize(new ImVec29(vpW, vpH));
  ImGui11.Begin(
    "##main",
    null,
    WF_NoMove | WF_NoResize | WF_NoCollapse | WF_NoTitleBar | WF_MenuBar
  );
  if (state.spoofingEnabled) ImGui11.PopStyleColor(1);
  try {
    if (ImGui11.BeginMenuBar()) {
      try {
        ImGui11.Text("MGO2 SCANNER");
        if (state.spoofingEnabled) {
          ImGui11.SameLine(0, 12);
          ImGui11.Text("[TESTING]");
        }
        ImGui11.SameLine(0, 20);
        if (ImGui11.BeginMenu("View")) {
          if (ImGui11.MenuItem("Auto-scroll", "", state.autoScroll)) state.autoScroll = !state.autoScroll;
          if (ImGui11.MenuItem("Keep upstream open", "", state.keepUpstreamOpen)) {
            if (state.keepUpstreamOpen && state.tcpStatuses.some((s) => s.connected)) {
              state.showDisableKeepUpstreamConfirm = true;
            } else {
              state.keepUpstreamOpen = !state.keepUpstreamOpen;
              state.pendingKeepUpstreamOpen = state.keepUpstreamOpen;
            }
          }
          ImGui11.Separator();
          if (ImGui11.MenuItem("Connection State")) state.showConnectionStateModal = true;
          ImGui11.EndMenu();
        }
        if (ImGui11.BeginMenu("Edit")) {
          if (ImGui11.MenuItem("Clear Packets")) {
            state.packets.length = 0;
            state.selectedIdx = -1;
            state.detail.compact = "";
            state.detail.original = "";
            state.detail.packet = "";
            state.detail.lastIdx = -2;
            state.detail.cursorByte = 0;
          }
          if (ImGui11.MenuItem("Clear Test Rules")) state.showClearRulesConfirm = true;
          ImGui11.Separator();
          if (ImGui11.MenuItem("Search value")) state.searchState.open = true;
          ImGui11.EndMenu();
        }
        if (ImGui11.BeginMenu("Export")) {
          const hasSel = state.selectedIdx >= 0 && state.packets[state.selectedIdx] != null;
          ImGui11.BeginDisabled(!hasSel);
          if (ImGui11.MenuItem("Export Selected")) exportCurrentPacket();
          ImGui11.EndDisabled();
          ImGui11.BeginDisabled(state.packets.length === 0);
          if (ImGui11.MenuItem("Export All")) exportAllPackets();
          ImGui11.EndDisabled();
          ImGui11.EndMenu();
        }
      } finally {
        ImGui11.EndMenuBar();
      }
    }
    const lpW = 300;
    const rpW = 240;
    const cpW = vpW - lpW - rpW - 16;
    ImGui11.BeginChild("##lp", new ImVec29(lpW, 0), 1, 0);
    try {
      renderPacketList();
    } finally {
      ImGui11.EndChild();
    }
    ImGui11.SameLine(0, 4);
    ImGui11.BeginChild("##cp", new ImVec29(cpW, 0), 1, 0);
    try {
      renderCenterPanel();
    } finally {
      ImGui11.EndChild();
    }
    ImGui11.SameLine(0, 4);
    ImGui11.BeginChild("##rp", new ImVec29(0, 0), 1, 0);
    try {
      renderRightSidebar(vpH);
    } finally {
      ImGui11.EndChild();
    }
  } finally {
    ImGui11.End();
  }
  renderSearchWindow(vpW, vpH);
  renderClearRulesConfirmModal(vpW, vpH);
  renderDeleteRuleConfirmModal(vpW, vpH);
  renderDisableKeepUpstreamConfirmModal(vpW, vpH);
  renderConnectionStateModal(vpW, vpH);
}

// src/ui/main.ts
var _canvas = null;
function frame() {
  const canvas = _canvas;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const vpW = canvas.clientWidth;
  const vpH = canvas.clientHeight;
  document.title = state.spoofingEnabled ? "MGO2 Scanner [TESTING]" : "MGO2 Scanner";
  ImGuiImplWeb.BeginRender();
  try {
    renderMainWindow(vpW, vpH);
  } finally {
    ImGuiImplWeb.EndRender();
  }
  if (state.pendingDelete) {
    sendWS({ type: "deleteSpoofRule", ...state.pendingDelete });
    state.pendingDelete = null;
  }
  if (state.pendingSave) {
    sendWS({ type: "setSpoofRule", ...state.pendingSave });
    state.pendingSave = null;
  }
  if (state.pendingSpoofingEnabled !== null) {
    sendWS({ type: "setSpoofingEnabled", enabled: state.pendingSpoofingEnabled });
    state.pendingSpoofingEnabled = null;
  }
  if (state.pendingKeepUpstreamOpen !== null) {
    sendWS({ type: "setKeepUpstreamOpen", enabled: state.pendingKeepUpstreamOpen });
    state.pendingKeepUpstreamOpen = null;
  }
  if (state.pendingForceCloseUpstream) {
    sendWS({ type: "closeUpstreamConnections" });
    state.pendingForceCloseUpstream = false;
  }
  if (state.pendingExcludedRule) {
    sendWS({ type: "setExcludedRule", ...state.pendingExcludedRule });
    state.pendingExcludedRule = null;
  }
  if (state.pendingClearRules) {
    for (const r of [...state.spoofRules]) {
      sendWS({ type: "deleteSpoofRule", cmd: r.cmd, isInbound: r.isInbound });
    }
    state.pendingClearRules = false;
  }
  requestAnimationFrame(frame);
}
async function init() {
  const canvas = document.getElementById("canvas");
  _canvas = canvas;
  await ImGuiImplWeb.Init({ canvas, backend: "webgl2", loaderPath: "./jsimgui.em.js" });
  ImGui12.StyleColorsDark();
  connectWS();
  setStatus("ready");
  requestAnimationFrame(frame);
}
init().catch((err) => {
  console.error("ImGui init failed:", err);
  setStatus("ERROR: " + err.message);
});
