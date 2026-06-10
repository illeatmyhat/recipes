/**
 * Crop/resize any source photo to the 16:9 1280x720 hero the recipe layout
 * expects, writing it to src/content/recipes/images/<slug>.jpg.
 *
 * Run from the project root:
 *   node .claude/skills/recipe-from-youtube/scripts/process-hero.mjs <source> <slug>
 *
 * Unlike the recipe-specific scripts/process-hero.mjs (which hard-codes the
 * overnight-oats crop band), this uses sharp's attention-based crop, so it
 * produces a sensible 16:9 hero from a source of any aspect ratio.
 *
 * Source the photo from a license that allows reuse (e.g. the free Unsplash
 * License) and credit it in README.md, matching the existing hero.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const [src, slug] = process.argv.slice(2);
if (!src || !slug) {
  console.error('usage: node process-hero.mjs <source-image> <slug>');
  process.exit(1);
}

const out = join(process.cwd(), 'src', 'content', 'recipes', 'images', `${slug}.jpg`);
mkdirSync(dirname(out), { recursive: true });

await sharp(src)
  .resize(1280, 720, { fit: 'cover', position: sharp.strategy.attention })
  .jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toFile(out);

console.log('wrote', out);
