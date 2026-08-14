// GIF codec round-trip: file → animated GIF of QR frames → file, headless.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as zlib from "node:zlib";
import omggif from "omggif";

import { encodeGif } from "../src/encode";
import { decodeGif } from "../src/decode";
import type { PayloadCodec } from "@optical-transfer/core";

test("round-trips a UTF-8 text payload", () => {
  const file = new TextEncoder().encode(
    "optical-transfer GIF channel — the quick brown fox jumps over the lazy dog. ".repeat(10),
  );
  const { gif, frames, width } = encodeGif(file, { blockLen: 64 });
  assert.ok(gif.length > 0, "produced a non-empty GIF");
  assert.ok(width > 0 && frames >= 8, "sane dimensions and frame count");
  const res = decodeGif(gif);
  assert.equal(res.error, undefined);
  assert.deepEqual(res.data, file);
});

test("round-trips an incompressible binary payload", () => {
  const file = new Uint8Array(700);
  for (let i = 0; i < file.length; i++) file[i] = (i * 31 + 7) & 0xff;
  const { gif } = encodeGif(file, { blockLen: 96 });
  const res = decodeGif(gif);
  assert.deepEqual(res.data, file);
  assert.ok(res.ingested >= 1);
});

test("round-trips with a compression codec", () => {
  const deflate: PayloadCodec = {
    id: 1,
    encode: (i) => new Uint8Array(zlib.deflateRawSync(i)),
    decode: (i) => new Uint8Array(zlib.inflateRawSync(i)),
  };
  const file = new TextEncoder().encode("compress me ".repeat(200)); // very compressible
  const plain = encodeGif(file, { blockLen: 128 });
  const gz = encodeGif(file, { blockLen: 128, codec: deflate });
  assert.ok(gz.frames <= plain.frames, "compression should not increase frame count");
  const res = decodeGif(gz.gif, { codecs: [deflate] });
  assert.deepEqual(res.data, file);
});

// The QR version is chosen from frame *content* by qrcode's segment optimizer,
// not from payload length — so the first frame is not an upper bound for the
// rest. Session 2 is a pinned case where frame 0 fits version 8 but a later
// frame needs 9; sizing every frame off frame 0 threw on it.
test("encodes when a later frame needs a larger QR version than the first", () => {
  const file = new TextEncoder().encode("compress me ".repeat(200));
  const { gif } = encodeGif(file, { blockLen: 128, sessionId: 2 });
  const res = decodeGif(gif);
  assert.deepEqual(res.data, file);
});

test("encodes across many session ids without throwing", () => {
  const file = new TextEncoder().encode("compress me ".repeat(200));
  for (let sessionId = 0; sessionId < 150; sessionId++) {
    assert.doesNotThrow(
      () => encodeGif(file, { blockLen: 128, sessionId }),
      `session ${sessionId} failed to encode`,
    );
  }
});

test("every GIF frame matches the reported dimensions", () => {
  const file = new TextEncoder().encode("compress me ".repeat(200));
  const { gif, width, height, frames } = encodeGif(file, { blockLen: 128, sessionId: 2 });
  const reader = new omggif.GifReader(gif as Buffer);
  assert.equal(reader.numFrames(), frames);
  for (let f = 0; f < reader.numFrames(); f++) {
    const info = reader.frameInfo(f);
    assert.equal(info.width, width, `frame ${f} width`);
    assert.equal(info.height, height, `frame ${f} height`);
  }
});

test("reports an error when a compressed payload has no matching codec", () => {
  const deflate: PayloadCodec = {
    id: 1,
    encode: (i) => new Uint8Array(zlib.deflateRawSync(i)),
    decode: (i) => new Uint8Array(zlib.inflateRawSync(i)),
  };
  const file = new TextEncoder().encode("secret ".repeat(200));
  const { gif } = encodeGif(file, { blockLen: 128, codec: deflate });
  const res = decodeGif(gif); // no codecs provided
  assert.equal(res.data, null);
  assert.ok(res.error, "surfaces a decode error rather than returning garbage");
});
