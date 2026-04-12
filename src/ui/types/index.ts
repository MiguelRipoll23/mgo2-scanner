export interface Packet {
  type: 'packet';
  cmd: number;
  isInbound: boolean;
  payload: string;
  spoofedPayload?: string;
  packet: string;
  payloadLen: number;
  timestamp: string;
}

export interface SpoofRule {
  cmd: number;
  isInbound: boolean;
  payloadHex: string;
}

export interface ExcludedRule {
  cmd: number;
  isInbound: boolean;
}

export interface TcpStatus {
  port: number;
  connected: boolean;
}

export interface SearchResult {
  packetIdx: number;
  start: number;
  len: number;
}

export interface EditingRule {
  cmd: number;
  isInbound: boolean;
  payloadHex: string;
}

export interface PendingDelete {
  cmd: number;
  isInbound: boolean;
}

export interface PendingSave {
  cmd: number;
  isInbound: boolean;
  payloadHex: string;
}

export interface PendingExcludedRule {
  cmd: number;
  isInbound: boolean;
  enabled: boolean;
}
