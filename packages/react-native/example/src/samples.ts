// The sample payloads the example can send. Each builds a self-describing
// envelope (mime + filename + bytes) so the receiver knows how to render what
// it reconstructs.
//
// Two groups:
//   • Media  — different content types (text, JSON, image, URL, contact).
//   • Stress — larger / incompressible payloads to actually exercise the
//              fountain codes: watch transfer time climb and dropped frames
//              recover over hundreds of QR frames.

import { base64ToBytes } from "@optical-transfer/react-native";
import { encodeEnvelope } from "./payload";
import { utf8Encode } from "./util";
import { SAMPLE_IMAGE_PNG_BASE64 } from "./sampleImage";

export type SampleGroup = "Media" | "Stress";

export interface Sample {
  key: string;
  label: string;
  group: SampleGroup;
  /** One-line hint shown under the label. */
  hint: string;
  /** Builds the enveloped bytes to hand to OpticalSender. */
  build: () => Uint8Array;
}

// --- content bodies ---------------------------------------------------------

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

// A URL payload — the receiver plays it inline if it's a YouTube link. 🎵
const URL_BODY = "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n";

const VCARD_BODY = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Ada Lovelace",
  "ORG:Analytical Engines",
  "TITLE:Programmer",
  "EMAIL:ada@example.com",
  "TEL:+1-555-0100",
  "URL:https://example.com/ada",
  "END:VCARD",
  "",
].join("\n");

// Compressible large text (repeated lorem) — shows gzip earning its keep.
const LARGE_TEXT_BODY = (() => {
  const para =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod " +
    "tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam. ";
  let s = "";
  while (s.length < 20000) s += para;
  return s;
})();

// Incompressible pseudo-random bytes — worst case for the transport (gzip
// can't shrink it, so every byte must cross the channel). Triggers the
// receiver's octet-stream hex fallback.
function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 256) | 0;
  return a;
}

// --- catalog ----------------------------------------------------------------

export const SAMPLES: Sample[] = [
  {
    key: "text",
    label: "Text",
    group: "Media",
    hint: "text/plain · ~1 KB",
    build: () =>
      encodeEnvelope({ mime: "text/plain", name: "note.txt", data: utf8Encode(TEXT_BODY) }),
  },
  {
    key: "json",
    label: "JSON",
    group: "Media",
    hint: "application/json",
    build: () =>
      encodeEnvelope({ mime: "application/json", name: "data.json", data: utf8Encode(JSON_BODY) }),
  },
  {
    key: "image",
    label: "Image",
    group: "Media",
    hint: "image/png · 64×64",
    build: () =>
      encodeEnvelope({
        mime: "image/png",
        name: "bullseye.png",
        data: base64ToBytes(SAMPLE_IMAGE_PNG_BASE64),
      }),
  },
  {
    key: "url",
    label: "URL (video)",
    group: "Media",
    hint: "text/uri-list · plays inline",
    build: () =>
      encodeEnvelope({ mime: "text/uri-list", name: "link.uri", data: utf8Encode(URL_BODY) }),
  },
  {
    key: "vcard",
    label: "Contact",
    group: "Media",
    hint: "text/vcard",
    build: () =>
      encodeEnvelope({ mime: "text/vcard", name: "ada.vcf", data: utf8Encode(VCARD_BODY) }),
  },
  {
    key: "large-text",
    label: "Large text",
    group: "Stress",
    hint: "~20 KB · compressible",
    build: () =>
      encodeEnvelope({
        mime: "text/plain",
        name: "lorem.txt",
        data: utf8Encode(LARGE_TEXT_BODY),
      }),
  },
  {
    key: "rand-5k",
    label: "Random 5 KB",
    group: "Stress",
    hint: "octet-stream · incompressible",
    build: () =>
      encodeEnvelope({ mime: "application/octet-stream", name: "rand5k.bin", data: randomBytes(5 * 1024) }),
  },
  {
    key: "rand-25k",
    label: "Random 25 KB",
    group: "Stress",
    hint: "octet-stream · long transfer",
    build: () =>
      encodeEnvelope({ mime: "application/octet-stream", name: "rand25k.bin", data: randomBytes(25 * 1024) }),
  },
];
