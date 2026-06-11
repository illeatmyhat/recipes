/**
 * Build-time ingredient loader for v3.
 *
 * Reads `/data/ingredients/<id>.yaml` and returns an {@link IngredientLookup}.
 * Mirrors the v1 loader's graceful degradation: a missing file becomes a
 * zero-nutrition placeholder (so totals stay honest) with a loud warning, and
 * the `placeholder` flag is surfaced so the UI can mark it.
 *
 * **Locale overlays.** The canonical file carries the locales it was authored
 * with inline (en-US/ja-JP today); any other supported locale arrives as an
 * overlay file mirroring the canonical filename —
 * `data/ingredients/<locale>/<id>.yaml` with just the localizable fields
 * (`names`, `aliases`, `aisle`) — merged here at load. Folder-of-small-files
 * by design (decided 2026-06-10): authorship is agent-first, so per-file work
 * units bound context and avoid write contention, and coverage is a listing
 * diff. **Every supported locale must end up with a name and (when the
 * canonical file has aisles) an aisle — inline or overlay — or the build
 * fails**, consistent with the catalog completeness gate.
 * Touches the filesystem — build time only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { emptyNutrition } from '../nutrition';
import { fallbackNames } from './names';
import { CATALOG_LOCALES, LOCALES, perLocale, type StoreSection } from '../types';
import type { IngredientData } from '../types';
import type { IngredientLookup, LoadedIngredient } from './types';

/** The localizable fields an overlay file may carry. */
interface OverlayData {
  names?: string;
  aliases?: string[];
  aisle?: StoreSection;
}

const INGREDIENT_DIR = join(process.cwd(), 'data', 'ingredients');
const cache = new Map<string, LoadedIngredient>();

function placeholderIngredient(id: string): IngredientData {
  return {
    id,
    fdc_id: 0,
    names: fallbackNames(id),
    aliases: perLocale<string[]>(() => []),
    availability: {
      us: { brands: [], note_en: 'Nutrition data pending.' },
      ja: { brands: [], note_en: 'Nutrition data pending.', note_ja: '栄養データは準備中です。' },
    },
    nutrition: { per_100g: emptyNutrition() },
    density_g_per_ml: 1,
  };
}

/** Merge each catalog locale's overlay file and enforce per-locale completeness. */
function applyOverlays(id: string, data: IngredientData): IngredientData {
  for (const locale of CATALOG_LOCALES) {
    const file = join(INGREDIENT_DIR, locale, `${id}.yaml`);
    let overlay: OverlayData | null = null;
    try {
      overlay = (load(readFileSync(file, 'utf8')) ?? {}) as OverlayData;
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') throw err;
    }
    if (overlay) {
      if (overlay.names !== undefined) data.names[locale] = overlay.names;
      if (overlay.aliases !== undefined) data.aliases[locale] = overlay.aliases;
      if (overlay.aisle !== undefined && data.aisle) data.aisle[locale] = overlay.aisle;
    }
    data.aliases[locale] ??= [];
  }
  // Completeness: every supported locale needs a name (+ aisle when aisles
  // exist at all) from either the inline fields or an overlay.
  for (const locale of LOCALES) {
    if (data.names[locale] === undefined) {
      throw new Error(
        `v3 db: ingredient "${id}" has no ${locale} name — add names.${locale} inline ` +
          `or the overlay data/ingredients/${locale}/${id}.yaml.`,
      );
    }
    if (data.aisle && data.aisle[locale] === undefined) {
      throw new Error(
        `v3 db: ingredient "${id}" has no ${locale} aisle — add aisle.${locale} inline ` +
          `or to the overlay data/ingredients/${locale}/${id}.yaml.`,
      );
    }
  }
  return data;
}

/** The build-time lookup: load + cache by id, degrading to a placeholder on miss. */
export const loadIngredient: IngredientLookup = (id: string): LoadedIngredient => {
  const cached = cache.get(id);
  if (cached) return cached;

  const file = join(INGREDIENT_DIR, `${id}.yaml`);
  let result: LoadedIngredient;
  try {
    const data = load(readFileSync(file, 'utf8')) as IngredientData;
    if (!data || data.id !== id) {
      throw new Error(`v3 db: ${file} has id "${data?.id}" but was loaded as "${id}".`);
    }
    result = { data, placeholder: false };
  } catch (err) {
    // A genuine parse/id error should be loud; a missing file degrades.
    if (err instanceof Error && err.message.startsWith('v3 db:')) throw err;
    console.warn(
      `v3 db: ingredient "${id}" has no ${file} — using a zero-nutrition ` +
        `placeholder. Add /data/ingredients/${id}.yaml (or fix a typo'd id).`,
    );
    result = { data: placeholderIngredient(id), placeholder: true };
  }
  // Outside the try: a broken or incomplete OVERLAY must fail the build, never
  // degrade the whole ingredient to a placeholder.
  if (!result.placeholder) {
    result = { data: applyOverlays(id, result.data), placeholder: false };
  }
  cache.set(id, result);
  return result;
};
