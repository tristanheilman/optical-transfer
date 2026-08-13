// encodeGif — turn a file into a shareable animated GIF of QR frames.
//
// The file is run through the LT-fountain OpticalSender; each frame's bytes are
// base64-encoded and rendered as a black/white QR, and the sequence is packed
// into a looping animated GIF. Because the frames are generated (not filmed),
// a QR image decoder reads them back cleanly — decode reliability is far higher
// than the live screen→camera path. Post the GIF anywhere; anyone with the
// viewer can reconstruct the file.

import { OpticalSender, OpticalReceiver } from "@optical-transfer/core";
import type { PayloadCodec } from "@optical-transfer/core";
import QRCode from "qrcode";
import omggif from "omggif";
import { bytesToBase64 } from "./base64";

const { GifWriter } = omggif;

export interface EncodeGifOptions {
  /** LT block size; smaller = more, smaller frames. Default 128. */
  blockLen?: number;
  /** Fixed session id (else derived by the sender). */
  sessionId?: number;
  /** Optional payload codec (e.g. gzip) applied before encoding. */
  codec?: PayloadCodec;
  /** Frame count = max(minFrames, ceil(k * overhead)). Default 1.35. */
  overhead?: number;
  /** Minimum number of frames. Default 8. */
  minFrames?: number;
  /** Pixels per QR module (auto-sized if omitted). */
  scale?: number;
  /** Quiet-zone width in modules. Default 4. */
  quiet?: number;
  /** Per-frame delay in ms. Default 120. */
  delayMs?: number;
  /** QR error-correction level. Default "L" (frames are clean, so "L" is fine). */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export interface GifResult {
  gif: Uint8Array;
  frames: number;
  width: number;
  height: number;
}

export function encodeGif(file: Uint8Array, opts: EncodeGifOptions = {}): GifResult {
  const blockLen = opts.blockLen ?? 128;
  const overhead = opts.overhead ?? 1.35;
  const minFrames = opts.minFrames ?? 8;
  const quiet = opts.quiet ?? 4;
  const delayMs = opts.delayMs ?? 120;
  const ecl = opts.errorCorrectionLevel ?? "L";

  const tx = new OpticalSender(file, {
    blockLen,
    sessionId: opts.sessionId,
    codec: opts.codec,
  });

  // LT decoding is probabilistic, so a fixed k·overhead can fall short for small
  // k. Instead, simulate the decode to find exactly how many sequential frames
  // are actually needed, then add a margin so the GIF still decodes even if a
  // few frames get mangled (e.g. by an app that re-encodes the GIF).
  const probe = new OpticalReceiver({ codecs: opts.codec ? [opts.codec] : undefined });
  const cap = tx.k * 6 + 64;
  let needed = 0;
  for (let seq = 0; seq < cap; seq++) {
    probe.ingest(tx.frame(seq));
    needed = seq + 1;
    if (probe.isComplete) break;
  }
  const margin = Math.ceil(needed * (overhead - 1)) + 2;
  const frames = Math.max(minFrames, needed + margin);

  // Frame payloads all have the same length, but that does not put them all on
  // the same QR version: qrcode picks a version from the *content* via its
  // segment optimizer, so two equal-length frames can differ by a version or
  // more. Every GIF frame must share one size, so find the largest version any
  // frame needs and render them all at it.
  const b64s: string[] = [];
  for (let seq = 0; seq < frames; seq++) b64s.push(bytesToBase64(tx.frame(seq)));

  let version = 1;
  for (const b64 of b64s) {
    const v = QRCode.create(b64, { errorCorrectionLevel: ecl }).version;
    if (v > version) version = v;
  }

  const first = QRCode.create(b64s[0], { errorCorrectionLevel: ecl, version });
  const size = first.modules.size;
  const dim = size + quiet * 2;
  const scale = opts.scale ?? Math.max(3, Math.floor(340 / dim));
  const width = dim * scale;
  const height = width;

  // Generous buffer: LZW of a 2-colour QR compresses well below the raw size.
  const out = new Uint8Array(frames * (width * height + 1024) + 4096);
  const gw = new GifWriter(out, width, height, { loop: 0, palette: [0xffffff, 0x000000] });

  const pixels = new Uint8Array(width * height);
  const delay = Math.max(2, Math.round(delayMs / 10));
  for (let f = 0; f < frames; f++) {
    const qr = f === 0 ? first : QRCode.create(b64s[f], { errorCorrectionLevel: ecl, version });
    const data = qr.modules.data;
    pixels.fill(0);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          const px0 = (c + quiet) * scale;
          const py0 = (r + quiet) * scale;
          for (let yy = 0; yy < scale; yy++) {
            const rowStart = (py0 + yy) * width + px0;
            for (let xx = 0; xx < scale; xx++) pixels[rowStart + xx] = 1;
          }
        }
      }
    }
    gw.addFrame(0, 0, width, height, pixels, { delay });
  }
  const len = gw.end();
  return { gif: out.subarray(0, len), frames, width, height };
}
