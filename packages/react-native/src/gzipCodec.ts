// gzipCodec — a ready-made payload codec for React Native, backed by pako.
//
// Pass it to OpticalSenderView (`codec`) and OpticalReceiverView (`codecs`) to
// compress the file before it becomes QR frames. For compressible data (text,
// JSON, most documents) this shrinks the block count `k`, so fewer frames are
// shown and the transfer finishes sooner. The core auto-skips compression when
// it wouldn't help, so it's safe to leave on.

import { deflate, inflate } from "pako";
import type { PayloadCodec } from "@optical-transfer/core";

/** Shared envelope id for the pako/deflate codec (must match on both ends). */
export const GZIP_CODEC_ID = 1;

export const gzipCodec: PayloadCodec = {
  id: GZIP_CODEC_ID,
  encode: (input) => deflate(input),
  decode: (input) => inflate(input),
};

/** Convenience: the default set of codecs to hand OpticalReceiverView. */
export const DEFAULT_CODECS: readonly PayloadCodec[] = [gzipCodec];
