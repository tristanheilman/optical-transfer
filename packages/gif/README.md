# @optical-transfer/gif

Turn any file into a **shareable animated GIF** of QR frames — and decode a GIF
back into the file. This makes optical transfer **asynchronous**: no two phones
in a room, no camera. Post the GIF anywhere; anyone with a viewer reconstructs
the file.

Built on [`@optical-transfer/core`](../core)'s LT fountain codes, so a few
unreadable frames (e.g. from an app that re-encodes the GIF) don't break the
decode.

## Install

```bash
npm install @optical-transfer/gif
```

## Usage

```ts
import { encodeGif, decodeGif } from "@optical-transfer/gif";

// Encode: file → animated GIF of QR frames
const { gif, frames, width } = encodeGif(fileBytes);
// `gif` is a Uint8Array — write it to disk, share it, host it.

// Decode: GIF → file
const { data } = decodeGif(gif);
// `data` is the reconstructed Uint8Array (or null if too few frames decoded).
```

With optional compression (inject a codec — matches the RN package's `gzipCodec`,
id `1`):

```ts
import { deflate, inflate } from "pako";
const gzip = { id: 1, encode: deflate, decode: inflate };

const { gif } = encodeGif(fileBytes, { codec: gzip });
const { data } = decodeGif(gif, { codecs: [gzip] });
```

## How it works

- **Encode** runs the file through the fountain `OpticalSender`, base64-encodes
  each frame, renders it as a black/white QR (via `qrcode`), and packs the
  sequence into a looping GIF (via `omggif`). It *simulates the decode* to size
  the frame count exactly, then adds a margin — LT decoding is probabilistic, so
  a fixed `k·overhead` can fall short for small `k`.
- **Decode** reads each GIF frame (`omggif`), decodes its QR (`jsQR`), and feeds
  the bytes to the `OpticalReceiver` until the file is reconstructed and
  checksum-verified.

Because the frames are *generated* (not filmed), decode reliability is far higher
than the live screen→camera path.

## Caveats

- **GIF size scales with file size** (more frames) — great for text, URLs, and
  small images; heavy for large files.
- Some chat apps **re-encode GIFs to video** (lossy), which can corrupt the QR.
  Share the raw `.gif` file (or host it) to keep it lossless.

## API

- **`encodeGif(file, opts?) → { gif, frames, width, height }`** — `opts`:
  `blockLen`, `codec`, `overhead`, `minFrames`, `scale`, `quiet`, `delayMs`,
  `errorCorrectionLevel`.
- **`decodeGif(gif, opts?) → { data, frames, decoded, ingested, progress, error }`**
  — `opts`: `codecs`.

## License

MIT.
