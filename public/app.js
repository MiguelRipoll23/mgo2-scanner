// MGO2 Scanner — Dear ImGui frontend
// Uses @mori2003/jsimgui (WebGL2 backend) served from /jsimgui/mod.js
// Communicates with the Node.js backend over WebSocket at ws://<host>:<port>/ws

import { ImGui, ImGuiImplWeb, ImVec2 } from '/jsimgui/mod.js';
const IMGUI_COL_TEXT = ImGui.Col?.Text ?? 0;
const IMGUI_COL_FRAME_BG = ImGui.Col?.FrameBg ?? 7;
const IMGUI_COL_FRAME_BG_HOVERED = ImGui.Col?.FrameBgHovered ?? 8;
const IMGUI_COL_FRAME_BG_ACTIVE = ImGui.Col?.FrameBgActive ?? 9;
const IMGUI_COL_BUTTON = ImGui.Col?.Button ?? 21;
const IMGUI_COL_BUTTON_HOVERED = ImGui.Col?.ButtonHovered ?? 22;
const IMGUI_COL_BUTTON_ACTIVE = ImGui.Col?.ButtonActive ?? 23;

// Pack r,g,b,a floats [0-1] into IM_COL32 (ABGR byte order expected by PushStyleColor)
function col32(r, g, b, a = 1.0) {
  return (((Math.round(a*255) & 0xFF) << 24)
        | ((Math.round(b*255) & 0xFF) << 16)
        | ((Math.round(g*255) & 0xFF) << 8)
        |  (Math.round(r*255) & 0xFF)) >>> 0;
}

const COL_GREEN  = col32(0.40, 0.95, 0.40); // IN / connected
const COL_PURPLE = col32(0.78, 0.45, 0.95); // OUT
const COL_RED    = col32(0.95, 0.40, 0.40); // disconnected
const COL_ORANGE = col32(0.95, 0.62, 0.18); // modified values
const COL_BLUE   = col32(0.40, 0.72, 0.98); // counters / search highlights

// ─── Command ID → name ────────────────────────────────────────────────────────
const CMD_NAMES = {
  // Common
  0x0003: 'DISCONNECT',                    0x0005: 'KEEP_ALIVE',

  // Gate server
  0x2002: 'GATE_LIST',                     0x2003: 'GATE_HELLO',
  0x2004: 'GATE_ACK',                      0x2005: 'GET_LOBBY_LIST',
  0x2008: 'GET_NEWS',
  0x2009: 'GET_NEWS_START',                0x200a: 'GET_NEWS_ITEM',
  0x200b: 'GET_NEWS_END',

  // Account server — session & characters
  0x3003: 'CHECK_SESSION',                 0x3004: 'CHECK_SESSION_RESP',
  0x3048: 'GET_CHARACTER_LIST',            0x3049: 'GET_CHARACTER_LIST_RESP',
  0x3101: 'CREATE_CHARACTER',              0x3102: 'CREATE_CHARACTER_RESP',
  0x3103: 'SELECT_CHARACTER',              0x3104: 'SELECT_CHARACTER_RESP',
  0x3105: 'DELETE_CHARACTER',              0x3106: 'DELETE_CHARACTER_RESP',

  // Game server — character info
  0x4100: 'GET_CHARACTER_INFO',            0x4101: 'GET_CHARACTER_INFO_RESP',
  0x4102: 'GET_PERSONAL_STATS',            0x4103: 'GET_PERSONAL_STATS_RESP',
  0x4110: 'UPDATE_GAMEPLAY_OPTIONS',       0x4111: 'UPDATE_GAMEPLAY_OPTIONS_RESP',
  0x4112: 'UPDATE_UI_SETTINGS',            0x4113: 'UPDATE_UI_SETTINGS_RESP',
  0x4114: 'UPDATE_CHAT_MACROS',            0x4115: 'UPDATE_CHAT_MACROS_RESP',
  0x411a: 'GET_CHAT_MACROS',              0x411b: 'GET_GAMEPLAY_OPTIONS',
  0x4120: 'GET_GAMEPLAY_OPTIONS_RESP',     0x4121: 'GET_CHAT_MACROS_RESP',
  0x4122: 'GET_PERSONAL_INFO',
  0x4124: 'GET_GEAR',                      0x4125: 'GET_SKILLS',
  0x4128: 'GET_POST_GAME_INFO',            0x4129: 'GET_POST_GAME_INFO_RESP',
  0x4130: 'UPDATE_PERSONAL_INFO',          0x4131: 'UPDATE_PERSONAL_INFO_RESP',
  0x4140: 'GET_SKILL_SETS',               0x4141: 'UPDATE_SKILL_SETS',
  0x4142: 'GET_GEAR_SETS',                0x4143: 'UPDATE_GEAR_SETS',
  0x4144: 'UPDATE_GEAR_SETS_RESP',
  0x4150: 'GET_LOBBY_DISCONNECT',          0x4151: 'GET_LOBBY_DISCONNECT_RESP',
  0x4220: 'GET_CHARACTER_CARD',            0x4221: 'GET_CHARACTER_CARD_RESP',

  // Game server — game list
  0x4300: 'GET_GAME_LIST',
  0x4301: 'GET_GAME_LIST_START',           0x4302: 'GET_GAME_LIST_ITEM',
  0x4303: 'GET_GAME_LIST_END',
  0x4304: 'GET_HOST_SETTINGS',             0x4305: 'GET_HOST_SETTINGS_RESP',
  0x4310: 'CHECK_HOST_SETTINGS',           0x4311: 'CHECK_HOST_SETTINGS_RESP',
  0x4312: 'GET_GAME_DETAILS',              0x4313: 'GET_GAME_DETAILS_RESP',
  0x4316: 'CREATE_GAME',                   0x4317: 'CREATE_GAME_RESP',
  0x4320: 'JOIN_GAME',                     0x4321: 'JOIN_GAME_RESP',
  0x4322: 'JOIN_GAME_FAILED',

  // Game server — in-game
  0x4340: 'PLAYER_CONNECTED',              0x4341: 'PLAYER_CONNECTED_RESP',
  0x4342: 'PLAYER_DISCONNECTED',           0x4343: 'PLAYER_DISCONNECTED_RESP',
  0x4344: 'SET_PLAYER_TEAM',               0x4345: 'SET_PLAYER_TEAM_RESP',
  0x4346: 'KICK_PLAYER',                   0x4347: 'KICK_PLAYER_RESP',
  0x4348: 'HOST_PASS',                     0x4349: 'HOST_PASS_RESP',
  0x4350: 'UPDATE_STATS',                  0x4351: 'UPDATE_STATS_RESP',
  0x4380: 'QUIT_GAME',                     0x4381: 'QUIT_GAME_RESP',
  0x4390: 'HOST_UPDATE_STATS',             0x4391: 'HOST_UPDATE_STATS_RESP',
  0x4392: 'SET_GAME',                      0x4393: 'SET_GAME_RESP',
  0x4398: 'UPDATE_PINGS',                  0x4399: 'UPDATE_PINGS_RESP',
  0x43a0: 'PASS_ROUND',                    0x43a1: 'PASS_ROUND_RESP',
  0x43a2: 'PASS_ROUND_UNK',               0x43a3: 'PASS_ROUND_UNK_RESP',
  0x43c0: 'HOST_UNK_43C0',               0x43c1: 'HOST_UNK_43C0_RESP',
  0x43ca: 'START_ROUND',                   0x43cb: 'START_ROUND_RESP',
  0x43d0: 'TRAINING_CONNECT',              0x43d1: 'TRAINING_CONNECT_RESP',

  // Game server — chat
  0x4400: 'SEND_CHAT',                     0x4401: 'SEND_CHAT_RESP',
  0x4440: 'CHAT_UNK_4440',               0x4441: 'CHAT_UNK_4440_RESP',

  // Game server — friends / blocked
  0x4500: 'ADD_FRIENDS_BLOCKED',           0x4501: 'ADD_FRIENDS_BLOCKED_RESP',
  0x4510: 'REMOVE_FRIENDS_BLOCKED',        0x4511: 'REMOVE_FRIENDS_BLOCKED_RESP',
  0x4580: 'GET_FRIENDS_BLOCKED_LIST',      0x4581: 'GET_FRIENDS_BLOCKED_LIST_RESP',

  // Game server — search / history
  0x4600: 'SEARCH_PLAYER',
  0x4601: 'SEARCH_PLAYER_START',           0x4602: 'SEARCH_PLAYER_RESULT',
  0x4603: 'SEARCH_PLAYER_END',
  0x4680: 'GET_MATCH_HISTORY',
  0x4681: 'GET_MATCH_HISTORY_1',           0x4682: 'GET_MATCH_HISTORY_2',
  0x4683: 'GET_MATCH_HISTORY_3',

  // Game server — session auth
  0x4700: 'SESSION_AUTH',                  0x4701: 'SESSION_AUTH_RESP',

  // Game server — messages
  0x4800: 'SEND_MESSAGE',                  0x4801: 'SEND_MESSAGE_RESP',
  0x4820: 'GET_MESSAGES',
  0x4821: 'GET_MESSAGES_START',            0x4822: 'GET_MESSAGES_ITEM',
  0x4823: 'GET_MESSAGES_END',
  0x4840: 'GET_MESSAGE_CONTENTS',          0x4841: 'GET_MESSAGE_CONTENTS_RESP',
  0x4860: 'ADD_SENT_MESSAGE',              0x4861: 'ADD_SENT_MESSAGE_RESP',

  // Game server — flash news
  0x4a50: 'FLASH_NEWS',

  // Game server — lobby info
  0x4900: 'GET_GAME_LOBBY_INFO',
  0x4901: 'GET_GAME_LOBBY_INFO_START',     0x4902: 'GET_GAME_LOBBY_INFO_ITEM',
  0x4903: 'GET_GAME_LOBBY_INFO_END',
  0x4990: 'GET_GAME_ENTRY_INFO',           0x4991: 'GET_GAME_ENTRY_INFO_RESP',

  // Game server — clans
  0x4b00: 'CREATE_CLAN',                   0x4b01: 'CREATE_CLAN_RESP',
  0x4b04: 'DISBAND_CLAN',                  0x4b05: 'DISBAND_CLAN_RESP',
  0x4b10: 'GET_CLAN_LIST',
  0x4b11: 'GET_CLAN_LIST_START',           0x4b12: 'GET_CLAN_LIST_ITEM',
  0x4b13: 'GET_CLAN_LIST_END',
  0x4b20: 'GET_CLAN_MEMBER_INFO',          0x4b21: 'GET_CLAN_MEMBER_INFO_RESP',
  0x4b30: 'ACCEPT_CLAN_JOIN',              0x4b31: 'ACCEPT_CLAN_JOIN_RESP',
  0x4b32: 'DECLINE_CLAN_JOIN',             0x4b33: 'DECLINE_CLAN_JOIN_RESP',
  0x4b36: 'BANISH_CLAN_MEMBER',            0x4b37: 'BANISH_CLAN_MEMBER_RESP',
  0x4b40: 'LEAVE_CLAN',                    0x4b41: 'LEAVE_CLAN_RESP',
  0x4b42: 'APPLY_TO_CLAN',                 0x4b43: 'APPLY_TO_CLAN_RESP',
  0x4b46: 'UPDATE_CLAN_STATE',             0x4b47: 'UPDATE_CLAN_STATE_RESP',
  0x4b48: 'GET_CLAN_EMBLEM_LOBBY',         0x4b49: 'GET_CLAN_EMBLEM_LOBBY_RESP',
  0x4b4a: 'GET_CLAN_EMBLEM',              0x4b4b: 'GET_CLAN_EMBLEM_RESP',
  0x4b4c: 'GET_CLAN_EMBLEM_WIP',          0x4b4d: 'GET_CLAN_EMBLEM_WIP_RESP',
  0x4b50: 'SET_CLAN_EMBLEM',               0x4b51: 'SET_CLAN_EMBLEM_RESP',
  0x4b52: 'GET_CLAN_ROSTER',               0x4b53: 'GET_CLAN_ROSTER_RESP',
  0x4b60: 'TRANSFER_CLAN_LEADERSHIP',      0x4b61: 'TRANSFER_CLAN_LEADERSHIP_RESP',
  0x4b62: 'SET_EMBLEM_EDITOR',             0x4b63: 'SET_EMBLEM_EDITOR_RESP',
  0x4b64: 'UPDATE_CLAN_COMMENT',           0x4b65: 'UPDATE_CLAN_COMMENT_RESP',
  0x4b66: 'UPDATE_CLAN_NOTICE',            0x4b67: 'UPDATE_CLAN_NOTICE_RESP',
  0x4b70: 'GET_CLAN_STATS',               0x4b71: 'GET_CLAN_STATS_RESP',
  0x4b80: 'GET_CLAN_INFO',                0x4b81: 'GET_CLAN_INFO_RESP',
  0x4b90: 'SEARCH_CLAN',
  0x4b91: 'SEARCH_CLAN_START',             0x4b92: 'SEARCH_CLAN_RESULT',
  0x4b93: 'SEARCH_CLAN_END',
};

function cmdHex(cmd)  { return '0x' + cmd.toString(16).toUpperCase().padStart(4, '0'); }
function cmdName(cmd) { return CMD_NAMES[cmd] || 'UKNOWN'; }
function fmtCmd(cmd)  { const n = CMD_NAMES[cmd]; return n ? `${cmdHex(cmd)} ${n}` : cmdHex(cmd); }

// ─── Hex / ASCII helpers ──────────────────────────────────────────────────────
function fmtHexSpaced(h) {
  if (!h) return '';
  return h.replace(/../g, m => m.toUpperCase() + ' ').trimEnd();
}

function parseHexInput(raw) { return raw.replace(/\s+/g, '').toLowerCase(); }

const BPR = 16; // bytes per row

function toHexLines(compact) {
  if (!compact) return '';
  const rows = [];
  for (let i = 0; i < compact.length; i += BPR * 2)
    rows.push(fmtHexSpaced(compact.slice(i, i + BPR * 2)));
  return rows.join('\n');
}

function toAsciiLines(compact) {
  if (!compact) return '';
  const rows = [];
  for (let i = 0; i < compact.length; i += BPR * 2) {
    let row = '';
    for (let j = i; j < Math.min(i + BPR * 2, compact.length); j += 2) {
      const b = parseInt(compact.slice(j, j + 2), 16);
      row += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

// '.' = keep original byte; anything else = use char code
function applyAsciiToHex(newAscii, prevCompact) {
  const str = newAscii.replace(/\n/g, '');
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '.') {
      const orig = prevCompact.slice(i * 2, i * 2 + 2);
      hex += orig.length === 2 ? orig : '00';
    } else {
      hex += ch.charCodeAt(0).toString(16).padStart(2, '0');
    }
  }
  return hex;
}

// ─── Application state ────────────────────────────────────────────────────────
const MAX_PACKETS = 2000;
const packets = [], spoofRules = [], excludedRules = [];
let ws = null, wsReady = false;
let spoofingEnabled = false;
let keepUpstreamOpen = false;
const tcpStatuses = [];

let autoScroll  = false;
let selectedIdx = -1;

// Current-packet detail (updated on selection change)
const detail = {
  compact:    '',    // current payload (hex)
  original:   '',    // as-captured payload (hex) — never changed by edits
  packet:     '',    // full packet (header + plaintext payload)
  lastIdx:    -2,
  cursorByte: 0,     // selected byte offset for the data inspector
};

const inspectorEd = {
  key: '',
  cursorKey: '',
  cStringLen: 1,
  fields: Object.create(null),
};

const SEARCH_TYPES = ['uint8', 'uint16', 'uint32', 'string', 'hex'];
const searchState = {
  open: false,
  type: 'string',
  value: '',
  results: [],
  index: -1,
  direction: 'both',
  selectedPacketKey: '',
};

// Deferred WS sends — processed after all ImGui calls to avoid mid-frame state mutation
let pendingDelete = null;
let pendingSave   = null;
let pendingClearRules = false;
let pendingSpoofingEnabled = null;
let pendingExcludedRule = null;
let showConnectionStateModal = false;
let pendingKeepUpstreamOpen = null;
let pendingForceCloseUpstream = false;
let showDisableKeepUpstreamConfirm = false;
let editingRule = null;              // { cmd, isInbound, payloadHex } — rule editing mode
let pendingDeleteConfirmRule = null; // rule pending delete confirmation
let showClearRulesConfirm = false;  // clear-all-rules confirmation

// ─── ImGui flag constants ─────────────────────────────────────────────────────
const WF_NoMove     = 4;
const WF_NoResize   = 2;
const WF_NoCollapse = 32;
const WF_NoTitleBar = 1;
const WF_MenuBar    = 1024;

const TF_RowBg          = 64;
const TF_Borders        = 1920;
const TF_ScrollX        = 16777216;
const TF_ScrollY        = 33554432;
const TF_SizingFixedFit = 8192;

const CF_WidthFixed   = 16;
const CF_WidthStretch = 8;

const SEL_SpanAllColumns = 2;
const TNF_DefaultOpen    = 32; // ImGuiTreeNodeFlags_DefaultOpen

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWS() {
  ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}/ws`);
  ws.onopen  = () => { wsReady = true;  setStatus('connected'); };
  ws.onclose = () => {
    wsReady = false;
    setStatus('disconnected - retrying...');
    setTimeout(connectWS, 2000);
  };
  ws.onerror  = () => setStatus('WS error');
  ws.onmessage = ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'packet') {
      packets.push(msg);
      if (packets.length > MAX_PACKETS) packets.shift();
      if (selectedIdx >= packets.length) selectedIdx = packets.length - 1;
    } else if (msg.type === 'spoofRules') {
      spoofRules.length = 0;
      for (const r of msg.rules) spoofRules.push(r);
      if (editingRule) {
        const still = spoofRules.find(r => r.cmd === editingRule.cmd && r.isInbound === editingRule.isInbound);
        if (!still) editingRule = null; // rule was deleted while editing
      }
      if (selectedIdx >= 0 && packets[selectedIdx]) loadSelectedDetailFromPacket();
    } else if (msg.type === 'excludedRules') {
      excludedRules.length = 0;
      for (const r of msg.rules) excludedRules.push(r);
    } else if (msg.type === 'spoofingState') {
      spoofingEnabled = !!msg.enabled;
    } else if (msg.type === 'keepUpstreamState') {
      keepUpstreamOpen = !!msg.enabled;
    } else if (msg.type === 'tcpStatuses') {
      tcpStatuses.length = 0;
      for (const status of msg.statuses) tcpStatuses.push(status);
    }
  };
}

function sendWS(obj) {
  if (wsReady && ws && ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify(obj));
}

function setStatus(txt) {
  const el = document.getElementById('status');
  if (el) el.textContent = txt;
}

function centerText(text) {
  const region = ImGui.GetContentRegionAvail();
  const textSize = ImGui.CalcTextSize(text);
  if (region.x > textSize.x) {
    ImGui.SetCursorPosX(ImGui.GetCursorPosX() + Math.floor((region.x - textSize.x) * 0.5));
  }
  ImGui.Text(text);
}

function compactToBytes(compact) {
  const out = new Uint8Array(compact.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToCompact(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function replaceBytesAtCursor(nextBytes) {
  const full = compactToBytes(detail.compact);
  const off = detail.cursorByte;
  if (off + nextBytes.length > full.length) return false;
  full.set(nextBytes, off);
  detail.compact = bytesToCompact(full);
  return true;
}

function isByteModified(byteOffset) {
  const start = byteOffset * 2;
  return detail.compact.slice(start, start + 2) !== detail.original.slice(start, start + 2);
}

function isRangeModified(byteLen) {
  const start = detail.cursorByte * 2;
  const end = start + byteLen * 2;
  return detail.compact.slice(start, end) !== detail.original.slice(start, end);
}


function requestPacketSelection(idx) {
  if (idx === selectedIdx && !editingRule) return;
  selectedIdx = idx;
  loadSelectedDetailFromPacket();
}

function getSelectedPacket() {
  return selectedIdx >= 0 ? packets[selectedIdx] || null : null;
}

function getSelectedRule() {
  const pkt = getSelectedPacket();
  if (!pkt) return null;
  return spoofRules.find(r => r.cmd === pkt.cmd && r.isInbound === pkt.isInbound) || null;
}

function getSelectedExcludedRule() {
  const pkt = getSelectedPacket();
  if (!pkt) return null;
  return excludedRules.find(r => r.cmd === pkt.cmd && r.isInbound === pkt.isInbound) || null;
}

function getVisiblePayloadHex(pkt) {
  if (!pkt) return '';
  return pkt.spoofedPayload || pkt.payload || '';
}

function startEditingRule(rule) {
  editingRule = { cmd: rule.cmd, isInbound: rule.isInbound, payloadHex: rule.payloadHex };
  selectedIdx = -1;
  detail.compact    = rule.payloadHex;
  detail.original   = rule.payloadHex;
  detail.packet     = '';
  detail.lastIdx    = -3; // sentinel for rule-edit mode
  detail.cursorByte = 0;
  inspectorEd.key = ''; inspectorEd.cursorKey = '';
  searchState.results = [];
  searchState.index   = -1;
}

function loadSelectedDetailFromPacket(preserveSearch = false) {
  editingRule = null;
  const pkt = getSelectedPacket();
  if (!pkt) return;
  const visiblePayload = getVisiblePayloadHex(pkt);
  detail.lastIdx = selectedIdx;
  detail.compact = visiblePayload;
  detail.original = visiblePayload;
  detail.packet = pkt.packet || '';
  detail.cursorByte = 0;
  inspectorEd.key = ''; inspectorEd.cursorKey = '';
  if (!preserveSearch) {
    searchState.results = [];
    searchState.index = -1;
    searchState.selectedPacketKey = packetSearchKey();
  }
}

function queueSpoofSync() {
  if (editingRule) {
    pendingSave = { cmd: editingRule.cmd, isInbound: editingRule.isInbound, payloadHex: detail.compact };
    return;
  }
  const pkt = getSelectedPacket();
  if (!pkt) return;
  pendingSave = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: detail.compact };

  // Auto-create rule and switch to rule editing view on first edit
  if (!getSelectedRule()) {
    const newRule = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: detail.compact };
    if (!spoofRules.find(r => r.cmd === newRule.cmd && r.isInbound === newRule.isInbound))
      spoofRules.push(newRule);
    editingRule = { cmd: pkt.cmd, isInbound: pkt.isInbound, payloadHex: detail.compact };
    selectedIdx = -1;
    detail.lastIdx = -3;
    detail.packet = '';
    searchState.results = [];
    searchState.index = -1;
  }
}

function currentPlainPacketCompact() {
  const pkt = getSelectedPacket();
  if (!pkt) return '';
  const packetCompact = detail.packet || pkt.packet || '';
  if (!packetCompact || packetCompact.length < 48) return packetCompact;
  return packetCompact.slice(0, 48) + detail.compact;
}

function restoreCurrentPayload() {
  detail.compact = detail.original;
  inspectorEd.key = ''; inspectorEd.cursorKey = '';
  queueSpoofSync();
}

function fmtDatetime() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function exportCurrentPacket() {
  const compact = currentPlainPacketCompact();
  if (!compact) return;
  const bytes = compactToBytes(compact);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const pkt = getSelectedPacket();
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cmdHex(pkt?.cmd ?? 0).slice(2)}-${pkt?.isInbound ? 'in' : 'out'}-${fmtDatetime()}.bin`;
  link.click();
  URL.revokeObjectURL(url);
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
  } catch {}
  ImGui.SetClipboardText(text);
}

function exportCurrentRule() {
  if (!editingRule || !detail.compact) return;
  const bytes = compactToBytes(detail.compact);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cmdHex(editingRule.cmd).slice(2)}-${editingRule.isInbound ? 'in' : 'out'}-${fmtDatetime()}.bin`;
  link.click();
  URL.revokeObjectURL(url);
}

function copyCurrentRule() {
  if (!editingRule || !detail.compact) return;
  const text = detail.compact.toUpperCase();
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
  } catch {}
  ImGui.SetClipboardText(text);
}

function clampCursor(next, nBytes) {
  return Math.max(0, Math.min(nBytes - 1, next));
}

function handleHexCursorKeys(compact) {
  if (!compact || ImGui.IsAnyItemActive()) return;
  const nBytes = compact.length / 2;
  if (nBytes <= 0) return;

  let next = detail.cursorByte;
  if (ImGui.IsKeyPressed(ImGui.Key._LeftArrow)) next -= 1;
  if (ImGui.IsKeyPressed(ImGui.Key._RightArrow)) next += 1;
  if (ImGui.IsKeyPressed(ImGui.Key._UpArrow)) next -= BPR;
  if (ImGui.IsKeyPressed(ImGui.Key._DownArrow)) next += BPR;

  detail.cursorByte = clampCursor(next, nBytes);
}

function buildSearchNeedle(type, value) {
  try {
    if (type === 'string') {
      const bytes = new TextEncoder().encode(value);
      return bytes.length ? bytes : null;
    }
    if (type === 'hex') {
      const compact = parseHexInput(value);
      if (!compact || compact.length % 2 !== 0) return null;
      return compactToBytes(compact);
    }
    if (type === 'uint8') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 0xff) return null;
      return Uint8Array.of(num);
    }
    if (type === 'uint16') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 0xffff) return null;
      const out = new Uint8Array(2);
      new DataView(out.buffer).setUint16(0, num, false);
      return out;
    }
    if (type === 'uint32') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0 || num > 0xffffffff) return null;
      const out = new Uint8Array(4);
      new DataView(out.buffer).setUint32(0, num >>> 0, false);
      return out;
    }
  } catch {}
  return null;
}

function packetSearchKey() {
  const pkt = getSelectedPacket();
  return pkt ? `${selectedIdx}:${pkt.cmd}:${detail.compact.length}` : '';
}

function runSearch() {
  const needle = buildSearchNeedle(searchState.type, searchState.value);
  searchState.results = [];
  searchState.index = -1;
  searchState.selectedPacketKey = packetSearchKey();
  if (!needle || needle.length === 0) return;

  for (let packetIdx = 0; packetIdx < packets.length; packetIdx++) {
    const pkt = packets[packetIdx];
    if (searchState.direction === 'in' && !pkt.isInbound) continue;
    if (searchState.direction === 'out' && pkt.isInbound) continue;
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
      if (match) searchState.results.push({ packetIdx, start: i, len: needle.length });
    }
  }

  if (searchState.results.length > 0) {
    searchState.index = 0;
    const first = searchState.results[0];
    selectedIdx = first.packetIdx;
    loadSelectedDetailFromPacket(true);
    detail.cursorByte = first.start;
  }
}

function currentSearchMatch() {
  if (searchState.index < 0 || searchState.index >= searchState.results.length) return null;
  return searchState.results[searchState.index];
}

function searchMove(delta) {
  if (searchState.results.length === 0) return;
  searchState.index = (searchState.index + delta + searchState.results.length) % searchState.results.length;
  const match = searchState.results[searchState.index];
  if (selectedIdx !== match.packetIdx) {
    selectedIdx = match.packetIdx;
    loadSelectedDetailFromPacket(true);
  }
  detail.cursorByte = match.start;
}

function isSearchHighlighted(byteOffset) {
  const match = currentSearchMatch();
  return !!match && match.packetIdx === selectedIdx && byteOffset >= match.start && byteOffset < match.start + match.len;
}

function decodePrintableAscii(bytes) {
  let out = '';
  for (const byte of bytes) out += (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : '.';
  return out;
}

function encodeAsciiPatch(text, prevBytes) {
  const out = Uint8Array.from(prevBytes);
  for (let i = 0; i < Math.min(text.length, out.length); i++) {
    const ch = text[i];
    out[i] = ch === '.' ? prevBytes[i] : (ch.charCodeAt(0) & 0xff);
  }
  return out;
}

function decodeCString(bytes) {
  const nul = bytes.indexOf(0);
  const view = nul === -1 ? bytes : bytes.slice(0, nul);
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(view);
  } catch {
    return '';
  }
}

function encodeCString(text, fieldLen) {
  const out = new Uint8Array(fieldLen); // zero-initialised — guarantees null terminator
  const bytes = new TextEncoder().encode(text);
  out.set(bytes.slice(0, fieldLen - 1)); // reserve last byte for null
  return out;
}

const CSTRING_SCAN_LIMIT = 32;

function syncInspectorFields(buf, dv, n) {
  const off = detail.cursorByte;
  const cursorKey = `${detail.lastIdx}:${off}`;
  const key = `${cursorKey}:${detail.compact}`;

  // Recalculate cstring state only when the cursor moves to a new position.
  // - Cap the null search to CSTRING_SCAN_LIMIT bytes so we never treat a
  //   distant null (from a different field) as our terminator and accidentally
  //   clobber many bytes on write.
  // - The cstring display value is also only refreshed here; between cursor
  //   moves it keeps whatever the user last typed so jsimgui's InputText
  //   internal cursor position is not reset on every keystroke.
  const cursorMoved = inspectorEd.cursorKey !== cursorKey;
  if (cursorMoved) {
    inspectorEd.cursorKey = cursorKey;
    const scanLimit = Math.min(CSTRING_SCAN_LIMIT, n);
    const nullAt = buf.slice(0, scanLimit).indexOf(0);
    inspectorEd.cStringLen = nullAt === -1 ? scanLimit : nullAt + 1;
    inspectorEd.fields['cstring'] = decodeCString(buf.slice(0, scanLimit));
  }

  if (inspectorEd.key === key) return;
  inspectorEd.key = key;

  inspectorEd.fields = {
    uint8: n >= 1 ? String(dv.getUint8(0)) : '',
    int8: n >= 1 ? String(dv.getInt8(0)) : '',
    uint16: n >= 2 ? String(dv.getUint16(0, false)) : '',
    int16: n >= 2 ? String(dv.getInt16(0, false)) : '',
    uint32: n >= 4 ? String(dv.getUint32(0, false)) : '',
    int32: n >= 4 ? String(dv.getInt32(0, false)) : '',
    uint64: n >= 8 ? dv.getBigUint64(0, false).toString() : '',
    int64: n >= 8 ? dv.getBigInt64(0, false).toString() : '',
    float32: n >= 4 ? String(dv.getFloat32(0, false)) : '',
    float64: n >= 8 ? String(dv.getFloat64(0, false)) : '',
    binary: n >= 1 ? dv.getUint8(0).toString(2).padStart(8, '0') : '',
    string: decodePrintableAscii(buf.slice(0, Math.min(26, n))),
    // Preserve the cstring value the user is typing; only refresh it when the
    // cursor moves (handled above in the cursorMoved branch).
    cstring: inspectorEd.fields['cstring'] ?? '',
  };
}

// ─── ImHex-style hex table with per-byte cursor ───────────────────────────────
//
//  Columns: Offset | 00..07 (individual) | 08..0F (individual) | Decoded text
//  Each byte cell is a Selectable — clicking it sets detail.cursorByte.
//
function renderHexTable(compact, tableH) {
  if (!compact || compact.length < 2) return;
  const nBytes  = compact.length / 2;
  const nCols   = 1 + BPR + 1; // Offset + 16 bytes + ASCII = 18

  const flags = TF_ScrollY | TF_Borders | TF_RowBg;
  if (!ImGui.BeginTable('##ht', nCols, flags, new ImVec2(0, tableH))) return;

  ImGui.TableSetupScrollFreeze(0, 1);
  ImGui.TableSetupColumn('Offset', CF_WidthFixed, 72);
  for (let i = 0; i < BPR; i++) {
    const hdr = i.toString(16).toUpperCase().padStart(2, '0');
    // Add 4 px gap before the second group of 8 bytes (matches ImHex visual)
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
        const isCursor = off === detail.cursorByte;
        const modified = isByteModified(off);
        const searched = isSearchHighlighted(off);
        if (searched) ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_BLUE);
        else if (modified) ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
        if (ImGui.Selectable(`${hexByte}##b${off}`, isCursor, 0)) {
          detail.cursorByte = off;
        }
        if (searched || modified) ImGui.PopStyleColor(1);
      }
    }

    // ASCII column
    ImGui.TableSetColumnIndex(BPR + 1);
    let ascii = '';
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
    if (rowSearched) ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_BLUE);
    else if (rowModified) ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
    ImGui.TextDisabled(ascii);
    if (rowSearched || rowModified) ImGui.PopStyleColor(1);
  }

  ImGui.EndTable();
}

// ─── Two-column editable hex/ASCII editor ─────────────────────────────────────
function renderHexEditor(ed, uid, height, hexColW) {
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

// ─── Data Inspector (reads from detail.cursorByte offset) ─────────────────────
function renderDataInspector() {
  const compact = detail.compact;
  const off     = detail.cursorByte;

  // Cursor indicator — matches ImHex style
  ImGui.TextDisabled(`Cursor  0x${off.toString(16).toUpperCase().padStart(8, '0')}`);
  ImGui.Separator();

  if (!compact || compact.length < 2 || off * 2 >= compact.length) {
    ImGui.TextDisabled('(no data at cursor)');
    return;
  }

  // Slice from cursor offset so all types read starting at the selected byte
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

  function renderRowLabel(label, modified) {
    if (modified) ImGui.PushStyleColor(0, COL_ORANGE);
    ImGui.TextDisabled(label);
    if (modified) ImGui.PopStyleColor(1);
  }

  function row(label, val, modified = false) {
    ImGui.TableNextRow();
    ImGui.TableSetColumnIndex(0); renderRowLabel(label, modified);
    ImGui.TableSetColumnIndex(1); ImGui.Text(String(val));
  }
  function na(label, modified = false) {
    ImGui.TableNextRow();
    ImGui.TableSetColumnIndex(0); renderRowLabel(label, modified);
    ImGui.TableSetColumnIndex(1); ImGui.TextDisabled('--');
  }

function editRow(label, fieldKey, byteLen, parseToBytes) {
    const modified = isRangeModified(byteLen);
    ImGui.TableNextRow();
    ImGui.TableSetColumnIndex(0);
    renderRowLabel(label, modified);
    ImGui.TableSetColumnIndex(1);
    ImGui.SetNextItemWidth(-1);
    const bufRef = [inspectorEd.fields[fieldKey] ?? ''];
    ImGui.PushStyleColor(IMGUI_COL_FRAME_BG, col32(0, 0, 0, 0));
    ImGui.PushStyleColor(IMGUI_COL_FRAME_BG_HOVERED, col32(0.28, 0.33, 0.42, 0.38));
    ImGui.PushStyleColor(IMGUI_COL_FRAME_BG_ACTIVE, col32(0, 0, 0, 0));
    if (ImGui.InputText(`##${fieldKey}`, bufRef, 256)) {
      inspectorEd.fields[fieldKey] = bufRef[0];
      const nextBytes = parseToBytes(bufRef[0]);
      if (nextBytes && replaceBytesAtCursor(nextBytes)) queueSpoofSync();
    }
    ImGui.PopStyleColor(3);
  }

  function decodeNullTerminatedString(bytes) {
    const nul = bytes.indexOf(0);
    const view = nul === -1 ? bytes : bytes.slice(0, nul);
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(view);
    } catch {
      return '';
    }
  }

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
  } catch { na('uint64'); na('int64'); }
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
  const cStringLen = inspectorEd.cStringLen;
  n >= 1 ? editRow('cstring', 'cstring', cStringLen, value => {
    return encodeCString(value, cStringLen);
  }) : na('cstring');

  ImGui.EndTable();
}

// ─── RIGHT panel — Data Inspector + Actions ───────────────────────────────────
function renderRightSidebar(vpH) {
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
          const hasSel = selectedIdx >= 0 && packets[selectedIdx] != null;

          if (!hasSel && !editingRule) {
            ImGui.TextDisabled('No packet selected.');
          } else if (editingRule) {
            ImGui.Spacing();
            const actionGap = 6;
            const actionW = Math.floor((ImGui.GetContentRegionAvail().x - actionGap) / 2);
            if (ImGui.Button('Export##rule', new ImVec2(actionW, 0))) exportCurrentRule();
            ImGui.SameLine(0, actionGap);
            if (ImGui.Button('Copy##rule', new ImVec2(actionW, 0))) copyCurrentRule();
          } else if (hasSel) {
            const pkt = packets[selectedIdx];

            ImGui.Spacing();
            const actionGap = 6;
            const actionW = Math.floor((ImGui.GetContentRegionAvail().x - actionGap) / 2);
            if (ImGui.Button('Export', new ImVec2(actionW, 0))) exportCurrentPacket();
            ImGui.SameLine(0, actionGap);
            if (ImGui.Button('Copy', new ImVec2(actionW, 0))) copyCurrentPacket();

            ImGui.Spacing();
            const excludeFuture = [!!getSelectedExcludedRule()];
            if (ImGui.Checkbox('Must ignore', excludeFuture)) {
              pendingExcludedRule = { cmd: pkt.cmd, isInbound: pkt.isInbound, enabled: excludeFuture[0] };
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

// ─── Spoof Rules section (bottom of center panel) ─────────────────────────────
function renderSpoofRulesSection() {
  const actionGap = 6;
  const spoofingWasEnabled = spoofingEnabled;
  ImGui.Dummy(new ImVec2(0, 4));
  if (spoofingWasEnabled) {
    ImGui.PushStyleColor(IMGUI_COL_BUTTON, col32(0.80, 0.24, 0.24, 1.0));
    ImGui.PushStyleColor(IMGUI_COL_BUTTON_HOVERED, col32(0.92, 0.30, 0.30, 1.0));
    ImGui.PushStyleColor(IMGUI_COL_BUTTON_ACTIVE, col32(0.68, 0.18, 0.18, 1.0));
  }
  if (ImGui.Button(spoofingEnabled ? 'Stop testing' : 'Start testing')) {
    pendingSpoofingEnabled = !spoofingEnabled;
    spoofingEnabled = !spoofingEnabled;
  }
  if (spoofingWasEnabled) ImGui.PopStyleColor(3);
  ImGui.SameLine(0, actionGap);
  if (ImGui.Button('Clear rules')) showClearRulesConfirm = true;
  ImGui.Dummy(new ImVec2(0, 4));

  ImGui.Spacing();
  // Header row
  ImGui.TextDisabled(`Test Rules (${spoofRules.length})`);

  if (spoofRules.length === 0) {
    ImGui.TextDisabled('  No active rules.');
  } else {
    const flags = TF_Borders | TF_RowBg | TF_SizingFixedFit | TF_ScrollY;
    if (!ImGui.BeginTable('##sr', 4, flags, new ImVec2(0, -1))) return;
    try {
      ImGui.TableSetupScrollFreeze(0, 1);
      ImGui.TableSetupColumn('Dir',     CF_WidthFixed,    28);
      ImGui.TableSetupColumn('ID',      CF_WidthFixed,    56);
      ImGui.TableSetupColumn('Name',    CF_WidthStretch,   0);
      ImGui.TableSetupColumn('Actions', CF_WidthFixed,   112);
      ImGui.TableHeadersRow();

      for (const rule of spoofRules) {
        const k = `${rule.isInbound ? 1 : 0}_${rule.cmd}`;
        const rowHeight = 30;
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
        ImGui.Text(CMD_NAMES[rule.cmd] || '');

        ImGui.TableSetColumnIndex(3);
        ImGui.SetCursorPosY(ImGui.GetCursorPosY() + btnOffsetY);
        if (ImGui.Button(`Edit##${k}`)) startEditingRule(rule);
        ImGui.SameLine(0, 4);
        if (ImGui.Button(`Delete##${k}`))
          pendingDeleteConfirmRule = { cmd: rule.cmd, isInbound: rule.isInbound };
      }
    } finally {
      ImGui.EndTable();
    }
  }

}

// ─── LEFT panel — Packet list ─────────────────────────────────────────────────
function renderPacketList() {
  if (!ImGui.BeginTabBar('##lp_tabs')) return;
  if (!ImGui.BeginTabItem(`Packets (${packets.length})##lp_tab`)) {
    ImGui.EndTabBar();
    return;
  }

  ImGui.BeginChild('##packet_table_wrap', new ImVec2(0, -1), 0, 0);
  try {
    const flags = TF_ScrollY | TF_Borders | TF_RowBg | TF_SizingFixedFit;
    if (!ImGui.BeginTable('##pl', 3, flags, new ImVec2(0, -1))) return;
    ImGui.TableSetupScrollFreeze(0, 1);
    ImGui.TableSetupColumn('Dir',  CF_WidthFixed,   36);
    ImGui.TableSetupColumn('ID',   CF_WidthFixed,   54);
    ImGui.TableSetupColumn('Name', CF_WidthStretch,  0);
    ImGui.TableHeadersRow();

    for (let i = 0; i < packets.length; i++) {
      const pkt = packets[i];
      ImGui.PushStyleColor(0, pkt.isInbound ? COL_GREEN : COL_PURPLE);

      ImGui.TableNextRow();
      ImGui.TableSetColumnIndex(0);
      if (ImGui.Selectable(
        `${pkt.isInbound ? 'IN' : 'OUT'}##r${i}`,
        selectedIdx === i,
        SEL_SpanAllColumns
      )) requestPacketSelection(i);
      ImGui.TableSetColumnIndex(1); ImGui.Text(cmdHex(pkt.cmd));
      ImGui.TableSetColumnIndex(2); ImGui.Text(CMD_NAMES[pkt.cmd] || '');

      ImGui.PopStyleColor(1);
    }

    if (autoScroll) ImGui.SetScrollHereY(1.0);
    ImGui.EndTable();
  } finally {
    ImGui.EndChild();
  }

  ImGui.EndTabItem();
  ImGui.EndTabBar();
}

// ─── CENTER panel ─────────────────────────────────────────────────────────────
//
//  ┌─ header ──────────────────────────────────────────────────────┐
//  │ Offset | 00 01 02 03 04 05 06 07  08 ... 0F | Decoded text   │
//  │ hex table (scrollable, each byte = Selectable for cursor)     │
//  ├───────────────────────────────────────────────────────────────┤
//  │ Spoof Rules (fixed-height section at bottom)                  │
//  └───────────────────────────────────────────────────────────────┘

const SPOOF_SECTION_H = 180; // px reserved at bottom for the spoof rules section

function renderCenterPanel() {
  const hasSel = selectedIdx >= 0 && packets[selectedIdx] != null;

  // ── Top area: hex view or placeholder — always leaves SPOOF_SECTION_H at bottom ──
  ImGui.BeginChild('##cptop', new ImVec2(0, -(SPOOF_SECTION_H + 6)), 0, 0);
  try {
    if (editingRule) {
      ImGui.PushStyleColor(IMGUI_COL_TEXT, COL_ORANGE);
      ImGui.Text('Rule');
      ImGui.PopStyleColor(1);
      ImGui.SameLine(0, 8);
      ImGui.Text(cmdHex(editingRule.cmd));
      if (CMD_NAMES[editingRule.cmd]) { ImGui.SameLine(0, 8); ImGui.Text(CMD_NAMES[editingRule.cmd]); }
      ImGui.Separator();
      renderHexTable(detail.compact, -1);
      handleHexCursorKeys(detail.compact);
    } else if (!hasSel) {
      ImGui.Spacing();
      ImGui.TextDisabled('  No packet selected.');
      ImGui.TextDisabled('  Click a row in the packet list on the left.');
    } else {
      const pkt = packets[selectedIdx];

      // Sync detail when selection changes
      if (detail.lastIdx !== selectedIdx) {
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

      renderHexTable(detail.compact, -1);
      handleHexCursorKeys(detail.compact);
    }
  } finally {
    ImGui.EndChild();
  }

  if (spoofRules.length === 0) ImGui.Separator();

  // ── Spoof rules: fixed height, always visible ─────────────────────────────
  ImGui.BeginChild('##ss', new ImVec2(0, SPOOF_SECTION_H), 0, 0);
  try {
    renderSpoofRulesSection();
  } finally {
    ImGui.EndChild();
  }
}

function renderSearchWindow(vpW, vpH) {
  if (!searchState.open) return;
  const winW = 284;
  const winH = 96;
  ImGui.SetNextWindowPos(new ImVec2(vpW - winW - 8, 28), 4);
  ImGui.SetNextWindowSize(new ImVec2(winW, winH), 4);
  const _swOpen = [true];
  ImGui.Begin('Search value', _swOpen, WF_NoResize);
  if (!_swOpen[0]) searchState.open = false;

  try {
    // ── Row 1: search input (fills row) + Find ─────────────────────────────
    ImGui.SetNextItemWidth(-(50));
    const valueRef = [searchState.value];
    if (ImGui.InputText('##search_value', valueRef, 256)) searchState.value = valueRef[0];
    ImGui.SameLine(0, 4);
    if (ImGui.Button('Find##sf')) runSearch();

    // ── Row 2: Datatype + Direction + Previous + Next ──────────────────────
    const _gap = 4;
    ImGui.SetNextItemWidth(76);
    if (ImGui.BeginCombo('##search_type_combo', searchState.type)) {
      try {
        for (const type of SEARCH_TYPES) {
          if (ImGui.Selectable(`${type}##search_window_type_${type}`, searchState.type === type))
            searchState.type = type;
        }
      } finally {
        ImGui.EndCombo();
      }
    }
    ImGui.SameLine(0, _gap);
    const SEARCH_DIRECTIONS = ['in/out', 'in', 'out'];
    const _dirLabel = searchState.direction === 'both' ? 'in/out' : searchState.direction;
    ImGui.SetNextItemWidth(76);
    if (ImGui.BeginCombo('##search_direction_combo', _dirLabel)) {
      try {
        for (const d of SEARCH_DIRECTIONS) {
          const val = d === 'in/out' ? 'both' : d;
          if (ImGui.Selectable(`${d}##search_window_direction_${d}`, searchState.direction === val))
            searchState.direction = val;
        }
      } finally {
        ImGui.EndCombo();
      }
    }
    ImGui.SameLine(0, _gap);
    ImGui.BeginDisabled(searchState.results.length === 0);
    if (ImGui.Button('Previous')) searchMove(-1);
    ImGui.SameLine(0, _gap);
    if (ImGui.Button('Next')) searchMove(1);
    ImGui.EndDisabled();

    // ── Row 3: result count ─────────────────────────────────────────────────
    const resultText = searchState.results.length === 0
      ? 'No results'
      : `${searchState.index + 1} / ${searchState.results.length}`;
    ImGui.TextDisabled(resultText);

  } finally {
    ImGui.End();
  }
}

// ─── Clear all rules confirmation modal ──────────────────────────────────────
function renderClearRulesConfirmModal(vpW, vpH) {
  if (!showClearRulesConfirm) return;
  ImGui.SetNextWindowPos(new ImVec2(Math.floor((vpW - 320) * 0.5), Math.floor((vpH - 90) * 0.5)), 4);
  ImGui.SetNextWindowSize(new ImVec2(320, 90), 4);
  ImGui.Begin('Clear Test Rules', null, WF_NoResize);
  try {
    ImGui.TextWrapped(`Clear all ${spoofRules.length} test rule${spoofRules.length !== 1 ? 's' : ''}? This cannot be undone.`);
    if (ImGui.Button('Clear all')) { pendingClearRules = true; showClearRulesConfirm = false; }
    ImGui.SameLine(0, 8);
    if (ImGui.Button('Cancel')) showClearRulesConfirm = false;
  } finally {
    ImGui.End();
  }
}

// ─── Delete rule confirmation modal ──────────────────────────────────────────
function renderDeleteRuleConfirmModal(vpW, vpH) {
  if (!pendingDeleteConfirmRule) return;
  ImGui.SetNextWindowPos(new ImVec2(Math.floor((vpW - 360) * 0.5), Math.floor((vpH - 90) * 0.5)), 4);
  ImGui.SetNextWindowSize(new ImVec2(360, 90), 4);
  ImGui.Begin('Delete Test Rule', null, WF_NoResize);
  try {
    const r = pendingDeleteConfirmRule;
    const _rName = CMD_NAMES[r.cmd] ? ` ${CMD_NAMES[r.cmd]}` : '';
    ImGui.TextWrapped(`Delete test rule for ${cmdHex(r.cmd)}${_rName} (${r.isInbound ? 'IN' : 'OUT'})?`);
    if (ImGui.Button('Delete')) {
      pendingDelete = { cmd: r.cmd, isInbound: r.isInbound };
      if (editingRule && editingRule.cmd === r.cmd && editingRule.isInbound === r.isInbound) {
        editingRule = null; detail.lastIdx = -2;
      }
      pendingDeleteConfirmRule = null;
    }
    ImGui.SameLine(0, 8);
    if (ImGui.Button('Cancel')) pendingDeleteConfirmRule = null;
  } finally {
    ImGui.End();
  }
}

// ─── Disable keep upstream confirmation modal ─────────────────────────────────
function renderDisableKeepUpstreamConfirmModal(vpW, vpH) {
  if (!showDisableKeepUpstreamConfirm) return;
  ImGui.SetNextWindowPos(new ImVec2(Math.floor((vpW - 340) * 0.5), Math.floor((vpH - 90) * 0.5)), 4);
  ImGui.SetNextWindowSize(new ImVec2(340, 90), 4);
  ImGui.Begin('Close upstream connections', null, WF_NoResize);
  try {
    ImGui.TextWrapped('Active upstream connections will be closed. Continue?');
    if (ImGui.Button('Close connections')) {
      keepUpstreamOpen = false;
      pendingKeepUpstreamOpen = false;
      pendingForceCloseUpstream = true;
      showDisableKeepUpstreamConfirm = false;
    }
    ImGui.SameLine(0, 8);
    if (ImGui.Button('Cancel')) showDisableKeepUpstreamConfirm = false;
  } finally {
    ImGui.End();
  }
}

// ─── Connection State modal ───────────────────────────────────────────────────
function renderConnectionStateModal(vpW, vpH) {
  if (!showConnectionStateModal) return;
  ImGui.SetNextWindowPos(new ImVec2(Math.floor((vpW - 210) * 0.5), Math.floor((vpH - 68) * 0.5)), 4);
  ImGui.SetNextWindowSize(new ImVec2(210, 68), 4);
  const openRef = [showConnectionStateModal];
  ImGui.Begin('Connection State', openRef, WF_NoResize);
  showConnectionStateModal = openRef[0];
  try {
    const activePorts = tcpStatuses.filter(s => s.connected).map(s => String(s.port));
    ImGui.TextDisabled('Upstream');
    ImGui.SameLine(0, 8);
    ImGui.PushStyleColor(0, activePorts.length ? COL_GREEN : COL_RED);
    ImGui.Text(activePorts.length ? activePorts.join(', ') : 'None');
    ImGui.PopStyleColor(1);
    ImGui.TextDisabled('WebSocket');
    ImGui.SameLine(0, 8);
    ImGui.PushStyleColor(0, wsReady ? COL_GREEN : COL_RED);
    ImGui.Text(wsReady ? 'connected' : 'disconnected');
    ImGui.PopStyleColor(1);
  } finally {
    ImGui.End();
  }
}

// ─── Main window ──────────────────────────────────────────────────────────────
function renderMainWindow(vpW, vpH) {
  ImGui.SetNextWindowPos(new ImVec2(0, 0));
  ImGui.SetNextWindowSize(new ImVec2(vpW, vpH));
  ImGui.Begin('##main', null,
    WF_NoMove | WF_NoResize | WF_NoCollapse | WF_NoTitleBar | WF_MenuBar);

  try {
    // ── Menu bar ───────────────────────────────────────────────────────────
    if (ImGui.BeginMenuBar()) {
      try {
        ImGui.Text('MGO2 SCANNER');
        ImGui.SameLine(0, 20);

        if (ImGui.BeginMenu('View')) {
          if (ImGui.MenuItem('Auto-scroll', '', autoScroll)) autoScroll = !autoScroll;
          if (ImGui.MenuItem('Keep upstream open', '', keepUpstreamOpen)) {
            if (keepUpstreamOpen && tcpStatuses.some(s => s.connected)) {
              showDisableKeepUpstreamConfirm = true;
            } else {
              keepUpstreamOpen = !keepUpstreamOpen;
              pendingKeepUpstreamOpen = keepUpstreamOpen;
            }
          }
          ImGui.Separator();
          if (ImGui.MenuItem('Connection State')) showConnectionStateModal = true;
          ImGui.EndMenu();
        }

        if (ImGui.BeginMenu('Edit')) {
          if (ImGui.MenuItem('Clear Packets')) {
            packets.length = 0; selectedIdx = -1;
            detail.compact = ''; detail.original = ''; detail.packet = ''; detail.lastIdx = -2; detail.cursorByte = 0;
          }
          if (ImGui.MenuItem('Clear Test Rules')) showClearRulesConfirm = true;
          ImGui.Separator();
          if (ImGui.MenuItem('Search value')) searchState.open = true;
          ImGui.EndMenu();
        }

      } finally {
        ImGui.EndMenuBar();
      }
    }
    // ── Panel layout ───────────────────────────────────────────────────────
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

// ─── Main render loop ─────────────────────────────────────────────────────────
let _canvas = null;

function frame() {
  _canvas.width  = _canvas.clientWidth;
  _canvas.height = _canvas.clientHeight;
  const vpW = _canvas.clientWidth;
  const vpH = _canvas.clientHeight;

  ImGuiImplWeb.BeginRender();
  try {
    renderMainWindow(vpW, vpH);
  } finally {
    ImGuiImplWeb.EndRender();
  }

  if (pendingDelete) { sendWS({ type: 'deleteSpoofRule', ...pendingDelete }); pendingDelete = null; }
  if (pendingSave)   { sendWS({ type: 'setSpoofRule',    ...pendingSave });   pendingSave   = null; }
  if (pendingSpoofingEnabled !== null) {
    sendWS({ type: 'setSpoofingEnabled', enabled: pendingSpoofingEnabled });
    pendingSpoofingEnabled = null;
  }
  if (pendingKeepUpstreamOpen !== null) {
    sendWS({ type: 'setKeepUpstreamOpen', enabled: pendingKeepUpstreamOpen });
    pendingKeepUpstreamOpen = null;
  }
  if (pendingForceCloseUpstream) {
    sendWS({ type: 'closeUpstreamConnections' });
    pendingForceCloseUpstream = false;
  }
  if (pendingExcludedRule) {
    sendWS({ type: 'setExcludedRule', ...pendingExcludedRule });
    pendingExcludedRule = null;
  }
  if (pendingClearRules) {
    for (const r of [...spoofRules]) {
      sendWS({ type: 'deleteSpoofRule', cmd: r.cmd, isInbound: r.isInbound });
    }
    pendingClearRules = false;
  }

  requestAnimationFrame(frame);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const canvas = document.getElementById('canvas');
  _canvas = canvas;
  await ImGuiImplWeb.Init({ canvas, backend: 'webgl2', loaderPath: './jsimgui.em.js' });
  ImGui.StyleColorsDark();
  connectWS();
  setStatus('ready');
  requestAnimationFrame(frame);
}

init().catch(err => {
  console.error('ImGui init failed:', err);
  setStatus('ERROR: ' + err.message);
});
