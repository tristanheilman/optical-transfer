// OpticalReceiver — the framework-agnostic capture side.
//
// Feed it raw frame bytes (whatever your QR scanner decoded) via ingest(); it
// parses the header, locks onto the stream with no handshake, peels the file
// out of the fountain, and verifies the FNV-1a checksum before exposing a
// result. A frame from a new sessionId transparently restarts the transfer.

import { LTDecoder } from "./fountain";
import { fnv1a, parseFrame, type FrameHeader } from "./protocol";

/** Overhead factor: expect to need ~k·1.15 distinct frames to solve. */
const OVERHEAD = 1.15;

export class OpticalReceiver {
  private decoder: LTDecoder | null = null;
  private _header: FrameHeader | null = null;
  private _result: Uint8Array | null = null;
  private _done = false;

  /** Header of the stream currently being received, if locked on. */
  get header(): FrameHeader | null {
    return this._header;
  }

  /** True once the file is fully solved and its checksum verified. */
  get isComplete(): boolean {
    return this._done;
  }

  /** The reconstructed file, or null until complete + checksum-verified. */
  get result(): Uint8Array | null {
    return this._done ? this._result : null;
  }

  /** Count of distinct frames accepted for the current session. */
  get framesReceived(): number {
    return this.decoder?.framesNew ?? 0;
  }

  /** 0..1 progress. Frames-collected, not blocks-solved: LT peeling back-loads
   * the block cascade, so a blocks-based bar looks stalled then teleports. */
  get progress(): number {
    if (this._done) return 1;
    if (!this.decoder || !this._header) return 0;
    const target = Math.max(1, Math.ceil(this._header.k * OVERHEAD));
    return Math.min(0.999, this.decoder.framesNew / target);
  }

  /** Feed one decoded QR frame. Malformed/short frames are ignored. */
  ingest(frameBytes: Uint8Array): void {
    const parsed = parseFrame(frameBytes);
    if (!parsed) return;
    const { header, block } = parsed;

    // Lock on, or reset when the sender starts a fresh transfer.
    if (!this._header || this._header.sessionId !== header.sessionId) {
      this._header = header;
      this.decoder = new LTDecoder(header.k, header.blockLen, header.sessionId, header.totalLen);
      this._result = null;
      this._done = false;
    }

    if (this._done) return;
    this.decoder!.addFrame(header.seq, block);

    if (this.decoder!.isComplete) {
      const out = this.decoder!.assemble();
      if (out && fnv1a(out) === this._header!.payloadFnv) {
        this._result = out;
        this._done = true;
      }
      // If the checksum fails, keep ingesting: more frames can still correct
      // a corrupted block (should be vanishingly rare given QR's own ECC).
    }
  }

  /** Drop all state and wait for a fresh stream. */
  reset(): void {
    this.decoder = null;
    this._header = null;
    this._result = null;
    this._done = false;
  }
}
