// GIF codec round-trip: file → animated GIF of QR frames → file, headless.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as zlib from "node:zlib";

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
