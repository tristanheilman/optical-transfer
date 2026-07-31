// Base64 <-> bytes, the bridge between raw frame bytes and the text-based QR
// channel. We deliberately carry frames as base64 text rather than raw binary
// so that any off-the-shelf QR renderer (byte mode over ASCII) and any QR
// scanner (which hands back a UTF-8 string) round-trip the payload exactly —
// no custom native frame processor needed. Cost: ~33% more QR density.
//
// Pure JS so it behaves identically on Hermes, where global atob/btoa are not
// guaranteed to exist.

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = /* @__PURE__ */ (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < CHARS.length; i++) t[CHARS.charCodeAt(i)] = i;
  t["=".charCodeAt(0)] = -2; // padding sentinel
  return t;
})();

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  const n = bytes.length;
  for (; i + 2 < n; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1]!;
    const c = bytes[i + 2]!;
    out +=
      CHARS[a >> 2] +
      CHARS[((a & 3) << 4) | (b >> 4)] +
      CHARS[((b & 15) << 2) | (c >> 6)] +
      CHARS[c & 63];
  }
  const rem = n - i;
  if (rem === 1) {
    const a = bytes[i]!;
    out += CHARS[a >> 2] + CHARS[(a & 3) << 4] + "==";
  } else if (rem === 2) {
    const a = bytes[i]!;
    const b = bytes[i + 1]!;
    out += CHARS[a >> 2] + CHARS[((a & 3) << 4) | (b >> 4)] + CHARS[(b & 15) << 2] + "=";
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  // Tolerate stray whitespace a scanner might introduce.
  let len = b64.length;
  while (len > 0 && (b64.charCodeAt(len - 1) === 0x3d)) len--; // trim '=' for sizing
  const full = b64.length;
  let pad = 0;
  if (full >= 1 && b64[full - 1] === "=") pad++;
  if (full >= 2 && b64[full - 2] === "=") pad++;
  const outLen = Math.max(0, ((full / 4) | 0) * 3 - pad);
  const out = new Uint8Array(outLen);

  let o = 0;
  let acc = 0;
  let accBits = 0;
  for (let i = 0; i < full; i++) {
    const v = LOOKUP[b64.charCodeAt(i)]!;
    if (v < 0) continue; // padding or whitespace
    acc = (acc << 6) | v;
    accBits += 6;
    if (accBits >= 8) {
      accBits -= 8;
      out[o++] = (acc >> accBits) & 0xff;
    }
  }
  return o === outLen ? out : out.subarray(0, o);
}
