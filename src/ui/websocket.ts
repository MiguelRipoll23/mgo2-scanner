import { state } from './state.js';
import { MAX_PACKETS } from './constants.js';
import { loadSelectedDetailFromPacket } from './utils/packet.js';

export function connectWS(): void {
  const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}/ws`);
  state.ws = ws;

  ws.onopen = () => {
    state.wsReady = true;
    setStatus('connected');
  };

  ws.onclose = () => {
    state.wsReady = false;
    setStatus('disconnected - retrying...');
    setTimeout(connectWS, 2000);
  };

  ws.onerror = () => setStatus('WS error');

  ws.onmessage = (ev: MessageEvent) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(ev.data as string) as Record<string, unknown>;
    } catch {
      return;
    }

    if (msg.type === 'packet') {
      state.packets.push(msg as unknown as import('./types/index.js').Packet);
      if (state.packets.length > MAX_PACKETS) state.packets.shift();
      if (state.selectedIdx >= state.packets.length) state.selectedIdx = state.packets.length - 1;
    } else if (msg.type === 'spoofRules') {
      state.spoofRules.length = 0;
      for (const r of msg.rules as import('./types/index.js').SpoofRule[]) state.spoofRules.push(r);
      if (state.editingRule) {
        const still = state.spoofRules.find(
          r => r.cmd === state.editingRule!.cmd && r.isInbound === state.editingRule!.isInbound,
        );
        if (!still) state.editingRule = null;
      }
      if (state.selectedIdx >= 0 && state.packets[state.selectedIdx]) loadSelectedDetailFromPacket();
    } else if (msg.type === 'excludedRules') {
      state.excludedRules.length = 0;
      for (const r of msg.rules as import('./types/index.js').ExcludedRule[]) state.excludedRules.push(r);
    } else if (msg.type === 'spoofingState') {
      state.spoofingEnabled = !!(msg.enabled);
    } else if (msg.type === 'keepUpstreamState') {
      state.keepUpstreamOpen = !!(msg.enabled);
    } else if (msg.type === 'tcpStatuses') {
      state.tcpStatuses.length = 0;
      for (const s of msg.statuses as import('./types/index.js').TcpStatus[]) state.tcpStatuses.push(s);
    }
  };
}

export function sendWS(obj: Record<string, unknown>): void {
  if (state.wsReady && state.ws && state.ws.readyState === WebSocket.OPEN)
    state.ws.send(JSON.stringify(obj));
}

export function setStatus(txt: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = txt;
}
