/**
 * Pure nutrition math. No I/O, no framework imports — safe to use at build
 * time (resolveRecipe, RecipePage) and at runtime (Svelte islands).
 */
import type { NutritionFacts, NutrientKey } from './types';

/** Every nutrient key, in display order. */
export const NUTRIENT_KEYS: readonly NutrientKey[] = [
  'calories',
  'fat',
  'saturated_fat',
  'trans_fat',
  'cholesterol',
  'sodium',
  'carbohydrates',
  'fiber',
  'sugars',
  'protein',
  'calcium',
  'iron',
] as const;

/** The unit each nutrient is measured in. */
export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  calories: 'kcal',
  fat: 'g',
  saturated_fat: 'g',
  trans_fat: 'g',
  cholesterol: 'mg',
  sodium: 'mg',
  carbohydrates: 'g',
  fiber: 'g',
  sugars: 'g',
  protein: 'g',
  calcium: 'mg',
  iron: 'mg',
};

/**
 * FDA Daily Values (adults & children 4+, 2016 reference amounts).
 * `null` means the FDA publishes no %DV for that nutrient.
 */
export const DAILY_VALUES: Record<NutrientKey, number | null> = {
  calories: 2000,
  fat: 78,
  saturated_fat: 20,
  trans_fat: null,
  cholesterol: 300,
  sodium: 2300,
  carbohydrates: 275,
  fiber: 28,
  sugars: null,
  protein: 50,
  calcium: 1300,
  iron: 18,
};

/** A zeroed-out facts object — the identity element for {@link sumNutrition}. */
export function emptyNutrition(): NutritionFacts {
  return {
    calories: 0,
    fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    cholesterol: 0,
    sodium: 0,
    carbohydrates: 0,
    fiber: 0,
    sugars: 0,
    protein: 0,
    calcium: 0,
    iron: 0,
  };
}

/** Scale a per-100g facts object by an arbitrary factor. */
export function scaleNutrition(facts: NutritionFacts, factor: number): NutritionFacts {
  const out = emptyNutrition();
  for (const key of NUTRIENT_KEYS) {
    out[key] = facts[key] * factor;
  }
  return out;
}

/** Sum the nutrition of any list of items that carry a `nutrition` field. */
export function sumNutrition(items: ReadonlyArray<{ nutrition: NutritionFacts }>): NutritionFacts {
  const out = emptyNutrition();
  for (const item of items) {
    for (const key of NUTRIENT_KEYS) {
      out[key] += item.nutrition[key];
    }
  }
  return out;
}

/** Total weight in grams of any list of items that carry a `grams` field. */
export function totalWeight(items: ReadonlyArray<{ grams: number }>): number {
  return items.reduce((sum, item) => sum + item.grams, 0);
}

/**
 * Percent Daily Value for a nutrient, rounded to a whole number.
 * Returns `null` when the FDA defines no %DV for that nutrient.
 */
export function pct(key: NutrientKey, value: number): number | null {
  const dv = DAILY_VALUES[key];
  if (dv === null || dv === 0) return null;
  return Math.round((value / dv) * 100);
}

/**
 * Format a nutrient value for display. Calories show as whole numbers;
 * everything else keeps one decimal unless it is effectively whole.
 */
export function fmt(value: number, key?: NutrientKey): string {
  if (key === 'calories') return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Format a value with its unit, e.g. `fmtWithUnit(3.2, 'fat')` -> "3.2g". */
export function fmtWithUnit(value: number, key: NutrientKey): string {
  return `${fmt(value, key)}${NUTRIENT_UNITS[key]}`;
}
