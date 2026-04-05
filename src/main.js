'use strict';
// MGO2 Foxdie — entry point
//
// Starts:
//   - DNS server    (port 53  — requires Administrator)
//   - HTTP proxy    (port 80  — requires Administrator)
//   - TCP proxy     (ports 5731, 5732, 5733, 5734, 5738)
//   - Web GUI       (http://127.0.0.1:8080 — Dear ImGui via @mori2003/jsimgui + WebGL2)
//
// Run with: node src/main.js
// Run as Administrator for ports 53 and 80.

const startDnsServer  = require('./dns-server.js');
const startHttpProxy  = require('./http-proxy.js');
const startTcpProxy   = require('./tcp-proxy.js');
const startWebServer  = require('./web-server.js');

const DISABLE_DNS = process.env.DISABLE_DNS === 'true' || process.env.DISABLE_DNS === '1';

async function main() {
  console.log('=== MGO2 Foxdie starting ===');
  if (DISABLE_DNS) console.log('[main] DNS server disabled via DISABLE_DNS');

  const tasks = [
    DISABLE_DNS ? Promise.resolve() : startDnsServer(),
    startHttpProxy(),
    startTcpProxy(),
    startWebServer(),
  ];

  const results = await Promise.allSettled(tasks);

  const labels = ['DNS server', 'HTTP proxy', 'TCP proxy', 'Web GUI'];
  for (let i = 0; i < labels.length; i++) {
    if (DISABLE_DNS && i === 0) continue;
    if (results[i].status === 'rejected') {
      console.warn(`[main] ${labels[i]} failed: ${results[i].reason.message}`);
    }
  }

  // Open the GUI in the default browser automatically
  if (results[3].status === 'fulfilled') {
    const { exec } = require('child_process');
    exec('start http://127.0.0.1:8080');
  }
}

main().catch(err => {
  console.error('[main] Fatal:', err);
  process.exit(1);
});
