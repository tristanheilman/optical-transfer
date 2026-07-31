// End-to-end transport test — no camera, no QR pixels. We drive the sender's
// frame bytes straight into the receiver through a simulated optical channel
// that drops and reorders frames, exactly like a phone filming a screen.

import { test } from "node:test";
import assert from "node:assert/strict";

import { OpticalSender, OpticalReceiver, fnv1a, splitmix32 } from "../src/index.ts";

/** Deterministic pseudo-random bytes, so failures reproduce. */
function makeData(len: number, seed: number): Uint8Array {
  const rnd = splitmix32(seed);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = rnd() & 0xff;
  return out;
}

/** Push frames through a lossy, reordered channel until the file is solved. */
function transfer(
  file: Uint8Array,
  opts: { blockLen?: number; dropRate?: number; seed?: number; maxFrames?: number } = {},
): { rx: OpticalReceiver; framesSent: number } {
  const { blockLen = 256, dropRate = 0.3, seed = 1, maxFrames = 500_000 } = opts;
  const tx = new OpticalSender(file, { blockLen, sessionId: 0x1234 });
  const rx = new OpticalReceiver();
  const drop = splitmix32(seed ^ 0xabcdef);

  // A small reorder buffer: collect a window, then flush it shuffled.
  const window: Uint8Array[] = [];
  const WINDOW = 8;
  const flush = () => {
    for (let i = window.length - 1; i > 0; i--) {
      const j = drop() % (i + 1);
      const t = window[i]!;
      window[i] = window[j]!;
      window[j] = t;
    }
    for (const f of window) rx.ingest(f);
    window.length = 0;
  };

  let framesSent = 0;
  for (let seq = 0; seq < maxFrames && !rx.isComplete; seq++) {
    // Simulate frames the camera missed (blur, refresh mismatch, motion).
    if (drop() * 2 ** -32 < dropRate) continue;
    window.push(tx.frame(seq));
    framesSent++;
    if (window.length >= WINDOW) flush();
    if (rx.isComplete) break;
  }
  flush();
  return { rx, framesSent };
}

test("round-trips a 4 KB file through 30% loss and reordering", () => {
  const file = makeData(4096, 42);
  const { rx } = transfer(file, { seed: 7 });
  assert.ok(rx.isComplete, "receiver should complete");
  assert.deepEqual(rx.result, file);
});

test("reconstructed file matches the sender's FNV checksum", () => {
  const file = makeData(10_000, 99);
  const tx = new OpticalSender(file, { sessionId: 0x1234 });
  const { rx } = transfer(file, { seed: 3 });
  assert.ok(rx.result);
  assert.equal(fnv1a(rx.result!), tx.header.payloadFnv);
  assert.equal(rx.result!.length, file.length);
});

test("handles a range of sizes and block lengths", () => {
  for (const len of [1, 63, 256, 257, 1024, 20_003]) {
    for (const blockLen of [64, 128, 300]) {
      const file = makeData(len, len ^ blockLen);
      const { rx } = transfer(file, { blockLen, seed: len + blockLen });
      assert.ok(rx.isComplete, `len=${len} blockLen=${blockLen} should complete`);
      assert.deepEqual(rx.result, file, `len=${len} blockLen=${blockLen} mismatch`);
    }
  }
});

test("overhead stays reasonable — solves within ~1.6x of k frames", () => {
  const file = makeData(50_000, 5);
  const tx = new OpticalSender(file, { blockLen: 256, sessionId: 0x1234 });
  const rx = new OpticalReceiver();
  let distinct = 0;
  for (let seq = 0; !rx.isComplete; seq++) {
    rx.ingest(tx.frame(seq));
    distinct++;
    assert.ok(seq < 100_000, "should not need absurdly many frames");
  }
  assert.ok(rx.result);
  assert.deepEqual(rx.result, file);
  const ratio = distinct / tx.k;
  assert.ok(ratio < 1.6, `overhead ratio ${ratio.toFixed(3)} should be < 1.6 (k=${tx.k})`);
});

test("mid-stream lock-on: receiver joins late and still completes", () => {
  const file = makeData(8000, 21);
  const tx = new OpticalSender(file, { sessionId: 0x1234 });
  const rx = new OpticalReceiver();
  // Skip the first 200 frames entirely — the receiver "arrives late".
  for (let seq = 200; !rx.isComplete; seq++) rx.ingest(tx.frame(seq));
  assert.deepEqual(rx.result, file);
});

test("a new sessionId restarts the transfer cleanly", () => {
  const fileA = makeData(3000, 1);
  const fileB = makeData(5000, 2);
  const txA = new OpticalSender(fileA, { sessionId: 0x1111 });
  const txB = new OpticalSender(fileB, { sessionId: 0x2222 });
  const rx = new OpticalReceiver();

  // Feed a few frames of A (not enough to finish), then switch to B fully.
  for (let seq = 0; seq < 5; seq++) rx.ingest(txA.frame(seq));
  assert.equal(rx.isComplete, false);
  for (let seq = 0; !rx.isComplete; seq++) rx.ingest(txB.frame(seq));

  assert.deepEqual(rx.result, fileB);
  assert.equal(rx.header?.sessionId, 0x2222);
});

test("ignores malformed frames without throwing", () => {
  const file = makeData(1000, 8);
  const tx = new OpticalSender(file, { sessionId: 0x1234 });
  const rx = new OpticalReceiver();
  rx.ingest(new Uint8Array(0)); // empty
  rx.ingest(new Uint8Array([0x00, 0x00, 1, 2, 3])); // bad magic
  rx.ingest(tx.frame(0).subarray(0, 5)); // truncated
  for (let seq = 0; !rx.isComplete; seq++) rx.ingest(tx.frame(seq));
  assert.deepEqual(rx.result, file);
});
