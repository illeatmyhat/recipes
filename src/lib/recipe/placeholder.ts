/**
 * The zero-nutrition stand-in for an ingredient id with no data — ONE
 * definition shared by the build-time loader (db.ts, missing core file) and
 * the client store (RecipeStore.ts, id missing from the bundle), so SSR and
 * the hydrated islands can never disagree about the missing-ingredient
 * shape. Browser-safe: no filesystem.
 */
import { emptyNutrition } from '../nutrition';
import { perLocale } from '../types';
import { fallbackNames } from './names';
import type { LoadedIngredient } from './types';

export function placeholderIngredient(id: string): LoadedIngredient {
  return {
    data: {
      id,
      fdc_id: 0,
      names: fallbackNames(id),
      aliases: perLocale<string[]>(() => []),
      nutrition: { per_100g: emptyNutrition() },
      density_g_per_ml: 1,
    },
    placeholder: true,
  };
}
