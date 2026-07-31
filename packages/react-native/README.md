# @optical-transfer/react-native

React Native bindings for [optical-transfer](../../README.md): air-gapped file
transfer over screen → camera, built on LT fountain codes and animated QR frames.

A thin platform layer over [`@optical-transfer/core`](../core). It supplies the
pixels (animated byte-mode QR via `react-native-qrcode-svg`) and the camera
capture (`react-native-vision-camera` v5); the transport logic lives in core.

## Install

```sh
npm install @optical-transfer/react-native @optical-transfer/core \
  react-native-vision-camera react-native-nitro-modules react-native-nitro-image \
  react-native-qrcode-svg react-native-svg
```

Add a camera usage string to `ios/<App>/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Scan the QR codes shown on another device to receive a file.</string>
```

## Usage

```tsx
import {
  OpticalSenderView,
  OpticalReceiverView,
} from '@optical-transfer/react-native';

// Device A — broadcast a file as an animated QR stream:
<OpticalSenderView data={fileBytes} blockLen={128} fps={10} size={300} />

// Device B — point the camera at A's screen and rebuild the file:
<OpticalReceiverView onComplete={(bytes) => save(bytes)} />
```

Frames are carried as **base64 text** inside each QR so any scanner round-trips
them exactly (no custom native frame processor needed), at ~33% density cost.

### Compression (optional)

Compress the payload before it becomes QR frames — fewer blocks, faster transfer:

```tsx
import { OpticalSenderView, OpticalReceiverView, gzipCodec, DEFAULT_CODECS }
  from '@optical-transfer/react-native';

<OpticalSenderView data={fileBytes} codec={gzipCodec} />
<OpticalReceiverView codecs={DEFAULT_CODECS} onComplete={save} />
```

`gzipCodec` is pako-backed; compression is auto-skipped when it wouldn't help. Pass a stable
`codecs` reference (like `DEFAULT_CODECS`) so the receiver isn't recreated each render.

### API

- **`<OpticalSenderView data blockLen? fps? size? sessionId? ecl? onReady? />`**
- **`<OpticalReceiverView onComplete? onProgress? hideOverlay? />`**
- **`useOpticalReceiver()`** → `{ progress, isComplete, result, framesReceived, ingestBase64, reset, receiver }`
- **`bytesToBase64` / `base64ToBytes`**, plus re-exported `OpticalSender` / `OpticalReceiver` from core.

## Running the example app (iOS)

The `example/` app is a bare RN app demonstrating send + receive. From the repo root:

```sh
# 1. Install workspace deps (Node ≥ 22)
npm install

# 2. Build the core package (the RN lib imports its dist)
npm run build --workspace @optical-transfer/core

# 3. Install iOS pods
cd packages/react-native/example/ios && pod install && cd -

# 4. Run on a connected iPhone (open the workspace in Xcode to set your
#    signing team first, or pass it on the CLI)
cd packages/react-native/example
npx react-native run-ios --device
```

To test a real transfer you need **two devices**: run the app on each, put one in
**Send** and the other in **Receive**, and aim the receiver's camera at the
sender's screen.

The example is a small **test bench**:

- **Media types** — Text, JSON, Image, URL, Contact (vCard). The receiver renders
  each by MIME: text/JSON as text, images re-appear as images, unknown binary as a
  hex dump.
- **Your own photos** — "Pick a photo…" pulls a real image from the library
  (`react-native-image-picker`, capped to 800 px so the transfer stays reasonable)
  and sends it with its real MIME type.
- **Stress payloads** — large compressible text and 5 KB / 25 KB *incompressible*
  random blobs, to actually exercise the fountain codes (hundreds of frames,
  dropped-frame recovery, real transfer time).
- **Tuning knobs** — toggle gzip compression and pick block size (64/128/256) and
  frame rate (5/10/15 fps) to compare transfer behavior.

Because core is a raw-byte transport, the example layers its own tiny envelope to
carry type info — `mime\nfilename\nbytes` (see
[`example/src/payload.ts`](example/src/payload.ts)). That's the intended pattern:
apps add whatever metadata they need on top of the byte stream.

### Screens

See the [repository README](../../README.md#the-example-app) for a screenshot gallery
of the example (menu, send + tuning, live QR, received image, received text).

## Status & caveats

- ✅ Core transport, sender, base64 codec, and receiver hook are unit-verified;
  the example's full JS graph bundles cleanly under Metro.
- ✅ The Vision Camera **v5** camera receiver is **validated on real iPhones**
  (iOS 26 and iOS 16) — send + receive reconstruct files screen → camera.
- ⚠️ QR scanning in v5 is iOS-first (`ScannedObject` is `@platform iOS`); the
  sender works cross-platform, but Android receive is future work.
- Throughput is bounded by how fast the scanner reads frames; for higher rates,
  a dedicated frame-processor plugin returning raw bytes could replace the
  base64-over-text channel.
