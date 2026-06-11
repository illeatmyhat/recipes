/**
 * Build-time ingredient loader.
 *
 * An ingredient on disk is a **locale-neutral core** plus one file per
 * supported locale — the core is a library asset, unbiased toward any
 * culture (no locale gets inline privilege, the canonical one included):
 *
 * - `data/ingredients/<id>.yaml` — id, FDC id, per-100g nutrition, density.
 * - `data/ingredients/<locale>/<id>.yaml` — that locale's `names`, `aliases`,
 *   `aisle`, and optional `availability` (market guidance, unkeyed — the
 *   file IS one locale).
 *
 * Folder-of-small-files by design (decided 2026-06-10): authorship is
 * agent-first, so per-file work units bound context and avoid write
 * contention, and coverage is a listing diff. Completeness gates:
 * **every supported locale needs its file with a name** — and when any
 * locale declares an `aisle`, all must (all-or-nothing), consistent with
 * the catalog completeness gate. `availability` is optional everywhere.
 *
 * Degrades gracefully on a missing CORE file: it becomes a zero-nutrition
 * placeholder (so totals stay honest) with a loud warning, and the
 * `placeholder` flag is surfaced so the UI can mark it. A missing or broken
 * LOCALE file for a real ingredient fails the build instead — silently
 * dropping a locale is worse than a red build.
 * Touches the filesystem — build time only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { emptyNutrition } from '../nutrition';
import { fallbackNames } from './names';
import {
  LOCALES,
  perLocale,
  type Locale,
  type Localized,
  type MarketGuidance,
  type MarketNote,
  type NutritionFacts,
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

/** The locale-neutral core file `data/ingredients/<id>.yaml`. */
interface IngredientCore {
  id: string;
  fdc_id: number;
  nutrition: { per_100g: NutritionFacts };
  density_g_per_ml: number | null;
}

/** A per-locale file `data/ingredients/<locale>/<id>.yaml`. */
interface IngredientLocaleData {
  names?: string;
  aliases?: string[];
  aisle?: StoreSection;
  /** This locale's market guidance (authored in its language, unkeyed). */
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

// One SR Legacy entry may back several shopping-distinct cores (light vs dark
// soy sauce — see reference/sourcing.md). Their numbers must then be identical:
// a divergence means one core was re-sourced and the other silently left behind.
const coresByFdc = new Map<number, { id: string; per100gJson: string }>();

function checkSharedFdc(id: string, core: IngredientCore): void {
  const per100gJson = JSON.stringify(core.nutrition.per_100g);
  const prior = coresByFdc.get(core.fdc_id);
  if (prior && prior.id !== id && prior.per100gJson !== per100gJson) {
    throw new Error(
      `recipe db: "${id}" and "${prior.id}" share fdc_id ${core.fdc_id} but ` +
        `their per_100g blocks differ — re-source one of them (they must be ` +
        `byte-identical to share an SR Legacy entry).`,
    );
  }
  if (!prior) coresByFdc.set(core.fdc_id, { id, per100gJson });
}

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

/** Assemble an ingredient from its core + every locale's file, gating completeness. */
function assemble(id: string, core: IngredientCore): IngredientData {
  const names = {} as Localized;
  const data: IngredientData = {
    ...core,
    names,
    aliases: perLocale<string[]>(() => []),
  };
  for (const locale of LOCALES) {
    const file = join(INGREDIENT_DIR, locale, `${id}.yaml`);
    let loc: IngredientLocaleData | null = null;
    try {
      loc = (load(readFileSync(file, 'utf8')) ?? {}) as IngredientLocaleData;
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') throw err;
    }
    if (loc?.names === undefined) {
      throw new Error(
        `recipe db: ingredient "${id}" has no ${locale} name — add ` +
          `data/ingredients/${locale}/${id}.yaml with names/aliases/aisle.`,
      );
    }
    names[locale] = loc.names;
    if (loc.aliases !== undefined) data.aliases[locale] = loc.aliases;
    if (loc.aisle !== undefined) {
      (data.aisle ??= {} as Record<Locale, StoreSection>)[locale] = loc.aisle;
    }
    if (loc.availability !== undefined) {
      (data.availability ??= {})[locale] = normalizeGuidance(loc.availability);
    }
  }
  // Aisle is all-or-nothing across locales: store geography either exists for
  // every market or the shopping list groups the food under "other" everywhere.
  if (data.aisle) {
    const missing = LOCALES.filter((l) => data.aisle?.[l] === undefined);
    if (missing.length > 0) {
      throw new Error(
        `recipe db: ingredient "${id}" has an aisle in some locales but not ` +
          `${missing.join(', ')} — add aisle to those locale files (or remove it everywhere).`,
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
  let core: IngredientCore | null = null;
  try {
    const parsed = load(readFileSync(file, 'utf8')) as IngredientCore;
    if (!parsed || parsed.id !== id) {
      throw new Error(`recipe db: ${file} has id "${parsed?.id}" but was loaded as "${id}".`);
    }
    checkSharedFdc(id, parsed);
    core = parsed;
  } catch (err) {
    // A genuine parse/id error should be loud; a missing core file degrades.
    if (err instanceof Error && err.message.startsWith('recipe db:')) throw err;
    console.warn(
      `recipe db: ingredient "${id}" has no ${file} — using a zero-nutrition ` +
        `placeholder. Add /data/ingredients/${id}.yaml (or fix a typo'd id).`,
    );
  }
  // Outside the try: a broken or incomplete LOCALE file must fail the build,
  // never degrade the whole ingredient to a placeholder.
  const result: LoadedIngredient = core
    ? { data: assemble(id, core), placeholder: false }
    : { data: placeholderIngredient(id), placeholder: true };
  cache.set(id, result);
  return result;
};
