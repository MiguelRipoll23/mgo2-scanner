'use strict';
// Encryption/decryption logic ported exactly from:
//   C:\Users\migue\Desktop\network\decode-tcp.ts
//
// XOR key:   0x5A70 85AF  (KEY_BYTES in decode-tcp.ts)
// Blowfish:  custom 8-round Feistel using the pre-expanded key table from blowfish-key.ts
// Auth cmds: XOR + Blowfish
// All other: XOR only

const { createHmac } = require('crypto');
const { BLOWFISH_KEY_VIEW, BLOWFISH_AUTH_KEY_VIEW } = require('./blowfish-key.js');

// XOR key — copied from decode-tcp.ts line:
//   const KEY_BYTES = new Uint8Array([0x5a, 0x70, 0x85, 0xaf]);
const XOR_KEY = new Uint8Array([0x5a, 0x70, 0x85, 0xaf]);
const XOR_SESSION_ID_BYTES = new Uint8Array([0x35, 0xd5, 0xc3, 0x8e, 0xd0, 0x11, 0x0e, 0xa8]);
const HMAC_MD5_KEY = Buffer.from([
  0x5a, 0x37, 0x2f, 0x62, 0x69, 0x4a, 0x34, 0x36,
  0x54, 0x7a, 0x47, 0x46, 0x2d, 0x38, 0x79, 0x78,
]);

// Commands that require Blowfish (in addition to XOR).
// Source: decode-tcp.ts BLOWFISH_ENCRYPTED_INBOUND / BLOWFISH_ENCRYPTED_OUTBOUND
const BLOWFISH_INBOUND  = new Set([0x3003, 0x4310, 0x4320, 0x43c0, 0x4700, 0x4990]);
const BLOWFISH_OUTBOUND = new Set([0x4305]);

// ─── XOR ─────────────────────────────────────────────────────────────────────
// XOR is self-inverse; same function used for both encrypt and decrypt.
// Applied to the entire TCP segment starting at index 0.
function xorCrypt(data) {
  const out = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ XOR_KEY[i & 3];
  }
  return out;
}

// ─── Blowfish helpers ─────────────────────────────────────────────────────────
// The F function (S-box lookup) used by both encrypt and decrypt.
function F(x, kv) {
  return (
    (((kv.getInt32((x >>> 22) & 0x3fc | 0x48, false) +
       kv.getInt32((x >>> 14) & 0x3fc | 0x448, false)) ^
      kv.getInt32((x >>> 6)  & 0x3fc | 0x848, false)) +
     kv.getInt32(((x << 2 | x >>> 30) & 0x3fc) | 0xc48, false)
    ) | 0
  );
}

// ─── Blowfish decrypt ─────────────────────────────────────────────────────────
// Exact port of blowfishDecrypt from decode-tcp.ts.
// Modifies `data` in-place; processes floor(data.length / 8) blocks.
function blowfishDecryptWithKeyInPlace(data, kv) {
  const blockCount = (data.length / 8) | 0;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let bi = 0; bi < blockCount; bi++) {
    const off = bi * 8;
    let a = dv.getInt32(off + 4, false);
    let b = dv.getInt32(off,     false);

    b ^= kv.getInt32(0x44, false);

    for (let r = 0; r < 8; r++) {
      a ^= kv.getInt32(0x40 - r * 8, false);
      a ^= F(b, kv);
      b ^= kv.getInt32(0x3c - r * 8, false);
      b ^= F(a, kv);
    }

    a ^= kv.getInt32(0x0, false);
    dv.setInt32(off,     a, false);
    dv.setInt32(off + 4, b, false);
  }
}

function blowfishDecryptInPlace(data) {
  blowfishDecryptWithKeyInPlace(data, BLOWFISH_KEY_VIEW);
}

// ─── Blowfish encrypt ─────────────────────────────────────────────────────────
// Exact inverse of blowfishDecryptInPlace.
// Modifies `data` in-place; processes floor(data.length / 8) blocks.
function blowfishEncryptWithKeyInPlace(data, kv) {
  const blockCount = (data.length / 8) | 0;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let bi = 0; bi < blockCount; bi++) {
    const off = bi * 8;
    // Read the plaintext — decrypt writes: [0..3]=a_out, [4..7]=b_out
    let a = dv.getInt32(off,     false); // = a_out (plaintext half 0)
    let b = dv.getInt32(off + 4, false); // = b_out (plaintext half 1)

    // Undo decrypt's final: a ^= P[0x0]
    a ^= kv.getInt32(0x0, false);

    // Undo rounds in reverse order
    for (let r = 7; r >= 0; r--) {
      // Undo: b ^= F(a)
      b ^= F(a, kv);
      // Undo: b ^= P[0x3c - r*8]
      b ^= kv.getInt32(0x3c - r * 8, false);
      // Undo: a ^= F(b)
      a ^= F(b, kv);
      // Undo: a ^= P[0x40 - r*8]
      a ^= kv.getInt32(0x40 - r * 8, false);
    }

    // Undo decrypt's first: b ^= P[0x44]
    b ^= kv.getInt32(0x44, false);

    // Write ciphertext — decrypt read: a=bytes[off+4], b=bytes[off]
    // So we restore b → [off], a → [off+4]
    dv.setInt32(off,     b, false);
    dv.setInt32(off + 4, a, false);
  }
}

function blowfishEncryptInPlace(data) {
  blowfishEncryptWithKeyInPlace(data, BLOWFISH_KEY_VIEW);
}

function xorCryptWithKey(data, keyBytes) {
  const out = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ keyBytes[i & (keyBytes.length - 1)];
  }
  return out;
}

function transformSessionField(buf, isEncoding) {
  if (buf.length !== 8) return Buffer.from(buf);

  const out = Buffer.from(buf);
  if (isEncoding) {
    blowfishDecryptWithKeyInPlace(out, BLOWFISH_AUTH_KEY_VIEW);
    return xorCryptWithKey(out, XOR_SESSION_ID_BYTES);
  }

  const xored = xorCryptWithKey(out, XOR_SESSION_ID_BYTES);
  blowfishEncryptWithKeyInPlace(xored, BLOWFISH_AUTH_KEY_VIEW);
  return xored;
}

function decodeSessionPayload(payloadBuf, cmd, isInbound) {
  if (!(cmd === 0x3003 && isInbound) || payloadBuf.length < 12) return payloadBuf;

  const out = Buffer.from(payloadBuf);
  const rawSession = out.subarray(4, 12);
  transformSessionField(rawSession, false).copy(out, 4);
  return out;
}

function encodeSessionPayload(payloadBuf, cmd, isInbound) {
  if (!(cmd === 0x3003 && isInbound) || payloadBuf.length < 12) return payloadBuf;

  const out = Buffer.from(payloadBuf);
  const decodedSession = out.subarray(4, 12);
  transformSessionField(decodedSession, true).copy(out, 4);
  return out;
}

function computePacketChecksum(headerBytes, payloadBuf) {
  return createHmac('md5', HMAC_MD5_KEY)
    .update(headerBytes)
    .update(payloadBuf)
    .digest();
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Decrypt a complete game payload that requires Blowfish.
// Returns a new Buffer containing the decrypted payload.
function decryptPayload(payloadBuf, cmd, isInbound) {
  const needsBf = isInbound ? BLOWFISH_INBOUND.has(cmd) : BLOWFISH_OUTBOUND.has(cmd);
  if (!needsBf || payloadBuf.length === 0) return payloadBuf;

  const padLen  = (8 - (payloadBuf.length % 8)) % 8;
  const padded  = Buffer.alloc(payloadBuf.length + padLen);
  payloadBuf.copy(padded);
  blowfishDecryptInPlace(padded);
  return padded.slice(0, payloadBuf.length);
}

// Encrypt a plain payload so it matches what the game expects on the wire.
function encryptPayload(plainBuf, cmd, isInbound) {
  const needsBf = isInbound ? BLOWFISH_INBOUND.has(cmd) : BLOWFISH_OUTBOUND.has(cmd);
  if (!needsBf || plainBuf.length === 0) return plainBuf;

  const padLen = (8 - (plainBuf.length % 8)) % 8;
  const padded = Buffer.alloc(plainBuf.length + padLen);
  plainBuf.copy(padded);
  blowfishEncryptInPlace(padded);
  return padded.slice(0, plainBuf.length);
}

module.exports = {
  xorCrypt,
  xorCryptWithKey,
  blowfishDecryptInPlace,
  blowfishEncryptInPlace,
  decryptPayload,
  encryptPayload,
  decodeSessionPayload,
  encodeSessionPayload,
  computePacketChecksum,
  BLOWFISH_INBOUND,
  BLOWFISH_OUTBOUND,
  XOR_KEY,
  XOR_SESSION_ID_BYTES,
  HMAC_MD5_KEY,
};
