'use strict';

const fs = require('fs');
const path = require('path');

const PACKET_KEY_PATH = path.join(__dirname, 'blowfish-key.ts');
const SERVER_CONSTANTS_PATH = path.join(__dirname, 'crypto-keys-constants.ts');

function parseUint8ArrayLiteral(source, constantName) {
  const pattern = new RegExp(`${constantName}[^\\[]*new Uint8Array\\(\\[([\\s\\S]*?)\\]\\)`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not parse ${constantName}`);

  return new Uint8Array(
    match[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => parseInt(s, 16))
  );
}

function loadPacketKey() {
  const src = fs.readFileSync(PACKET_KEY_PATH, 'utf8');
  return parseUint8ArrayLiteral(src, 'BLOWFISH_KEY_PACKET');
}

function loadServerConstants() {
  return fs.readFileSync(SERVER_CONSTANTS_PATH, 'utf8');
}

const BLOWFISH_KEY_PACKET = loadPacketKey();
const BLOWFISH_KEY_AUTH = parseUint8ArrayLiteral(loadServerConstants(), 'BLOWFISH_KEY_AUTH');

const BLOWFISH_KEY_VIEW = new DataView(
  BLOWFISH_KEY_PACKET.buffer,
  BLOWFISH_KEY_PACKET.byteOffset,
  BLOWFISH_KEY_PACKET.byteLength
);

const BLOWFISH_AUTH_KEY_VIEW = new DataView(
  BLOWFISH_KEY_AUTH.buffer,
  BLOWFISH_KEY_AUTH.byteOffset,
  BLOWFISH_KEY_AUTH.byteLength
);

module.exports = {
  BLOWFISH_KEY_PACKET,
  BLOWFISH_KEY_AUTH,
  BLOWFISH_KEY_VIEW,
  BLOWFISH_AUTH_KEY_VIEW,
};
