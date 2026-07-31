# optical-transfer

Air-gapped, one-way file transfer over **screen → camera**. One device animates a
stream of QR codes; another films the screen and reconstructs the file. No network,
no pairing, no handshake, no special permissions.

The transport is built on **LT (Luby transform) fountain codes**: each QR frame carries
the XOR of a pseudo-random subset of the file's blocks, chosen deterministically from
the frame's sequence number. The receiver collects **any** ~`k·1.15` distinct frames, in
any order, and peels the file out of them. A dropped or blurred frame costs a little
time, never correctness — so there is no back-channel and no retransmission.

This repo is packaging that transport as reusable libraries so mobile (and web) apps
can drop it in however they choose.

## Packages

| Package | Status | What it is |
| --- | --- | --- |
| [`@optical-transfer/core`](packages/core) | ✅ working, tested | Pure, dependency-free transport: `OpticalSender`, `OpticalReceiver`, fountain codec + frame protocol. Runs on Node, browsers, and React Native (Hermes). |
| `@optical-transfer/react-native` | 🚧 planned | Thin native layer: a byte-mode QR renderer for sending and a Vision Camera frame processor for receiving. |

## Core API

```ts
import { OpticalSender, OpticalReceiver } from "@optical-transfer/core";

// Sender — turn a file into an endless stream of self-describing frame bytes.
const tx = new OpticalSender(fileBytes, { blockLen: 256 });
for (const frame of tx.stream()) {
  renderAsQr(frame); // hand `frame` (Uint8Array) to any byte-mode QR renderer
}

// Receiver — feed decoded QR bytes; it locks on mid-stream and self-verifies.
const rx = new OpticalReceiver();
onQrScanned((bytes) => {
  rx.ingest(bytes);
  updateProgressBar(rx.progress); // frames-collected, not blocks-solved
  if (rx.isComplete) saveFile(rx.result!); // FNV-1a verified before exposed
});
```

The core touches no DOM, canvas, camera, or QR pixels — it only turns `seq` numbers
into frame bytes and frame bytes back into a file. Platform layers supply the pixels
and the camera.

## Development

```bash
npm install
npm test         # runs the core round-trip suite (lossy + reordered channel)
npm run build    # emits packages/core/dist
```

The test suite drives the sender's frame bytes straight into the receiver through a
simulated channel that drops 30% of frames and reorders the rest — no camera required —
covering mid-stream lock-on, session restarts, a range of file/block sizes, checksum
verification, and overhead bounds.

## React Native roadmap

The hard, valuable logic (the fountain codec and frame protocol) is pure integer/typed-array
math and ports to Hermes **unchanged**. The remaining work is the platform I/O layer:

1. **Binary-safe QR round-trip** — the sharp edge. Frames are raw bytes, so the sender
   needs a **byte / ISO-8859-1** QR segment mode (not UTF-8 strings), and the receiver
   needs a scanner that returns **raw bytes** on both iOS and Android (MLKit `rawBytes` /
   ZXing). Spike this first.
2. **Sender component** — pump `sender.stream()` into a QR renderer, swapping frames at N fps.
3. **Receiver hook** — a `react-native-vision-camera` frame processor that scans QR and
   calls `receiver.ingest(bytes)`.
4. **Example app** — send from one device, receive on another.

## Attribution & license

This project is **MIT licensed** (see [`LICENSE`](LICENSE)).

The fountain codec (`fountain.ts`) and frame protocol (`protocol.ts`) are derived from
the [`decimen-optical-transfer`](https://github.com/bashalarmistalt/decimen-optical-transfer)
proof-of-concept, which is itself MIT licensed (Copyright © 2026 BashAlarmist). We comply
by preserving the upstream copyright and permission notice in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) and in each derived file's header — the
only obligation MIT imposes. Everything else in this repo (`sender.ts`, `receiver.ts`,
tests, packaging) is original and offered under the same MIT terms.
