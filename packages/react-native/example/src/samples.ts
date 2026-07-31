// The sample payloads the example can send, one per media type. Each builds a
// self-describing envelope (mime + filename + bytes) so the receiver knows how
// to render what it reconstructs.

import { base64ToBytes } from "@optical-transfer/react-native";
import { encodeEnvelope } from "./payload";
import { utf8Encode } from "./util";
import { SAMPLE_IMAGE_PNG_BASE64 } from "./sampleImage";

export interface Sample {
  key: "text" | "json" | "image";
  label: string;
  /** One-line hint shown under the button. */
  hint: string;
  /** Builds the enveloped bytes to hand to OpticalSender. */
  build: () => Uint8Array;
}

const TEXT_BODY = (() => {
  const lines = ["optical-transfer demo — plain text", "-----------------------------------"];
  for (let i = 0; i < 24; i++) {
    lines.push(`line ${i.toString().padStart(2, "0")}: the quick brown fox jumps over the lazy dog`);
  }
  return lines.join("\n");
})();

const JSON_BODY = JSON.stringify(
  {
    app: "optical-transfer",
    transport: "LT fountain codes over animated QR",
    features: ["no network", "no pairing", "loss-tolerant", "optional gzip"],
    demo: { sentAt: "2026-07-31", frames: "any ~k·1.15, any order" },
  },
  null,
  2,
);

export const SAMPLES: Sample[] = [
  {
    key: "text",
    label: "Text",
    hint: "text/plain · ~1 KB",
    build: () =>
      encodeEnvelope({ mime: "text/plain", name: "note.txt", data: utf8Encode(TEXT_BODY) }),
  },
  {
    key: "json",
    label: "JSON",
    hint: "application/json",
    build: () =>
      encodeEnvelope({ mime: "application/json", name: "data.json", data: utf8Encode(JSON_BODY) }),
  },
  {
    key: "image",
    label: "Image",
    hint: "image/png · 64×64",
    build: () =>
      encodeEnvelope({
        mime: "image/png",
        name: "bullseye.png",
        data: base64ToBytes(SAMPLE_IMAGE_PNG_BASE64),
      }),
  },
];
