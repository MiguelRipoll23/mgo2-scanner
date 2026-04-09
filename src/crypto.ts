// Encryption/decryption logic ported exactly from:
//   C:\Users\migue\Desktop\network\decode-tcp.ts
//
// XOR key:   0x5A70 85AF  (KEY_BYTES in decode-tcp.ts)
// Blowfish:  custom 8-round Feistel using the pre-expanded key table from blowfish-key.ts
// Auth cmds: XOR + Blowfish
// All other: XOR only

import { createHmac } from 'node:crypto';
import {
  XOR_KEY_BYTES as XOR_KEY,
  XOR_SESSION_ID_BYTES,
  HMAC_MD5_KEY as HMAC_MD5_KEY_BYTES,
} from './crypto-keys-constants.js';
import { BLOWFISH_KEY_VIEW, BLOWFISH_AUTH_KEY_VIEW } from './blowfish-key.js';

export { XOR_KEY, XOR_SESSION_ID_BYTES };

export const HMAC_MD5_KEY = Buffer.from(HMAC_MD5_KEY_BYTES);

// Commands that require Blowfish (in addition to XOR).
// Source: decode-tcp.ts BLOWFISH_ENCRYPTED_INBOUND / BLOWFISH_ENCRYPTED_OUTBOUND
export const BLOWFISH_INBOUND = new Set<number>([0x3003, 0x4310, 0x4320, 0x43c0, 0x4700, 0x4990]);
export const BLOWFISH_OUTBOUND = new Set<number>([0x4305]);

// ─── XOR ─────────────────────────────────────────────────────────────────────
// XOR is self-inverse; same function used for both encrypt and decrypt.
// Applied to the entire TCP segment starting at index 0.
export function xorCrypt(data: Buffer): Buffer {
  const out = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ XOR_KEY[i & 3];
  }
  return out;
}

// ─── Blowfish helpers ─────────────────────────────────────────────────────────
// The F function (S-box lookup) used by both encrypt and decrypt.
function F(x: number, kv: DataView): number {
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
function blowfishDecryptWithKeyInPlace(data: Buffer, kv: DataView): void {
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

export function blowfishDecryptInPlace(data: Buffer): void {
  blowfishDecryptWithKeyInPlace(data, BLOWFISH_KEY_VIEW);
}

// ─── Blowfish encrypt ─────────────────────────────────────────────────────────
// Exact inverse of blowfishDecryptInPlace.
// Modifies `data` in-place; processes floor(data.length / 8) blocks.
function blowfishEncryptWithKeyInPlace(data: Buffer, kv: DataView): void {
  const blockCount = (data.length / 8) | 0;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let bi = 0; bi < blockCount; bi++) {
    const off = bi * 8;
    let a = dv.getInt32(off,     false);
    let b = dv.getInt32(off + 4, false);

    a ^= kv.getInt32(0x0, false);

    for (let r = 7; r >= 0; r--) {
      b ^= F(a, kv);
      b ^= kv.getInt32(0x3c - r * 8, false);
      a ^= F(b, kv);
      a ^= kv.getInt32(0x40 - r * 8, false);
    }

    b ^= kv.getInt32(0x44, false);

    dv.setInt32(off,     b, false);
    dv.setInt32(off + 4, a, false);
  }
}

export function blowfishEncryptInPlace(data: Buffer): void {
  blowfishEncryptWithKeyInPlace(data, BLOWFISH_KEY_VIEW);
}

export function xorCryptWithKey(data: Buffer, keyBytes: Uint8Array): Buffer {
  const out = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ keyBytes[i & (keyBytes.length - 1)];
  }
  return out;
}

function transformSessionField(buf: Buffer, isEncoding: boolean): Buffer {
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

export function decodeSessionPayload(payloadBuf: Buffer, cmd: number, isInbound: boolean): Buffer {
  if (!(cmd === 0x3003 && isInbound) || payloadBuf.length < 12) return payloadBuf;

  const out = Buffer.from(payloadBuf);
  const rawSession = out.subarray(4, 12);
  transformSessionField(rawSession, false).copy(out, 4);
  return out;
}

export function encodeSessionPayload(payloadBuf: Buffer, cmd: number, isInbound: boolean): Buffer {
  if (!(cmd === 0x3003 && isInbound) || payloadBuf.length < 12) return payloadBuf;

  const out = Buffer.from(payloadBuf);
  const decodedSession = out.subarray(4, 12);
  transformSessionField(decodedSession, true).copy(out, 4);
  return out;
}

export function computePacketChecksum(headerBytes: Buffer, payloadBuf: Buffer): Buffer {
  return createHmac('md5', HMAC_MD5_KEY)
    .update(headerBytes)
    .update(payloadBuf)
    .digest();
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Decrypt a complete game payload that requires Blowfish.
// Returns a new Buffer containing the decrypted payload.
export function decryptPayload(payloadBuf: Buffer, cmd: number, isInbound: boolean): Buffer {
  const needsBf = isInbound ? BLOWFISH_INBOUND.has(cmd) : BLOWFISH_OUTBOUND.has(cmd);
  if (!needsBf || payloadBuf.length === 0) return payloadBuf;

  const padLen  = (8 - (payloadBuf.length % 8)) % 8;
  const padded  = Buffer.alloc(payloadBuf.length + padLen);
  payloadBuf.copy(padded);
  blowfishDecryptInPlace(padded);
  return padded.slice(0, payloadBuf.length);
}

// Encrypt a plain payload so it matches what the game expects on the wire.
export function encryptPayload(plainBuf: Buffer, cmd: number, isInbound: boolean): Buffer {
  const needsBf = isInbound ? BLOWFISH_INBOUND.has(cmd) : BLOWFISH_OUTBOUND.has(cmd);
  if (!needsBf || plainBuf.length === 0) return plainBuf;

  const padLen = (8 - (plainBuf.length % 8)) % 8;
  const padded = Buffer.alloc(plainBuf.length + padLen);
  plainBuf.copy(padded);
  blowfishEncryptInPlace(padded);
  return padded.slice(0, plainBuf.length);
}
