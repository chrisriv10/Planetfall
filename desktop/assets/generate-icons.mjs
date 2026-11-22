// Deterministic raster exports of the hand-authored shared favicon SVG.
// Uses existing Playwright; no downloaded artwork or extra dependencies.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const assets = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(assets, '../../client/public');
const svg = await readFile(path.join(publicDir, 'favicon.svg'), 'utf8');
await mkdir(assets, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const images = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 180]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`);
    const png = await page.screenshot({ type: 'png', omitBackground: true });
    if (size <= 256 && size !== 180) images.push({ size, png });
    if (size === 512) await writeFile(path.join(assets, 'planetfall.png'), png);
    if (size === 180) await writeFile(path.join(publicDir, 'apple-touch-icon.png'), png);
  }
  const directory = Buffer.alloc(6 + images.length * 16);
  directory.writeUInt16LE(1, 2); directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach(({ size, png }, index) => {
    const at = 6 + index * 16;
    directory[at] = directory[at + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, at + 4); directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(png.length, at + 8); directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  const ico = Buffer.concat([directory, ...images.map(image => image.png)]);
  await writeFile(path.join(assets, 'planetfall.ico'), ico);
  await writeFile(path.join(publicDir, 'favicon.ico'), ico);
  console.log('Generated astronaut ICO (16–256px), desktop PNG (512px), Apple icon (180px).');
} finally { await browser.close(); }
