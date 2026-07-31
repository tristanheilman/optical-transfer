// Bundle the viewer into a single self-contained HTML file (no external assets),
// so it can be hosted anywhere (GitHub Pages) or opened straight from disk.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [join(here, "main.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  write: false,
});

const js = result.outputFiles[0].text;
const template = readFileSync(join(here, "index.template.html"), "utf8");
const html = template.replace("%BUNDLE%", () => js);

const outDir = join(here, "..", "..", "docs", "viewer");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "index.html");
writeFileSync(outFile, html);

console.log(`wrote ${outFile} (${(html.length / 1024).toFixed(0)} KB, bundle ${(js.length / 1024).toFixed(0)} KB)`);
