'use strict';
// DNS server with selective domain overrides.
//
// Hard overrides (per spec):
//   mgo2pc.com       → 0.0.0.0
//   game.mgo2pc.com  → 0.0.0.0
//
// All other queries are forwarded to upstream DNS (8.8.8.8).
//
// Requires: npm install dns-packet
// Note: binding port 53 requires administrator/root privileges.

const dgram     = require('dgram');
const dnsPacket = require('dns-packet');

const DNS_PORT    = 53;
const UPSTREAM_IP   = process.env.DNS_UPSTREAM_IP   || '8.8.8.8';
const UPSTREAM_PORT = parseInt(process.env.DNS_UPSTREAM_PORT || '53', 10);

const OVERRIDE_IP = process.env.OVERRIDE_IP || '0.0.0.0';

// Domains that we intercept
const OVERRIDES = {
  'mgo2pc.com':      OVERRIDE_IP,
  'game.mgo2pc.com': OVERRIDE_IP,
};

// Pending upstream queries: id → { socket, rinfo, timer }
const _pending = new Map();

function startDnsServer() {
  return new Promise((resolve, reject) => {
    const server = dgram.createSocket('udp4');

    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error('[DNS] Port 53 already in use — is another DNS running?');
      } else if (err.code === 'EACCES') {
        console.error('[DNS] Permission denied on port 53 — run as Administrator');
      } else {
        console.error('[DNS] Error:', err.message);
      }
      reject(err);
    });

    server.on('message', (msg, rinfo) => {
      let query;
      try {
        query = dnsPacket.decode(msg);
      } catch {
        return; // Malformed DNS packet — ignore
      }

      if (!query || !query.questions || query.questions.length === 0) return;

      const q = query.questions[0];

      // Check if we have a hard override for this name (A record only)
      if (q.type === 'A' && OVERRIDES[q.name.toLowerCase()]) {
        const ip = OVERRIDES[q.name.toLowerCase()];
        console.log(`[DNS] Override: ${q.name} → ${ip}`);

        let resp;
        try {
          resp = dnsPacket.encode({
            type:  'response',
            id:    query.id,
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
          console.error('[DNS] Encode error:', e.message);
          return;
        }

        server.send(resp, rinfo.port, rinfo.address);
        return;
      }

      // Forward to upstream
      forwardToUpstream(server, msg, rinfo, query.id);
    });

    server.bind(DNS_PORT, '0.0.0.0', () => {
      console.log(`[DNS] Listening on port ${DNS_PORT}`);
      resolve(server);
    });
  });
}

function forwardToUpstream(server, msg, clientRinfo, queryId) {
  const upstream = dgram.createSocket('udp4');
  let answered = false;

  const timer = setTimeout(() => {
    if (!answered) {
      upstream.close();
      console.warn(`[DNS] Upstream timeout for query id=${queryId}`);
    }
  }, 3000);

  upstream.on('message', reply => {
    answered = true;
    clearTimeout(timer);
    upstream.close();
    server.send(reply, clientRinfo.port, clientRinfo.address);
  });

  upstream.on('error', err => {
    clearTimeout(timer);
    upstream.close();
    console.error('[DNS] Upstream error:', err.message);
  });

  upstream.send(msg, UPSTREAM_PORT, UPSTREAM_IP);
}

module.exports = startDnsServer;
