// App-level payload envelope.
//
// The optical-transfer core is a *raw-byte* transport — it has no notion of
// "what" the bytes are. So if an app wants the receiver to know whether it got
// text, an image, or a file, the app supplies that itself. This is exactly the
// "use it however you choose" layering: metadata lives above the transport.
//
// This example uses a tiny, human-readable header:
//
//     <mime>\n<filename>\n<raw data bytes…>
//
// `mime` and `filename` are UTF-8 and never contain a newline, so the two 0x0A
// bytes unambiguously delimit the header from the binary body. The whole
// envelope is then handed to OpticalSender (and gzip-compressed by the transport
// codec below it, transparently).

import { utf8Encode, utf8Decode } from "./util";

export interface Envelope {
  /** MIME type, e.g. "text/plain", "image/png", "application/json". */
  mime: string;
  /** Suggested filename, e.g. "note.txt". */
  name: string;
  /** The raw content bytes. */
  data: Uint8Array;
}

const NL = 0x0a;

export function encodeEnvelope(e: Envelope): Uint8Array {
  const header = utf8Encode(`${e.mime}\n${e.name}\n`);
  const out = new Uint8Array(header.length + e.data.length);
  out.set(header, 0);
  out.set(e.data, header.length);
  return out;
}

export function decodeEnvelope(bytes: Uint8Array): Envelope {
  let nl1 = -1;
  let nl2 = -1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === NL) {
      if (nl1 < 0) nl1 = i;
      else {
        nl2 = i;
        break;
      }
    }
  }
  if (nl1 < 0 || nl2 < 0) {
    throw new Error("malformed envelope (missing mime/name header)");
  }
  return {
    mime: utf8Decode(bytes.subarray(0, nl1)),
    name: utf8Decode(bytes.subarray(nl1 + 1, nl2)),
    data: bytes.slice(nl2 + 1),
  };
}
