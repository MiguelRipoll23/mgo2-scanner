// MGO2 SCANNER — entry point
//
// Starts:
//   - DNS server    (port 53  — requires Administrator)
//   - HTTP proxy    (port 80  — requires Administrator)
//   - TCP proxy     (ports 5731, 5732, 5733, 5734, 5738)
//   - Web UI        (http://127.0.0.1:8080 — Dear ImGui via @mori2003/jsimgui + WebGL2)
//
// Run with: tsx src/main.ts
// Run as Administrator for ports 53 and 80.

import { exec } from 'node:child_process';
import startDnsServer  from './dns-server.js';
import startHttpProxy  from './http-proxy.js';
import startTcpProxy   from './tcp-proxy.js';
import startWebServer  from './web-server.js';

const DISABLE_DNS = process.env.DISABLE_DNS === 'true' || process.env.DISABLE_DNS === '1';

async function main(): Promise<void> {
  if (DISABLE_DNS) console.log('[main] DNS server disabled via DISABLE_DNS');

  const tasks = [
    DISABLE_DNS ? Promise.resolve(undefined) : startDnsServer(),
    startHttpProxy(),
    startTcpProxy(),
    startWebServer(),
  ];

  const results = await Promise.allSettled(tasks);

  const labels = ['DNS server', 'HTTP proxy', 'TCP proxy', 'Web UI'];
  for (let i = 0; i < labels.length; i++) {
    if (DISABLE_DNS && i === 0) continue;
    if (results[i].status === 'rejected') {
      console.warn(`[main] ${labels[i]} failed: ${(results[i] as PromiseRejectedResult).reason.message}`);
    }
  }

  // Open the GUI in the default browser automatically
  if (results[3].status === 'fulfilled') {
    exec('start http://127.0.0.1:8080');
  }
}

main().catch(err => {
  console.error('[main] Fatal:', err);
  process.exit(1);
});
