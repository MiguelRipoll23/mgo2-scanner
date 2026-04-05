'use strict';
// HTTP proxy on port 80.
// Forwards requests to the real mgo2pc.com server (resolved via upstream DNS
// 8.8.8.8 to bypass our own DNS override), returns responses unchanged.
//
// Note: binding port 80 requires administrator/root privileges on Windows.

const net = require('net');
const dns = require('dns');

const HTTP_PORT  = 80;
const TARGET_HOST = 'mgo2pc.com';

// Resolve real IP via 8.8.8.8 (bypasses our local DNS override)
const _resolver = new dns.Resolver();
_resolver.setServers(['8.8.8.8']);

let _realIp = null;

function resolveRealIp() {
  return new Promise((resolve, reject) => {
    _resolver.resolve4(TARGET_HOST, (err, addrs) => {
      if (err || !addrs || addrs.length === 0) {
        console.warn(`[HTTP] Could not resolve ${TARGET_HOST} via 8.8.8.8 — will use hostname directly`);
        resolve(null);
      } else {
        _realIp = addrs[0];
        console.log(`[HTTP] Resolved ${TARGET_HOST} → ${_realIp}`);
        resolve(_realIp);
      }
    });
  });
}

function startHttpProxy() {
  return new Promise(async (resolve, reject) => {
    await resolveRealIp();

    const server = net.createServer(clientSock => {
      const targetHost = _realIp || TARGET_HOST;
      const upstream   = net.createConnection({ host: targetHost, port: 80 });

      upstream.on('error', err => {
        console.error(`[HTTP] Upstream error: ${err.message}`);
        clientSock.destroy();
      });

      clientSock.on('error', err => {
        console.error(`[HTTP] Client error: ${err.message}`);
        upstream.destroy();
      });

      // Pipe in both directions — no modification (spec: "return responses unchanged")
      clientSock.pipe(upstream);
      upstream.pipe(clientSock);

      clientSock.on('close', () => upstream.destroy());
      upstream.on('close', () => clientSock.destroy());
    });

    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error('[HTTP] Port 80 already in use');
      } else if (err.code === 'EACCES') {
        console.error('[HTTP] Permission denied on port 80 — run as Administrator');
      } else {
        console.error('[HTTP] Server error:', err.message);
      }
      reject(err);
    });

    server.listen(HTTP_PORT, '0.0.0.0', () => {
      console.log(`[HTTP] Proxy listening on port ${HTTP_PORT} → ${_realIp || TARGET_HOST}:80`);
      resolve(server);
    });
  });
}

module.exports = startHttpProxy;
