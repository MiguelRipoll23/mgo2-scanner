import { ImGui } from '/jsimgui/mod.js';

// ─── ImGui colour slots ───────────────────────────────────────────────────────
export const IMGUI_COL_TEXT             = ImGui.Col?.Text             ?? 0;
export const IMGUI_COL_FRAME_BG         = ImGui.Col?.FrameBg          ?? 7;
export const IMGUI_COL_FRAME_BG_HOVERED = ImGui.Col?.FrameBgHovered   ?? 8;
export const IMGUI_COL_FRAME_BG_ACTIVE  = ImGui.Col?.FrameBgActive    ?? 9;
export const IMGUI_COL_BUTTON           = ImGui.Col?.Button           ?? 21;
export const IMGUI_COL_BUTTON_HOVERED   = ImGui.Col?.ButtonHovered    ?? 22;
export const IMGUI_COL_BUTTON_ACTIVE    = ImGui.Col?.ButtonActive     ?? 23;
export const IMGUI_COL_MENUBAR_BG       = ImGui.Col?.MenuBarBg        ?? 13;

// ─── Colour helpers ───────────────────────────────────────────────────────────
// Pack r,g,b,a floats [0-1] into IM_COL32 (ABGR byte order expected by PushStyleColor)
export function col32(r: number, g: number, b: number, a = 1.0): number {
  return (((Math.round(a * 255) & 0xff) << 24)
        | ((Math.round(b * 255) & 0xff) << 16)
        | ((Math.round(g * 255) & 0xff) << 8)
        |  (Math.round(r * 255) & 0xff)) >>> 0;
}

export const COL_GREEN      = col32(0.40, 0.95, 0.40); // IN / connected
export const COL_PURPLE     = col32(0.78, 0.45, 0.95); // OUT
export const COL_RED        = col32(0.95, 0.40, 0.40); // disconnected
export const COL_ORANGE     = col32(0.95, 0.62, 0.18); // modified values
export const COL_BLUE       = col32(0.40, 0.72, 0.98); // counters / search highlights
export const COL_TESTING_BG = col32(0.05, 0.22, 0.05); // dark-green menubar when testing

// ─── Command ID → name ────────────────────────────────────────────────────────
export const CMD_NAMES: Record<number, string> = {
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

export function cmdHex(cmd: number): string {
  return '0x' + cmd.toString(16).toUpperCase().padStart(4, '0');
}

export function cmdName(cmd: number): string {
  return CMD_NAMES[cmd] || 'UNKNOWN';
}

export function fmtCmd(cmd: number): string {
  const n = CMD_NAMES[cmd];
  return n ? `${cmdHex(cmd)} ${n}` : cmdHex(cmd);
}

// ─── ImGui window / table / column flag constants ─────────────────────────────
export const WF_NoMove     = 4;
export const WF_NoResize   = 2;
export const WF_NoCollapse = 32;
export const WF_NoTitleBar = 1;
export const WF_MenuBar    = 1024;

export const TF_RowBg          = 64;
export const TF_Borders        = 1920;
export const TF_ScrollX        = 16777216;
export const TF_ScrollY        = 33554432;
export const TF_SizingFixedFit = 8192;

export const CF_WidthFixed   = 16;
export const CF_WidthStretch = 8;

export const SEL_SpanAllColumns = 2;

// ─── Layout / misc constants ──────────────────────────────────────────────────
export const BPR            = 16;    // bytes per row in the hex table
export const MAX_PACKETS    = 2000;
export const CSTRING_SCAN_LIMIT = 32;
export const SPOOF_SECTION_H    = 180; // px reserved at bottom for spoof rules

export const SEARCH_TYPES = ['uint8', 'uint16', 'uint32', 'string', 'hex'] as const;
