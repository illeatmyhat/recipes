/**
 * Build-time ingredient loader.
 *
 * Reads `/data/ingredients/<id>.yaml` and returns an {@link IngredientLookup}.
 * Degrades gracefully: a missing file becomes a zero-nutrition placeholder
 * (so totals stay honest) with a loud warning, and the `placeholder` flag is
 * surfaced so the UI can mark it.
 *
 * **Locale overlays.** The canonical file carries the locales it was authored
 * with inline; any other supported locale arrives as an
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
import {
  CATALOG_LOCALES,
  LOCALES,
  perLocale,
  type Locale,
  type MarketGuidance,
  type MarketNote,
  type StoreSection,
} from '../types';
import type { IngredientData } from '../types';
import type { IngredientLookup, LoadedIngredient } from './types';

/** A note as authored in YAML: a bare string is a non-important note. */
type RawNote = string | MarketNote;

/** {@link MarketGuidance} as authored: notes may be bare strings. */
interface RawGuidance {
  brands?: string[];
  notes?: RawNote[];
}

/** The localizable fields an overlay file may carry. */
interface OverlayData {
  names?: string;
  aliases?: string[];
  aisle?: StoreSection;
  /** The overlay locale's market guidance (authored in that language). */
  availability?: RawGuidance;
}

/** Normalize authored guidance: bare-string notes become MarketNote objects. */
function normalizeGuidance(raw: RawGuidance): MarketGuidance {
  return {
    brands: raw.brands,
    notes: raw.notes?.map((n) => (typeof n === 'string' ? { text: n } : n)),
  };
}

const INGREDIENT_DIR = join(process.cwd(), 'data', 'ingredients');
const cache = new Map<string, LoadedIngredient>();

function placeholderIngredient(id: string): IngredientData {
  return {
    id,
    fdc_id: 0,
    names: fallbackNames(id),
    aliases: perLocale<string[]>(() => []),
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
      if (overlay.availability !== undefined) {
        (data.availability ??= {})[locale] = normalizeGuidance(overlay.availability);
      }
    }
    data.aliases[locale] ??= [];
  }
  // Completeness: every supported locale needs a name (+ aisle when aisles
  // exist at all) from either the inline fields or an overlay.
  for (const locale of LOCALES) {
    if (data.names[locale] === undefined) {
      throw new Error(
        `recipe db: ingredient "${id}" has no ${locale} name — add names.${locale} inline ` +
          `or the overlay data/ingredients/${locale}/${id}.yaml.`,
      );
    }
    if (data.aisle && data.aisle[locale] === undefined) {
      throw new Error(
        `recipe db: ingredient "${id}" has no ${locale} aisle — add aisle.${locale} inline ` +
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
      throw new Error(`recipe db: ${file} has id "${data?.id}" but was loaded as "${id}".`);
    }
    // Inline guidance is authored with the bare-string note shorthand too.
    if (data.availability) {
      for (const loc of Object.keys(data.availability) as Locale[]) {
        data.availability[loc] = normalizeGuidance(data.availability[loc] as RawGuidance);
      }
    }
    result = { data, placeholder: false };
  } catch (err) {
    // A genuine parse/id error should be loud; a missing file degrades.
    if (err instanceof Error && err.message.startsWith('recipe db:')) throw err;
    console.warn(
      `recipe db: ingredient "${id}" has no ${file} — using a zero-nutrition ` +
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
