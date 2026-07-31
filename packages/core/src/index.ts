// @optical-transfer/core — the pure, dependency-free transport.
//
// Everything here runs unchanged on Node, browsers, and React Native (Hermes):
// only integer/typed-array math, no DOM, no camera, no QR rendering. The
// platform layers (web, react-native) supply the pixels and the camera.

export { OpticalSender, DEFAULT_BLOCK_LEN } from "./sender";
export type { SenderOptions } from "./sender";
export { OpticalReceiver } from "./receiver";
export type { ReceiverOptions } from "./receiver";

// Optional payload compression (pluggable — core ships no codec itself).
export { wrapPayload, unwrapPayload, CODEC_IDENTITY } from "./codec";
export type { PayloadCodec } from "./codec";

// Low-level building blocks, exported for advanced use and testing.
export { LTEncoder, LTDecoder } from "./fountain";
export {
  HEADER_LEN,
  packFrame,
  parseFrame,
  fnv1a,
  splitmix32,
} from "./protocol";
export type { FrameHeader } from "./protocol";
