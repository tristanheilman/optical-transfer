# optical-transfer

[![license](https://img.shields.io/github/license/tristanheilman/react-native-optical-transfer)](LICENSE)
[![core](https://img.shields.io/badge/%40optical--transfer%2Fcore-tested-brightgreen)](packages/core)
[![react-native](https://img.shields.io/badge/react--native-0.85-blue)](packages/react-native)
[![status](https://img.shields.io/badge/status-experimental-orange)](#status)

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
| [`@optical-transfer/react-native`](packages/react-native) | ✅ JS verified · ⚠️ device-validate | Sender/receiver components: animated byte-mode QR (`react-native-qrcode-svg`) + camera capture (`react-native-vision-camera` v5). Includes a bare-RN example app. Camera receiver needs on-device validation. |

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

## Status

- ✅ **Core transport** — `OpticalSender` / `OpticalReceiver`, fountain codec, and frame
  protocol. Unit-tested over a simulated lossy/reordered channel; builds clean.
- ✅ **React Native layer** — sender/receiver components + example app. Typechecks against
  the real native libs and the example bundles under Metro.
- ⚠️ **On-device iOS run** — not yet validated on hardware. The camera receiver targets
  Vision Camera **v5** (new nitro API) and needs a first device run to confirm the wiring.
- ⏳ **Android receive** — v5 QR scanning is iOS-first; a fallback is future work.

The binary-safe QR round-trip (the original sharp edge — scanners hand back UTF-8, not raw
bytes) is solved by carrying each frame as **base64 text** inside the QR, so any off-the-shelf
renderer and scanner round-trip it exactly, at ~33% density cost.

### What's next

- First on-device run on iPhone (`pod install` → `run-ios --device`); iterate on any v5
  camera wiring issues it surfaces.
- Optionally swap the base64-over-text channel for a raw-bytes frame processor to recover
  the ~33% density and push throughput.

## Attribution & license

This project is **MIT licensed** (see [`LICENSE`](LICENSE)).

The fountain codec (`fountain.ts`) and frame protocol (`protocol.ts`) are derived from
the [`decimen-optical-transfer`](https://github.com/bashalarmistalt/decimen-optical-transfer)
proof-of-concept, which is itself MIT licensed (Copyright © 2026 BashAlarmist). We comply
by preserving the upstream copyright and permission notice in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) and in each derived file's header — the
only obligation MIT imposes. Everything else in this repo (`sender.ts`, `receiver.ts`,
tests, packaging) is original and offered under the same MIT terms.
