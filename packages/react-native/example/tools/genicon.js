// Generate a unique iOS app icon for the optical-transfer example: a stylized
// colorful QR code (three finder "eyes" + a rainbow module field) on a dark
// radial background. Opaque RGB (no alpha — iOS rejects alpha in app icons).
// Output: a 1024x1024 PNG.
const zlib = require("zlib");
const fs = require("fs");

const SIZE = 1024;
const buf = Buffer.alloc(SIZE * SIZE * 3);

function setPx(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 3;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
}

function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// 1) Dark radial-gradient background.
const cx0 = SIZE / 2, cy0 = SIZE / 2, maxR = Math.hypot(cx0, cy0);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const t = Math.hypot(x - cx0, y - cy0) / maxR; // 0 center → 1 corner
    const r = Math.round(22 - 14 * t);
    const g = Math.round(22 - 14 * t);
    const b = Math.round(31 - 19 * t);
    setPx(x, y, r, g, b);
  }
}

// Rounded-rect fill (corner radius `rad`).
function fillRoundRect(x, y, w, h, rad, color) {
  const [r, g, b] = color;
  for (let py = Math.floor(y); py < y + h; py++) {
    for (let px = Math.floor(x); px < x + w; px++) {
      const qx = Math.min(Math.max(px, x + rad), x + w - rad);
      const qy = Math.min(Math.max(py, y + rad), y + h - rad);
      const dx = px - qx, dy = py - qy;
      if (dx * dx + dy * dy <= rad * rad) setPx(px, py, r, g, b);
    }
  }
}

const DARK = [11, 11, 15];
const LIGHT = [240, 243, 248];

// 2) Rainbow module field (skip cells under the three finder eyes).
const margin = SIZE * 0.14;
const inner = SIZE - 2 * margin;
const GRID = 9;
const cell = inner / GRID;
const dot = cell * 0.74;
const dotRad = dot * 0.28;

// Finder eyes occupy ~2.6 cells at three corners of the inner area.
const S = cell * 2.6;
const eyes = [
  { x: margin, y: margin }, // top-left
  { x: margin + inner - S, y: margin }, // top-right
  { x: margin, y: margin + inner - S }, // bottom-left
];
function underEye(px, py) {
  for (const e of eyes) {
    if (px >= e.x - cell * 0.1 && px <= e.x + S + cell * 0.1 &&
        py >= e.y - cell * 0.1 && py <= e.y + S + cell * 0.1) return true;
  }
  return false;
}

for (let i = 0; i < GRID; i++) {
  for (let j = 0; j < GRID; j++) {
    const cellCx = margin + cell * (i + 0.5);
    const cellCy = margin + cell * (j + 0.5);
    if (underEye(cellCx, cellCy)) continue;
    // deterministic ~58% density
    const hsh = ((i * 73856093) ^ (j * 19349663) ^ ((i + j) * 83492791)) >>> 0;
    if (hsh % 100 >= 58) continue;
    const hue = (i + j) / (2 * GRID) + 0.02 * ((hsh >> 8) % 8);
    fillRoundRect(cellCx - dot / 2, cellCy - dot / 2, dot, dot, dotRad, hsv(hue, 0.82, 0.98));
  }
}

// 3) Three QR finder eyes: light ring + light center dot (dark carved between).
function eye(x, y) {
  const rad = S * 0.30;
  fillRoundRect(x, y, S, S, rad, LIGHT);
  const in1 = S * 0.16;
  fillRoundRect(x + in1, y + in1, S - 2 * in1, S - 2 * in1, rad * 0.7, DARK);
  const in2 = S * 0.30;
  fillRoundRect(x + in2, y + in2, S - 2 * in2, S - 2 * in2, rad * 0.5, LIGHT);
}
for (const e of eyes) eye(e.x, e.y);

// --- PNG encode (opaque RGB) ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, "ascii");
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, cb]);
}
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 3)] = 0;
  buf.copy(raw, y * (1 + SIZE * 3) + 1, y * SIZE * 3, (y + 1) * SIZE * 3);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
const dest = process.argv[2];
fs.writeFileSync(dest, png);
console.log(`wrote ${dest} (${png.length} bytes)`);
