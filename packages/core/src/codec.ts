// Payload codecs + envelope — optional, pluggable compression (or any byte
// transform) applied to the whole file before it enters the fountain encoder.
//
// The transport stays self-describing: a single envelope byte prefixed to the
// payload records which codec was applied, so the receiver reverses it with no
// out-of-band handshake. Core ships NO codec implementations (staying
// dependency-free) — callers inject one (e.g. gzip via pako on React Native,
// or zlib on Node). Ids are shared 1:1 between the sending and receiving codec.

export interface PayloadCodec {
  /** 1..255, stamped into the envelope. 0 is reserved for identity (no codec). */
  readonly id: number;
  /** Transform the payload (e.g. compress). */
  encode(input: Uint8Array): Uint8Array;
  /** Reverse `encode` (e.g. decompress). */
  decode(input: Uint8Array): Uint8Array;
}

/** Envelope id meaning "no transform — the bytes that follow are the payload". */
export const CODEC_IDENTITY = 0;

/**
 * Prefix the payload with a 1-byte codec id. If a codec is given and it
 * actually shrinks the payload, its output is used; otherwise the raw payload
 * is stored under the identity id (so incompressible data is never inflated).
 */
export function wrapPayload(payload: Uint8Array, codec?: PayloadCodec): Uint8Array {
  if (codec) {
    if (codec.id <= 0 || codec.id > 255 || (codec.id | 0) !== codec.id) {
      throw new Error(`PayloadCodec.id must be an integer 1..255, got ${codec.id}`);
    }
    const encoded = codec.encode(payload);
    if (encoded.length < payload.length) {
      const out = new Uint8Array(encoded.length + 1);
      out[0] = codec.id;
      out.set(encoded, 1);
      return out;
    }
  }
  const out = new Uint8Array(payload.length + 1);
  out[0] = CODEC_IDENTITY;
  out.set(payload, 1);
  return out;
}

/**
 * Reverse {@link wrapPayload}. For a non-identity envelope, a codec with the
 * matching id must be present in `codecs`, else this throws.
 */
export function unwrapPayload(wrapped: Uint8Array, codecs?: readonly PayloadCodec[]): Uint8Array {
  if (wrapped.length === 0) return new Uint8Array(0);
  const id = wrapped[0]!;
  const body = wrapped.subarray(1);
  if (id === CODEC_IDENTITY) return body.slice();
  const codec = codecs?.find((c) => c.id === id);
  if (!codec) {
    throw new Error(`unwrapPayload: no codec registered for envelope id ${id}`);
  }
  return codec.decode(body);
}
