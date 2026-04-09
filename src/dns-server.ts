// DNS server with selective domain overrides.
//
// Hard overrides (per spec):
//   mgo2pc.com       → 0.0.0.0
//   game.mgo2pc.com  → 0.0.0.0
//
// All other queries are forwarded to upstream DNS (8.8.8.8).
//
// Note: binding port 53 requires administrator/root privileges.

import dgram from 'node:dgram';
import * as dnsPacket from 'dns-packet';

const DNS_PORT    = 53;
const UPSTREAM_IP   = process.env.DNS_UPSTREAM_IP   ?? '8.8.8.8';
const UPSTREAM_PORT = parseInt(process.env.DNS_UPSTREAM_PORT ?? '53', 10);

const OVERRIDE_IP = process.env.OVERRIDE_IP ?? '0.0.0.0';

// Domains that we intercept
const OVERRIDES: Record<string, string> = {
  'mgo2pc.com':      OVERRIDE_IP,
  'game.mgo2pc.com': OVERRIDE_IP,
};

function startDnsServer(): Promise<dgram.Socket> {
  return new Promise((resolve, reject) => {
    const server = dgram.createSocket('udp4');

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error('[DNS] Port 53 already in use — is another DNS running?');
      } else if (err.code === 'EACCES') {
        console.error('[DNS] Permission denied on port 53 — run as Administrator');
      } else {
        console.error('[DNS] Error:', err.message);
      }
      reject(err);
    });

    server.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      let query: dnsPacket.Packet;
      try {
        query = dnsPacket.decode(msg);
      } catch {
        return; // Malformed DNS packet — ignore
      }

      if (!query.questions || query.questions.length === 0) return;

      const q = query.questions[0];

      // Check if we have a hard override for this name (A record only)
      if (q.type === 'A' && OVERRIDES[q.name.toLowerCase()]) {
        const ip = OVERRIDES[q.name.toLowerCase()];
        console.log(`[DNS] Override: ${q.name} → ${ip}`);

        let resp: Buffer;
        try {
          resp = dnsPacket.encode({
            type:  'response',
            id:    query.id ?? 0,
            flags: dnsPacket.AUTHORITATIVE_ANSWER,
            questions: query.questions,
            answers: [{
              type:  'A',
              class: 'IN',
              name:  q.name,
              ttl:   300,
              data:  ip,
            }],
          });
        } catch (e) {
          console.error('[DNS] Encode error:', (e as Error).message);
          return;
        }

        server.send(resp, rinfo.port, rinfo.address);
        return;
      }

      // Forward to upstream
      forwardToUpstream(server, msg, rinfo, query.id ?? 0);
    });

    server.bind(DNS_PORT, '0.0.0.0', () => {
      console.log(`[DNS] Listening on port ${DNS_PORT}`);
      resolve(server);
    });
  });
}

function forwardToUpstream(
  server: dgram.Socket,
  msg: Buffer,
  clientRinfo: dgram.RemoteInfo,
  queryId: number
): void {
  const upstream = dgram.createSocket('udp4');
  let answered = false;

  const timer = setTimeout(() => {
    if (!answered) {
      upstream.close();
      console.warn(`[DNS] Upstream timeout for query id=${queryId}`);
    }
  }, 3000);

  upstream.on('message', (reply: Buffer) => {
    answered = true;
    clearTimeout(timer);
    upstream.close();
    server.send(reply, clientRinfo.port, clientRinfo.address);
  });

  upstream.on('error', (err: Error) => {
    clearTimeout(timer);
    upstream.close();
    console.error('[DNS] Upstream error:', err.message);
  });

  upstream.send(msg, UPSTREAM_PORT, UPSTREAM_IP);
}

export default startDnsServer;
