import test from 'node:test';
import assert from 'node:assert/strict';

import state from './state.js';
import type { SpoofRule, Packet } from './state.js';
import {
  xorCrypt,
  decryptPayload,
  encryptPayload,
  decodeSessionPayload,
  encodeSessionPayload,
  computePacketChecksum,
} from './crypto.js';
import { processSegment } from './tcp-proxy.js';

const HEADER_SIZE = 24;
const XOR_ONLY_CMD = 0x4440;
const SESSION_CMD = 0x3003;

function buildXorOnlyWirePacket(cmd: number, seq: number, plainPayload: Buffer): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16BE(cmd, 0);
  header.writeUInt16BE(plainPayload.length, 2);
  header.writeUInt32BE(seq, 4);
  computePacketChecksum(header.subarray(0, 8), plainPayload).copy(header, 8);

  const decryptedSegment = Buffer.concat([header, plainPayload], HEADER_SIZE + plainPayload.length);
  return xorCrypt(decryptedSegment);
}

function buildSessionWirePacket(cmd: number, seq: number, logicalPayload: Buffer, isInbound: boolean): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16BE(cmd, 0);
  header.writeUInt16BE(logicalPayload.length, 2);
  header.writeUInt32BE(seq, 4);

  const sessionEncodedPayload = encodeSessionPayload(logicalPayload, cmd, isInbound);
  const packetEncodedPayload = encryptPayload(sessionEncodedPayload, cmd, isInbound);
  computePacketChecksum(header.subarray(0, 8), packetEncodedPayload).copy(header, 8);
  const decryptedSegment = Buffer.concat(
    [header, packetEncodedPayload],
    HEADER_SIZE + packetEncodedPayload.length
  );
  return xorCrypt(decryptedSegment);
}

test('processSegment spoofs a normal XOR-only packet without introducing extra encryption', () => {
  const originalPayload = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const spoofBytes = Buffer.from('deadbeefcafebabe', 'hex');
  const expectedPayload = Buffer.from(originalPayload);
  spoofBytes.copy(expectedPayload, 0);

  const wireSegment = buildXorOnlyWirePacket(XOR_ONLY_CMD, 0x01020304, originalPayload);

  const originalGetSpoofRule = state.getSpoofRule;
  const originalAddPacket = state.addPacket;
  const originalSpoofingEnabled = state.isSpoofingEnabled();

  state.getSpoofRule = (cmd: number, isInbound: boolean): SpoofRule | null => {
    if (cmd === XOR_ONLY_CMD && isInbound === false) {
      return { cmd, isInbound, payloadHex: spoofBytes.toString('hex') };
    }
    return null;
  };
  state.addPacket = (_pkt: Packet): void => { /* no-op */ };
  state.setSpoofingEnabled(true);

  try {
    const processed = processSegment(wireSegment, false);
    assert.notDeepEqual(processed, wireSegment);

    const xorDecrypted = xorCrypt(processed);
    assert.equal(xorDecrypted.readUInt16BE(0), XOR_ONLY_CMD);
    assert.equal(xorDecrypted.readUInt16BE(2), originalPayload.length);
    assert.deepEqual(
      xorDecrypted.subarray(8, 24),
      computePacketChecksum(xorDecrypted.subarray(0, 8), xorDecrypted.subarray(HEADER_SIZE, HEADER_SIZE + originalPayload.length))
    );

    const payloadOut = xorDecrypted.subarray(HEADER_SIZE, HEADER_SIZE + originalPayload.length);
    assert.deepEqual(payloadOut, expectedPayload);

    // For a normal packet there is no additional payload encryption layer beyond
    // the segment XOR, so the XOR-decoded wire payload must match the spoofed
    // payload bytes exactly.
    assert.deepEqual(xorCrypt(xorDecrypted), processed);
  } finally {
    state.getSpoofRule = originalGetSpoofRule;
    state.addPacket = originalAddPacket;
    state.setSpoofingEnabled(originalSpoofingEnabled);
  }
});

test('processSegment spoofs the logical session payload for inbound 0x3003 and preserves valid wire encoding', () => {
  const logicalPayload = Buffer.from(
    '01020304414243444546474800112233445566778899aabb',
    'hex'
  );
  const spoofedSessionBytes = Buffer.from('53455353494f4e21', 'hex');
  const expectedLogicalPayload = Buffer.from(logicalPayload);
  spoofedSessionBytes.copy(expectedLogicalPayload, 4);

  const wireSegment = buildSessionWirePacket(SESSION_CMD, 0x05060708, logicalPayload, true);

  const originalGetSpoofRule = state.getSpoofRule;
  const originalAddPacket = state.addPacket;
  const originalSpoofingEnabled = state.isSpoofingEnabled();

  state.getSpoofRule = (cmd: number, isInbound: boolean): SpoofRule | null => {
    if (cmd === SESSION_CMD && isInbound === true) {
      return { cmd, isInbound, payloadHex: expectedLogicalPayload.toString('hex') };
    }
    return null;
  };
  state.addPacket = (_pkt: Packet): void => { /* no-op */ };
  state.setSpoofingEnabled(true);

  try {
    const processed = processSegment(wireSegment, true);
    assert.notDeepEqual(processed, wireSegment);

    const xorDecrypted = xorCrypt(processed);
    assert.equal(xorDecrypted.readUInt16BE(0), SESSION_CMD);
    assert.equal(xorDecrypted.readUInt16BE(2), logicalPayload.length);
    assert.deepEqual(
      xorDecrypted.subarray(8, 24),
      computePacketChecksum(xorDecrypted.subarray(0, 8), xorDecrypted.subarray(HEADER_SIZE, HEADER_SIZE + logicalPayload.length))
    );

    const packetPayloadOut = xorDecrypted.subarray(HEADER_SIZE, HEADER_SIZE + logicalPayload.length);
    const packetDecodedPayload = decryptPayload(packetPayloadOut, SESSION_CMD, true);
    const logicalDecodedPayload = decodeSessionPayload(packetDecodedPayload, SESSION_CMD, true);

    assert.deepEqual(logicalDecodedPayload, expectedLogicalPayload);

    const rebuiltWirePayload = encryptPayload(
      encodeSessionPayload(logicalDecodedPayload, SESSION_CMD, true),
      SESSION_CMD,
      true
    );
    assert.deepEqual(rebuiltWirePayload, packetPayloadOut);
  } finally {
    state.getSpoofRule = originalGetSpoofRule;
    state.addPacket = originalAddPacket;
    state.setSpoofingEnabled(originalSpoofingEnabled);
  }
});
