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

## Status & caveats

- ✅ Core transport, sender, base64 codec, and receiver hook are unit-verified;
  the example's full JS graph bundles cleanly under Metro.
- ⚠️ The camera receiver is written against Vision Camera **v5** (a new nitro-based
  API) and needs on-device validation — it has not been run on hardware here.
- ⚠️ QR scanning in v5 is iOS-first (`ScannedObject` is `@platform iOS`).
- Throughput is bounded by how fast the scanner reads frames; for higher rates,
  a dedicated frame-processor plugin returning raw bytes could replace the
  base64-over-text channel.
