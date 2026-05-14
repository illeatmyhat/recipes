/**
 * One-off: crop/resize the hero source photo to the 16:9 size the layout
 * expects and write it to the recipe's images folder.
 *
 * Source: "A bowl of oatmeal with fruit and nuts" by Alex Bayev on Unsplash,
 * used under the free Unsplash License (no attribution required).
 * https://unsplash.com/photos/a-bowl-of-oatmeal-with-fruit-and-nuts-s8GfYrV88vo
 *
 * Usage: node scripts/process-hero.mjs <source.jpg>
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/process-hero.mjs <source-image>');
  process.exit(1);
}

const out = join(process.cwd(), 'src', 'content', 'recipes', 'images', 'overnight-oats.jpg');
mkdirSync(dirname(out), { recursive: true });

// The source is a tall portrait; pull a 16:9 band from the lower-middle where
// the bowl sits, then scale to the layout's 1280x720.
const meta = await sharp(src).metadata();
const cropH = Math.round(meta.width * (9 / 16));
const top = Math.min(meta.height - cropH, Math.round(meta.height * 0.42));

await sharp(src)
  .extract({ left: 0, top, width: meta.width, height: cropH })
  .resize(1280, 720)
  .jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toFile(out);

console.log('wrote', out);
