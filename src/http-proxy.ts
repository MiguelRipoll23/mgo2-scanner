// HTTP proxy on port 80.
// Forwards requests to the real mgo2pc.com server (resolved via upstream DNS
// 8.8.8.8 to bypass our own DNS override), returns responses unchanged.
//
// Note: binding port 80 requires administrator/root privileges on Windows.

import net from 'node:net';
import dns from 'node:dns';

const HTTP_PORT   = 80;
const TARGET_HOST = 'mgo2pc.com';

// Resolve real IP via 8.8.8.8 (bypasses our local DNS override)
const _resolver = new dns.Resolver();
_resolver.setServers(['8.8.8.8']);

let _realIp: string | null = null;

function resolveRealIp(): Promise<string | null> {
  return new Promise(resolve => {
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

async function startHttpProxy(): Promise<net.Server> {
  await resolveRealIp();

  return new Promise((resolve, reject) => {
    const server = net.createServer(clientSock => {
      const targetHost = _realIp ?? TARGET_HOST;
      const upstream   = net.createConnection({ host: targetHost, port: 80 });

      upstream.on('error', (err: Error) => {
        console.error(`[HTTP] Upstream error: ${err.message}`);
        clientSock.destroy();
      });

      clientSock.on('error', (err: Error) => {
        console.error(`[HTTP] Client error: ${err.message}`);
        upstream.destroy();
      });

      // Pipe in both directions — no modification (spec: "return responses unchanged")
      clientSock.pipe(upstream);
      upstream.pipe(clientSock);

      clientSock.on('close', () => upstream.destroy());
      upstream.on('close', () => clientSock.destroy());
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
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
      console.log(`[HTTP] Proxy listening on port ${HTTP_PORT} → ${_realIp ?? TARGET_HOST}:80`);
      resolve(server);
    });
  });
}

export default startHttpProxy;
