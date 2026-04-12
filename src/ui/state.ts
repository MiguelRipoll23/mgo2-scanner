import type {
  Packet,
  SpoofRule,
  ExcludedRule,
  TcpStatus,
  SearchResult,
  EditingRule,
  PendingDelete,
  PendingSave,
  PendingExcludedRule,
} from './types/index.js';

// Single shared state object — all modules read and mutate this directly.
export const state = {
  // ── Core data ────────────────────────────────────────────────────────────────
  packets:       [] as Packet[],
  spoofRules:    [] as SpoofRule[],
  excludedRules: [] as ExcludedRule[],
  tcpStatuses:   [] as TcpStatus[],

  // ── WebSocket ────────────────────────────────────────────────────────────────
  ws:      null as WebSocket | null,
  wsReady: false,

  // ── App state ────────────────────────────────────────────────────────────────
  spoofingEnabled:   false,
  keepUpstreamOpen:  false,
  autoScroll:        false,
  selectedIdx:       -1,

  // ── Current-packet detail (updated on selection change) ───────────────────
  detail: {
    compact:    '',   // current payload hex (may be edited)
    original:   '',   // as-captured payload hex — never changed by edits
    packet:     '',   // full packet header + plaintext payload hex
    lastIdx:    -2,
    cursorByte: 0,
  },

  // ── Data-inspector editor state ──────────────────────────────────────────
  inspectorEd: {
    key:            '',
    cursorKey:      '',
    cStringLen:     1,
    cstringByteKey: '',
    fields:         {} as Record<string, string>,
  },

  // ── Search ───────────────────────────────────────────────────────────────
  searchState: {
    open:               false,
    type:               'string' as string,
    value:              '',
    results:            [] as SearchResult[],
    index:              -1,
    direction:          'both' as string,
    selectedPacketKey:  '',
  },

  // ── Deferred WS sends (processed after ImGui calls) ──────────────────────
  pendingDelete:           null as PendingDelete | null,
  pendingSave:             null as PendingSave   | null,
  pendingClearRules:       false,
  pendingSpoofingEnabled:  null as boolean | null,
  pendingExcludedRule:     null as PendingExcludedRule | null,
  pendingKeepUpstreamOpen: null as boolean | null,
  pendingForceCloseUpstream: false,

  // ── UI visibility flags ───────────────────────────────────────────────────
  showConnectionStateModal:      false,
  showDisableKeepUpstreamConfirm: false,
  showClearRulesConfirm:          false,

  // ── Rule editing ─────────────────────────────────────────────────────────
  editingRule:            null as EditingRule  | null,
  pendingDeleteConfirmRule: null as PendingDelete | null,
};
