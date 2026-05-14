/**
 * Unit conversion and amount formatting.
 *
 * Recipe amounts are authored in whatever unit reads naturally — grams for
 * bulk ingredients, millilitres for liquids, teaspoons/tablespoons for small
 * measures. This module is the single source of truth for turning those units
 * into grams (for nutrition) and into human-friendly display strings.
 */
import type { Locale, Unit } from './types';

/**
 * Volume units expressed in millilitres. `tsp`/`tbsp` use the metric 5/15 ml
 * convention — it matches Japanese 小さじ / 大さじ exactly and is the rounding
 * every kitchen already uses for US teaspoons.
 */
export const UNIT_ML = {
  ml: 1,
  tsp: 5,
  tbsp: 15,
} as const satisfies Record<string, number>;

/** A unit that measures volume, and therefore needs a density to be weighed. */
export type VolumeUnit = keyof typeof UNIT_ML;

/** Type guard: does this unit measure volume rather than weight? */
export function isVolumeUnit(unit: Unit): unit is VolumeUnit {
  return unit in UNIT_ML;
}

/** Localized unit labels. `tsp`/`tbsp` map to the Japanese spoon words. */
const UNIT_LABEL: Record<Unit, Record<Locale, string>> = {
  g: { en: 'g', ja: 'g' },
  ml: { en: 'ml', ja: 'ml' },
  tsp: { en: 'tsp', ja: '小さじ' },
  tbsp: { en: 'tbsp', ja: '大さじ' },
};

/** Vulgar fractions a cook actually measures with, paired with their values. */
const FRACTIONS: ReadonlyArray<readonly [value: number, glyph: string]> = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''],
];

/** Render a number as a whole part + nearest vulgar fraction, e.g. 1.5 -> "1½". */
function toFractionString(value: number): string {
  const whole = Math.floor(value);
  const remainder = value - whole;

  let best: readonly [number, string] = [0, ''];
  for (const candidate of FRACTIONS) {
    if (Math.abs(candidate[0] - remainder) < Math.abs(best[0] - remainder)) {
      best = candidate;
    }
  }

  // The remainder rounded up to a whole unit (e.g. 0.95 tsp -> "1").
  if (best[0] === 1) return String(whole + 1);
  if (whole === 0) return best[1] === '' ? '0' : best[1];
  return best[1] === '' ? String(whole) : `${whole}${best[1]}`;
}

/**
 * Format a recipe amount for display.
 * - `g` / `ml`: compact metric, e.g. `35g`, `300ml`.
 * - `tsp` / `tbsp`: a vulgar fraction with a localized spoon label. English
 *   reads "½ tsp"; Japanese reads "小さじ½" (the spoon word comes first).
 */
export function formatAmount(amount: number, unit: Unit, locale: Locale): string {
  const label = UNIT_LABEL[unit][locale];

  if (unit === 'g' || unit === 'ml') {
    const rounded = Math.round(amount * 100) / 100;
    return `${rounded}${label}`;
  }

  const fraction = toFractionString(amount);
  return locale === 'ja' ? `${label}${fraction}` : `${fraction} ${label}`;
}
