// optical-transfer GIF viewer — a self-contained web tool.
//
//   Decode: drop a shared GIF → reconstruct + download the file.
//   Encode: pick a file → download an animated-QR GIF you can share anywhere.
//
// Everything runs in the browser; the file never leaves the page.

import { encodeGif, decodeGif } from "@optical-transfer/gif";
import type { PayloadCodec } from "@optical-transfer/core";
import { deflate, inflate } from "pako";

// Matches the React Native package's gzipCodec (id 1) so app-made GIFs decode.
const gzip: PayloadCodec = {
  id: 1,
  encode: (i) => deflate(i),
  decode: (i) => inflate(i),
};
const CODECS = [gzip];

// --- app-level envelope: `mime\nfilename\nbytes` (see example/src/payload.ts) --
interface Envelope {
  mime: string;
  name: string;
  data: Uint8Array;
}
function encodeEnvelope(e: Envelope): Uint8Array {
  const header = new TextEncoder().encode(`${e.mime}\n${e.name}\n`);
  const out = new Uint8Array(header.length + e.data.length);
  out.set(header, 0);
  out.set(e.data, header.length);
  return out;
}
function decodeEnvelope(bytes: Uint8Array): Envelope | null {
  let nl1 = -1;
  let nl2 = -1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0a) {
      if (nl1 < 0) nl1 = i;
      else {
        nl2 = i;
        break;
      }
    }
  }
  if (nl1 < 0 || nl2 < 0) return null;
  const dec = new TextDecoder();
  return {
    mime: dec.decode(bytes.subarray(0, nl1)),
    name: dec.decode(bytes.subarray(nl1 + 1, nl2)),
    data: bytes.slice(nl2 + 1),
  };
}

// --- tiny DOM helpers --------------------------------------------------------
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props as any;
  if (cls) node.className = cls;
  Object.assign(node, rest);
  for (const c of children) node.append(c);
  return node;
}
function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function download(bytes: Uint8Array, name: string, mime: string): void {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function blobUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
function yieldPaint(): Promise<void> {
  return new Promise((r) => setTimeout(r, 30));
}

// --- decode panel ------------------------------------------------------------
function decodePanel(): HTMLElement {
  const status = el("p", { class: "status" });
  const result = el("div", { class: "result" });

  const drop = el(
    "label",
    { class: "drop" },
    el("input", { type: "file", accept: "image/gif", class: "hidden" }),
    el("div", { class: "drop-inner" }, el("div", { class: "drop-emoji" }, "🎞️"), el("div", {}, "Drop a GIF here, or click to choose")),
  );
  const input = drop.querySelector("input")!;

  async function handle(file: File) {
    result.replaceChildren();
    status.textContent = "Decoding frames…";
    await yieldPaint();
    try {
      const gif = new Uint8Array(await file.arrayBuffer());
      const res = decodeGif(gif, { codecs: CODECS });
      if (!res.data) {
        status.textContent = res.error
          ? `Couldn't decode: ${res.error}`
          : `Couldn't recover the file — decoded ${res.ingested}/${res.frames} frames (${Math.round(res.progress * 100)}%). Is this an optical-transfer GIF, or was it re-encoded?`;
        return;
      }
      const env = decodeEnvelope(res.data) ?? { mime: "application/octet-stream", name: "recovered.bin", data: res.data };
      status.textContent = `✓ Recovered ${env.name} · ${humanBytes(env.data.length)} · ${env.mime} (from ${res.ingested} frames)`;
      renderResult(env);
    } catch (e) {
      status.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  function renderResult(env: Envelope) {
    const dl = el("button", { class: "btn primary" }, `Download ${env.name}`);
    dl.onclick = () => download(env.data, env.name, env.mime);
    let preview: Node | null = null;
    if (env.mime.startsWith("image/")) {
      preview = el("img", { class: "preview-img", src: blobUrl(env.data, env.mime) });
    } else if (env.mime === "application/json" || env.mime.startsWith("text/")) {
      const text = new TextDecoder().decode(env.data);
      const url = text.trim().match(/^https?:\/\/\S+$/i)?.[0] ?? null;
      preview = url
        ? el("a", { class: "link", href: url, target: "_blank", rel: "noreferrer noopener" }, url)
        : el("pre", { class: "preview-text" }, text.slice(0, 4000));
    }
    result.replaceChildren(dl, ...(preview ? [preview] : []));
  }

  input.onchange = () => {
    const f = input.files?.[0];
    if (f) handle(f);
  };
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    const f = e.dataTransfer?.files?.[0];
    if (f) handle(f);
  });

  return el("div", { class: "panel" }, drop, status, result);
}

// --- encode panel ------------------------------------------------------------
function encodePanel(): HTMLElement {
  const status = el("p", { class: "status" });
  const result = el("div", { class: "result" });
  const compress = el("input", { type: "checkbox", checked: true }) as HTMLInputElement;

  const pick = el(
    "label",
    { class: "drop" },
    el("input", { type: "file", class: "hidden" }),
    el("div", { class: "drop-inner" }, el("div", { class: "drop-emoji" }, "📤"), el("div", {}, "Choose a file to turn into a shareable GIF")),
  );
  const input = pick.querySelector("input")!;

  async function handle(file: File) {
    result.replaceChildren();
    status.textContent = "Encoding…";
    await yieldPaint();
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const mime = file.type || "application/octet-stream";
      const env = encodeEnvelope({ mime, name: file.name, data });
      const out = encodeGif(env, { codec: compress.checked ? gzip : undefined });
      status.textContent = `✓ ${file.name} → GIF · ${out.frames} frames · ${out.width}px · ${humanBytes(out.gif.length)}`;
      const img = el("img", { class: "preview-img", src: blobUrl(out.gif, "image/gif") });
      const dl = el("button", { class: "btn primary" }, "Download GIF");
      dl.onclick = () => download(out.gif, `${file.name}.gif`, "image/gif");
      result.replaceChildren(img, dl);
    } catch (e) {
      status.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) handle(f);
  };

  const opts = el(
    "label",
    { class: "opt" },
    compress,
    el("span", {}, " Compress (gzip) — smaller GIF for compressible files"),
  );
  return el("div", { class: "panel" }, pick, opts, status, result);
}

// --- shell -------------------------------------------------------------------
function main() {
  const app = document.getElementById("app")!;
  const decode = decodePanel();
  const encode = encodePanel();
  encode.style.display = "none";

  const tabDecode = el("button", { class: "tab active" }, "Decode a GIF");
  const tabEncode = el("button", { class: "tab" }, "Make a GIF");
  tabDecode.onclick = () => {
    tabDecode.classList.add("active");
    tabEncode.classList.remove("active");
    decode.style.display = "";
    encode.style.display = "none";
  };
  tabEncode.onclick = () => {
    tabEncode.classList.add("active");
    tabDecode.classList.remove("active");
    encode.style.display = "";
    decode.style.display = "none";
  };

  app.append(
    el("header", { class: "hd" },
      el("h1", {}, "optical-transfer"),
      el("p", { class: "sub" }, "Turn a shared animated-QR GIF back into a file — right here in your browser. Nothing is uploaded."),
    ),
    el("div", { class: "tabs" }, tabDecode, tabEncode),
    decode,
    encode,
    el("footer", { class: "ft" },
      el("span", {}, "Built on LT fountain codes. "),
      el("a", { class: "link", href: "https://github.com/tristanheilman/react-native-optical-transfer", target: "_blank", rel: "noreferrer noopener" }, "GitHub"),
    ),
  );
}
main();
