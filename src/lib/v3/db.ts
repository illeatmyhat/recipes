/**
 * Build-time ingredient loader for v3.
 *
 * Reads `/data/ingredients/<id>.yaml` and returns an {@link IngredientLookup}.
 * Mirrors the v1 loader's graceful degradation: a missing file becomes a
 * zero-nutrition placeholder (so totals stay honest) with a loud warning, and
 * the `placeholder` flag is surfaced so the UI can mark it. Touches the
 * filesystem — build time only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { emptyNutrition } from '../nutrition';
import { humanizeId } from './names';
import type { IngredientData } from '../types';
import type { IngredientLookup, LoadedIngredient } from './types';

const INGREDIENT_DIR = join(process.cwd(), 'data', 'ingredients');
const cache = new Map<string, LoadedIngredient>();

function placeholderIngredient(id: string): IngredientData {
  const name = humanizeId(id);
  return {
    id,
    fdc_id: 0,
    names: { en: name, ja: name },
    aliases: { en: [], ja: [] },
    availability: {
      us: { brands: [], note_en: 'Nutrition data pending.' },
      ja: { brands: [], note_en: 'Nutrition data pending.', note_ja: '栄養データは準備中です。' },
    },
    nutrition: { per_100g: emptyNutrition() },
    density_g_per_ml: 1,
  };
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
  cache.set(id, result);
  return result;
};
