# @optical-transfer/core

Pure, dependency-free transport for air-gapped file transfer over screen → camera,
built on LT (Luby transform) fountain codes. Runs on Node, browsers, and React
Native (Hermes) — it uses only integer/typed-array math, no DOM, no camera, no QR
rendering.

See the [repository README](../../README.md) for the full picture and the React
Native roadmap.

## Install

```bash
npm install @optical-transfer/core
```

## Usage

```ts
import { OpticalSender, OpticalReceiver } from "@optical-transfer/core";

const tx = new OpticalSender(fileBytes, { blockLen: 256 });
const frame = tx.frame(0);        // Uint8Array — render as a byte-mode QR code
// or: for (const f of tx.stream()) { ... }

const rx = new OpticalReceiver();
rx.ingest(scannedBytes);          // feed decoded QR frames, any order
rx.progress;                      // 0..1, frames-collected (stable UX metric)
rx.isComplete;                    // true once solved + FNV-1a verified
rx.result;                        // Uint8Array | null
```

## API

- **`OpticalSender(file, { blockLen?, sessionId? })`** — `frame(seq)`, `stream(startSeq?)`,
  `k`, `header`.
- **`OpticalReceiver()`** — `ingest(bytes)`, `progress`, `isComplete`, `result`,
  `framesReceived`, `header`, `reset()`.
- **Optional compression** — `OpticalSender(file, { codec })` and
  `new OpticalReceiver({ codecs })`. Core ships no codec (stays dependency-free); inject a
  `PayloadCodec` (`{ id, encode, decode }`). A 1-byte envelope records which codec was used,
  so the stream stays self-describing; compression is auto-skipped when it wouldn't shrink
  the payload. Helpers: `wrapPayload` / `unwrapPayload`, `CODEC_IDENTITY`. The React Native
  package provides a ready-made `gzipCodec`.
- Low-level: `LTEncoder`, `LTDecoder`, `packFrame`, `parseFrame`, `fnv1a`, `splitmix32`,
  `HEADER_LEN`, `FrameHeader`.

## License

MIT. The `fountain.ts` / `protocol.ts` transport is derived from
[`decimen-optical-transfer`](https://github.com/bashalarmistalt/decimen-optical-transfer)
(also MIT, © 2026 BashAlarmist); its notice is preserved in each file header and in the
repo-root `THIRD-PARTY-NOTICES.md`.
