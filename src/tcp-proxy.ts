// TCP proxy for MGO2 game ports 5731-5739.
//
// For each inbound client connection on port P:
//   1. Connect to the real game server at game.mgo2pc.com:P (resolved via 8.8.8.8)
//   2. In both directions, for each TCP segment ("data" event):
//        a. XOR-decrypt (key 0x5A7085AF, starting at index 0 per segment)
//        b. Parse MGO2 packet headers (24-byte header: cmd u16be + payloadLen u16be + seq u32be + 16 bytes)
//        c. Decode payloads for inspection when a command uses packet-level Blowfish
//        d. Emit parsed packets to shared state for GUI display
//        e. Check spoof rules; if matched, replace payload, re-encrypt, re-XOR
//        f. Forward the (possibly modified) buffer to the other side
//
// Encryption sources: decode-tcp.ts (XOR) + blowfish-key.ts (Blowfish key table)

import net from 'node:net';
import dns from 'node:dns';
import state from './state';
import {
  xorCrypt,
  decryptPayload,
  encryptPayload,
  decodeSessionPayload,
  encodeSessionPayload,
  computePacketChecksum,
} from './crypto';

// Game ports — from decode-tcp.ts TARGET_PORTS
const GAME_PORTS    = [5731, 5732, 5733, 5735, 5737, 5738, 5739];
const TARGET_HOST   = 'game.mgo2pc.com';
const HEADER_SIZE   = 24; // cmd(2) + payloadLen(2) + seq(4) + unknown(16) = 24
const KEEPALIVE_CMD = 0x0005;
const KEEPALIVE_INTERVAL_MS = 30_000;

const _resolver = new dns.Resolver();
_resolver.setServers(['8.8.8.8']);

let _realIp: string | null = null;

function resolveServerIp(): Promise<string | null> {
  return new Promise(resolve => {
    _resolver.resolve4(TARGET_HOST, (err, addrs) => {
      if (err || !addrs || addrs.length === 0) {
        console.warn(`[TCP] Could not resolve ${TARGET_HOST} — will use hostname directly`);
        resolve(null);
      } else {
        _realIp = addrs[0];
        console.log(`[TCP] Resolved ${TARGET_HOST} → ${_realIp}`);
        resolve(_realIp);
      }
    });
  });
}

function parseLastSequence(buf: Buffer): number | null {
  const decrypted = xorCrypt(buf);
  let offset = 0;
  let lastSeq: number | null = null;

  while (offset + HEADER_SIZE <= decrypted.length) {
    const payloadLen = decrypted.readUInt16BE(offset + 2);
    if (payloadLen > 0x3ff) break;
    if (offset + HEADER_SIZE + payloadLen > decrypted.length) break;
    lastSeq = decrypted.readUInt32BE(offset + 4);
    offset += HEADER_SIZE + payloadLen;
  }

  return lastSeq;
}

function buildKeepAlivePacket(sequence: number): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16BE(KEEPALIVE_CMD, 0);
  header.writeUInt16BE(0, 2);
  header.writeUInt32BE(sequence >>> 0, 4);
  computePacketChecksum(header.subarray(0, 8), Buffer.alloc(0)).copy(header, 8);
  return xorCrypt(header);
}

// ─── Packet parsing + spoof ───────────────────────────────────────────────────

// Process one TCP segment buffer:
//   - XOR-decrypt
//   - Parse all complete MGO2 packets inside it
//   - Emit each to state for GUI display (with Blowfish-decrypted payload)
//   - Apply spoof rules: replace payload bytes in the decrypted buffer
//   - XOR-re-encrypt modified buffer
// Returns the buffer to forward (possibly modified).
export function processSegment(buf: Buffer, isInbound: boolean, port: number | string = '?'): Buffer {
  const decrypted = xorCrypt(buf); // XOR-decrypt; XOR is self-inverse
  let modified    = false;

  let offset = 0;
  while (offset + HEADER_SIZE <= decrypted.length) {
    const cmd        = decrypted.readUInt16BE(offset);
    const payloadLen = decrypted.readUInt16BE(offset + 2);

    // Validate — from decode-tcp.ts: payloadLength > 0x3ff means broken
    if (payloadLen > 0x3ff) break;
    if (offset + HEADER_SIZE + payloadLen > decrypted.length) break;

    const payloadStart = offset + HEADER_SIZE;
    const payloadEnd   = payloadStart + payloadLen;
    const headerRaw    = decrypted.slice(offset, payloadStart);
    const payloadRaw   = decrypted.slice(payloadStart, payloadEnd);

    // Decode packet-level encrypted payloads for display only.
    const payloadDecrypted = decodeSessionPayload(
      decryptPayload(payloadRaw, cmd, isInbound),
      cmd,
      isInbound
    );

    // Check spoof rule before emitting so each packet carries its effective payload
    const rule = state.isSpoofingEnabled() ? state.getSpoofRule(cmd, isInbound) : null;
    let effectivePayload = payloadDecrypted;
    if (rule) {
      const spoofBuf = Buffer.from(rule.payloadHex.replace(/\s+/g, ''), 'hex');
      const modifiedPayload = Buffer.from(payloadDecrypted);
      spoofBuf.copy(modifiedPayload, 0, 0, Math.min(spoofBuf.length, payloadLen));
      effectivePayload = modifiedPayload;
    }

    // Emit to GUI — includes spoofedPayload when a rule was applied
    state.addPacket({
      cmd,
      payloadLen,
      payload:        Buffer.from(payloadDecrypted),
      spoofedPayload: rule ? Buffer.from(effectivePayload) : null,
      packet:         Buffer.concat([headerRaw, payloadDecrypted]),
      isInbound,
      timestamp:      Date.now(),
    });

    if (rule) {
      // Rebuild the full packet from the original XOR-decrypted header and the
      // spoofed payload, then encode the payload back to wire form if needed.
      const wirePayload = encryptPayload(
        encodeSessionPayload(effectivePayload, cmd, isInbound),
        cmd,
        isInbound
      );
      const packetOut = Buffer.alloc(HEADER_SIZE + payloadLen);
      headerRaw.copy(packetOut, 0, 0, 8);
      computePacketChecksum(packetOut.subarray(0, 8), wirePayload).copy(packetOut, 8);
      wirePayload.copy(packetOut, HEADER_SIZE);
      packetOut.copy(decrypted, offset);
      modified = true;
    }

    offset += HEADER_SIZE + payloadLen;
  }

  if (modified) {
    // Re-XOR-encrypt the modified decrypted buffer; XOR is self-inverse
    return xorCrypt(decrypted);
  }

  // No spoof applied — forward original bytes without re-processing
  return buf;
}

// ─── Per-port proxy server ────────────────────────────────────────────────────

function createProxyServer(port: number): Promise<net.Server> {
  return new Promise(resolve => {
    let upstream: net.Socket | null = null;
    let attachedClient: net.Socket | null = null;
    let keepAliveTimer: NodeJS.Timeout | null = null;
    let nextClientSequence = 0;
    const targetHost = _realIp ?? TARGET_HOST;
    const _silent = new Set(['ECONNRESET', 'EPIPE', 'ECONNREFUSED', 'ETIMEDOUT']);

    function publishStatus(): void {
      state.setTcpStatus(port, {
        connected: !!(upstream && !upstream.destroyed && upstream.readyState === 'open'),
        attachedClient: !!(attachedClient && !attachedClient.destroyed),
      });
    }

    function stopKeepAlive(): void {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
    }

    function maybeStartKeepAlive(): void {
      const canKeepAlive =
        state.isKeepUpstreamOpen() &&
        upstream !== null &&
        !upstream.destroyed &&
        upstream.readyState === 'open' &&
        attachedClient === null;

      if (!canKeepAlive) {
        stopKeepAlive();
        return;
      }
      if (keepAliveTimer) return;

      keepAliveTimer = setInterval(() => {
        if (
          !state.isKeepUpstreamOpen() ||
          upstream === null ||
          upstream.destroyed ||
          upstream.readyState !== 'open' ||
          attachedClient !== null
        ) {
          stopKeepAlive();
          return;
        }

        try {
          upstream.write(buildKeepAlivePacket(nextClientSequence));
          nextClientSequence = (nextClientSequence + 1) >>> 0;
        } catch {
          stopKeepAlive();
        }
      }, KEEPALIVE_INTERVAL_MS);
    }

    function cleanupUpstream(): void {
      stopKeepAlive();
      if (upstream) {
        upstream.removeAllListeners();
        upstream.destroy();
        upstream = null;
      }
      publishStatus();
    }

    function ensureUpstream(): net.Socket {
      if (upstream && !upstream.destroyed) return upstream;

      upstream = net.createConnection({ host: targetHost, port });
      publishStatus();

      upstream.on('connect', () => {
        console.log(`[TCP:${port}] Connected to ${targetHost}:${port}`);
        publishStatus();
        maybeStartKeepAlive();
      });

      upstream.on('error', (err: NodeJS.ErrnoException) => {
        if (!_silent.has(err.code ?? ''))
          console.error(`[TCP:${port}] Upstream error: ${err.message}`);
        if (attachedClient && !attachedClient.destroyed) attachedClient.destroy();
        cleanupUpstream();
      });

      upstream.on('data', (buf: Buffer) => {
        const out = processSegment(buf, false, port);
        if (attachedClient && !attachedClient.destroyed) attachedClient.write(out);
      });

      upstream.on('close', () => {
        stopKeepAlive();
        upstream = null;
        publishStatus();
        if (attachedClient && !attachedClient.destroyed) attachedClient.destroy();
      });

      return upstream;
    }

    state.emitter.on('keepUpstreamChanged', (enabled: boolean) => {
      if (!enabled && upstream && !upstream.destroyed && !attachedClient) {
        cleanupUpstream();
        return;
      }
      if (enabled) maybeStartKeepAlive();
    });

    const server = net.createServer(localClient => {
      if (attachedClient && !attachedClient.destroyed) {
        console.warn(`[TCP:${port}] Rejecting extra client while port already attached`);
        localClient.destroy();
        return;
      }

      console.log(`[TCP:${port}] Client connected from ${localClient.remoteAddress}`);
      attachedClient = localClient;
      stopKeepAlive();
      publishStatus();
      ensureUpstream();

      localClient.on('error', (err: NodeJS.ErrnoException) => {
        if (!_silent.has(err.code ?? ''))
          console.error(`[TCP:${port}] Client error: ${err.message}`);
        if (!state.isKeepUpstreamOpen()) cleanupUpstream();
      });

      // Client → Server (inbound = true)
      localClient.on('data', (buf: Buffer) => {
        const lastSequence = parseLastSequence(buf);
        if (lastSequence !== null) nextClientSequence = (lastSequence + 1) >>> 0;
        const out = processSegment(buf, true, port);
        if (upstream && !upstream.destroyed) upstream.write(out);
      });

      localClient.on('close', () => {
        console.log(`[TCP:${port}] Client disconnected`);
        if (attachedClient === localClient) attachedClient = null;
        publishStatus();
        if (!state.isKeepUpstreamOpen()) cleanupUpstream();
        else maybeStartKeepAlive();
      });
    });

    server.on('error', (err: Error) => {
      console.error(`[TCP:${port}] Server error: ${err.message}`);
    });

    server.listen(port, '0.0.0.0', () => {
      console.log(`[TCP:${port}] Proxy listening`);
      publishStatus();
      resolve(server);
    });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function startTcpProxy(): Promise<net.Server[]> {
  await resolveServerIp();
  const servers = await Promise.all(GAME_PORTS.map(createProxyServer));
  console.log(`[TCP] All ${GAME_PORTS.length} proxy servers running`);
  return servers;
}

export default startTcpProxy;
