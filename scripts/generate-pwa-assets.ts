/**
 * Generates the PWA assets from a single source of truth so the app is
 * installable ("Zum Startbildschirm hinzufügen") on iOS/Android/Desktop:
 *
 *   - PNG app icons rasterised from src/app/icon.svg (the brand cookie):
 *       src/app/apple-icon.png        180×180, auto-linked by Next as apple-touch-icon
 *       public/icons/icon-192.png     192×192, transparent
 *       public/icons/icon-512.png     512×512, transparent
 *       public/icons/icon-512-maskable.png  512×512, cookie centred on brand-dark
 *   - public/offline.html, the offline fallback served by public/sw.js, with all
 *     German copy taken from src/messages/de.ts (the single language boundary).
 *
 * Re-run after changing the icon or the offline strings:
 *   pnpm tsx scripts/generate-pwa-assets.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { de } from "../src/messages/de";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const iconSvgPath = join(root, "src/app/icon.svg");
const iconsDir = join(root, "public/icons");
const svg = readFileSync(iconSvgPath);

// Brand-dark backdrop so the gold cookie stays visible inside Android's
// adaptive-icon safe area. Hex mirrors the #26303a in icon.svg.
const MASKABLE_BG = { r: 0x26, g: 0x30, b: 0x3a, alpha: 1 };

/** Rasterise the SVG to a transparent square PNG. High density = crisp downscale. */
function renderTransparent(size: number): Promise<Buffer> {
  return sharp(svg, { density: 1024 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  mkdirSync(iconsDir, { recursive: true });

  // apple-icon: Apple ignores transparency and shows a black square, so flatten
  // onto the light background colour used elsewhere.
  const apple = await sharp(await renderTransparent(180))
    .flatten({ background: { r: 0xfb, g: 0xfd, b: 0xfb, alpha: 1 } })
    .png()
    .toBuffer();
  writeFileSync(join(root, "src/app/apple-icon.png"), apple);

  writeFileSync(join(iconsDir, "icon-192.png"), await renderTransparent(192));
  writeFileSync(join(iconsDir, "icon-512.png"), await renderTransparent(512));

  // Maskable: cookie at ~70% inside the 512 canvas (the rest is the safe-area
  // margin Android may crop) on the brand-dark backdrop.
  const inner = await renderTransparent(360);
  const maskable = await sharp({
    create: { width: 512, height: 512, channels: 4, background: MASKABLE_BG },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toBuffer();
  writeFileSync(join(iconsDir, "icon-512-maskable.png"), maskable);

  writeOfflineHtml();

  console.log("PWA assets written: apple-icon.png, public/icons/*, public/offline.html");
}

/** Self-contained offline page (no JS framework, must render with zero network). */
function writeOfflineHtml() {
  const { app, pwa } = de;
  const icon = svg.toString("utf8");
  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${pwa.offlineTitle} · ${app.name}</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: #fbfdfb;
        color: #16201c;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #16201c; color: #f4f6f4; }
      }
      main { max-width: 22rem; text-align: center; }
      svg { width: 64px; height: 64px; }
      h1 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
      p { margin: 0 0 1.5rem; opacity: 0.8; line-height: 1.5; }
      button {
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        border: 0;
        border-radius: 0.5rem;
        padding: 0.625rem 1.25rem;
        color: #16201c;
        background: #e0a458;
      }
      button:hover { background: #d2933f; }
    </style>
  </head>
  <body>
    <main>
      ${icon}
      <h1>${pwa.offlineTitle}</h1>
      <p>${pwa.offlineBody}</p>
      <button type="button" onclick="location.reload()">${pwa.offlineRetry}</button>
    </main>
  </body>
</html>
`;
  writeFileSync(join(root, "public/offline.html"), html);
}

void main();
