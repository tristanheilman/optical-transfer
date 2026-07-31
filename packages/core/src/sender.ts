// OpticalSender — the framework-agnostic broadcast side.
//
// Wraps LTEncoder + the frame protocol into a single object an app can pump
// into any QR renderer. It never touches a screen, canvas, or DOM: it just
// turns `seq` numbers into self-describing frame bytes. Drive it however you
// like — a `for` loop over `stream()`, a `setInterval`, or a rAF callback.

import { LTEncoder } from "./fountain";
import { fnv1a, packFrame, type FrameHeader } from "./protocol";
import { wrapPayload, type PayloadCodec } from "./codec";

export interface SenderOptions {
  /** Payload bytes per frame (excludes the 20-byte header). Default 256. */
  blockLen?: number;
  /** 16-bit id identifying this transfer. Random per sender if omitted. */
  sessionId?: number;
  /**
   * Optional payload codec (e.g. gzip). Applied to the whole file before
   * fountain-encoding, and only if it shrinks the payload. The receiver needs
   * a codec with the same id to reverse it.
   */
  codec?: PayloadCodec;
}

/** Default payload size per QR frame — a balance of QR density vs. throughput. */
export const DEFAULT_BLOCK_LEN = 256;

function randomSessionId(): number {
  // Non-deterministic on purpose: distinguishes one transfer from the next.
  // Not part of the fountain PRNG path (that seeds off sessionId + seq, both
  // carried in every frame header), so Math.random is fine here.
  return (Math.floor(Math.random() * 0x10000) & 0xffff) >>> 0;
}

export class OpticalSender {
  /** Header template shared by every frame; only `seq` changes per frame. */
  readonly header: FrameHeader;
  private readonly encoder: LTEncoder;

  constructor(file: Uint8Array, opts: SenderOptions = {}) {
    if (file.length === 0) throw new Error("OpticalSender: file is empty");
    const blockLen = opts.blockLen ?? DEFAULT_BLOCK_LEN;
    if (blockLen <= 0 || blockLen > 0xffff) {
      throw new Error(`OpticalSender: blockLen must be 1..65535, got ${blockLen}`);
    }
    const sessionId = (opts.sessionId ?? randomSessionId()) & 0xffff;
    // Wrap once (envelope + optional compression); the transport carries the
    // wrapped bytes, so totalLen/checksum are computed over them.
    const wrapped = wrapPayload(file, opts.codec);
    this.encoder = new LTEncoder(wrapped, blockLen, sessionId);
    this.header = {
      sessionId,
      seq: 0,
      k: this.encoder.k,
      blockLen,
      totalLen: wrapped.length,
      payloadFnv: fnv1a(wrapped),
    };
  }

  /** Number of source blocks — the receiver needs ~k·1.15 distinct frames. */
  get k(): number {
    return this.encoder.k;
  }

  /** Build the self-describing bytes for a single frame `seq`. */
  frame(seq: number): Uint8Array {
    const s = seq >>> 0;
    return packFrame({ ...this.header, seq: s }, this.encoder.encode(s));
  }

  /** Endless stream of frame bytes, seq = startSeq, startSeq+1, … (wrapping). */
  *stream(startSeq = 0): Generator<Uint8Array, never> {
    for (let seq = startSeq >>> 0; ; seq = (seq + 1) >>> 0) {
      yield this.frame(seq);
    }
  }
}
