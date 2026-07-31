// decodeGif — reconstruct a file from a shareable animated GIF of QR frames.
//
// Reads each GIF frame, decodes its QR to recover the base64 frame payload, and
// feeds the bytes into the LT-fountain OpticalReceiver until it has enough to
// peel out the original file (self-verified by checksum). Frame order and a few
// unreadable frames don't matter — that's the point of fountain coding.

import { OpticalReceiver } from "@optical-transfer/core";
import type { PayloadCodec } from "@optical-transfer/core";
import omggif from "omggif";
import jsQR from "jsqr";
import { base64ToBytes } from "./base64";

const { GifReader } = omggif;

export interface DecodeGifOptions {
  /** Codecs to reverse a compressed payload (e.g. a gzip codec). */
  codecs?: readonly PayloadCodec[];
}

export interface DecodeGifResult {
  /** The reconstructed file, or null if not enough frames decoded. */
  data: Uint8Array | null;
  /** Total frames in the GIF. */
  frames: number;
  /** Frames whose QR decoded successfully. */
  decoded: number;
  /** Frames accepted by the receiver. */
  ingested: number;
  /** Receiver progress 0..1 (frames-collected metric). */
  progress: number;
  /** Set if a frame decoded but the payload could not be unwrapped. */
  error?: string;
}

export function decodeGif(gif: Uint8Array, opts: DecodeGifOptions = {}): DecodeGifResult {
  const reader = new GifReader(gif);
  const width = reader.width;
  const height = reader.height;
  const n = reader.numFrames();

  const rx = new OpticalReceiver({ codecs: opts.codecs });
  const rgba = new Uint8Array(width * height * 4);
  let decoded = 0;
  let ingested = 0;

  for (let i = 0; i < n; i++) {
    // Clear first: decodeAndBlitFrameRGBA composites onto the buffer, and stale
    // pixels from the previous frame otherwise corrupt the QR for some frames.
    rgba.fill(0);
    reader.decodeAndBlitFrameRGBA(i, rgba);
    const result = jsQR(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, width * height * 4), width, height);
    if (!result) continue;
    decoded++;
    try {
      rx.ingest(base64ToBytes(result.data));
      ingested++;
    } catch {
      // ignore a malformed frame; fountain coding tolerates it
    }
    if (rx.isComplete) break;
  }

  return {
    data: rx.result,
    frames: n,
    decoded,
    ingested,
    progress: rx.progress,
    error: rx.error ?? undefined,
  };
}
