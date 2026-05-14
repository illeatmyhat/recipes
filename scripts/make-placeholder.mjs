/**
 * One-off: generate a placeholder hero image so the build, the <Image>
 * pipeline, and the layout all work before the real photo is available.
 * Run with `node scripts/make-placeholder.mjs`. Swap in the real JPEG later.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const out = join(process.cwd(), 'src', 'content', 'recipes', 'images', 'overnight-oats.jpg');
mkdirSync(dirname(out), { recursive: true });

const W = 1280;
const H = 720;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0d8b8"/>
      <stop offset="1" stop-color="#c4622d"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="640" cy="330" rx="240" ry="150" fill="#faf7f2"/>
  <ellipse cx="640" cy="318" rx="240" ry="130" fill="#e9ddc8"/>
  <ellipse cx="600" cy="300" rx="34" ry="22" fill="#7ba0c8"/>
  <ellipse cx="675" cy="320" rx="30" ry="20" fill="#9a6fbf"/>
  <ellipse cx="640" cy="345" rx="26" ry="17" fill="#c44d6a"/>
  <text x="640" y="520" font-family="Arial, Helvetica, sans-serif" font-size="56"
        font-weight="700" fill="#2b2522" text-anchor="middle">Overnight Oats &amp; Chia Bowl</text>
  <text x="640" y="572" font-family="Arial, Helvetica, sans-serif" font-size="26"
        fill="#3d352f" text-anchor="middle">placeholder hero image — replace with the real photo</text>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(out);
console.log('wrote', out);
