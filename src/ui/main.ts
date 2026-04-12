// MGO2 Scanner — Dear ImGui frontend (TypeScript source)
// Bundled by esbuild → public/app.js
// Communicates with the Node.js backend over WebSocket at ws://<host>:<port>/ws

import { ImGuiImplWeb, ImGui } from '/jsimgui/mod.js';
import { state }       from './state.js';
import { connectWS, sendWS, setStatus } from './websocket.js';
import { renderMainWindow } from './components/mainWindow.js';

let _canvas: HTMLCanvasElement | null = null;

function frame(): void {
  const canvas = _canvas!;
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const vpW = canvas.clientWidth;
  const vpH = canvas.clientHeight;

  // ── Update document title to reflect testing state ──────────────────────
  document.title = state.spoofingEnabled ? 'MGO2 Scanner [TESTING]' : 'MGO2 Scanner';

  ImGuiImplWeb.BeginRender();
  try {
    renderMainWindow(vpW, vpH);
  } finally {
    ImGuiImplWeb.EndRender();
  }

  // ── Flush deferred WS actions (after all ImGui calls) ────────────────────
  if (state.pendingDelete) {
    sendWS({ type: 'deleteSpoofRule', ...state.pendingDelete });
    state.pendingDelete = null;
  }
  if (state.pendingSave) {
    sendWS({ type: 'setSpoofRule', ...state.pendingSave });
    state.pendingSave = null;
  }
  if (state.pendingSpoofingEnabled !== null) {
    sendWS({ type: 'setSpoofingEnabled', enabled: state.pendingSpoofingEnabled });
    state.pendingSpoofingEnabled = null;
  }
  if (state.pendingKeepUpstreamOpen !== null) {
    sendWS({ type: 'setKeepUpstreamOpen', enabled: state.pendingKeepUpstreamOpen });
    state.pendingKeepUpstreamOpen = null;
  }
  if (state.pendingForceCloseUpstream) {
    sendWS({ type: 'closeUpstreamConnections' });
    state.pendingForceCloseUpstream = false;
  }
  if (state.pendingExcludedRule) {
    sendWS({ type: 'setExcludedRule', ...state.pendingExcludedRule });
    state.pendingExcludedRule = null;
  }
  if (state.pendingClearRules) {
    for (const r of [...state.spoofRules]) {
      sendWS({ type: 'deleteSpoofRule', cmd: r.cmd, isInbound: r.isInbound });
    }
    state.pendingClearRules = false;
  }

  requestAnimationFrame(frame);
}

async function init(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  _canvas = canvas;
  await ImGuiImplWeb.Init({ canvas, backend: 'webgl2', loaderPath: './jsimgui.em.js' });
  ImGui.StyleColorsDark();
  connectWS();
  setStatus('ready');
  requestAnimationFrame(frame);
}

init().catch((err: Error) => {
  console.error('ImGui init failed:', err);
  setStatus('ERROR: ' + err.message);
});
