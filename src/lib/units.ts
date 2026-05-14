/**
 * Amount formatting.
 *
 * Recipe amounts are always authored and stored in metric (g / ml) — that is
 * the single source of truth, including for nutrition. For small measures it
 * is handy to *also* see a familiar kitchen unit, so `formatAmount` appends an
 * approximate teaspoon/tablespoon rendering when one is useful. The kitchen
 * unit is display-only and never feeds back into the data.
 */
import type { Locale, Unit } from './types';

/** Millilitres per teaspoon / tablespoon. The 5/15 ml convention matches
 *  Japanese 小さじ / 大さじ exactly and is the everyday rounding for US tsp. */
const TSP_ML = 5;
const TBSP_ML = 15;

/** Above this volume a metric measure reads more clearly than spoons (~3 tbsp). */
const KITCHEN_MAX_ML = 45;

/** Common measuring-spoon fractions used for the approximate rendering. */
const SPOON_FRACTIONS: ReadonlyArray<readonly [value: number, glyph: string]> = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
];

/**
 * Render a spoon count as a whole-plus-fraction string, e.g. 1.33 -> "1⅓".
 * Returns null when the count is so small it rounds away to nothing.
 */
function toSpoonString(count: number): string | null {
  const whole = Math.floor(count);
  const remainder = count - whole;

  // Closest of: no fraction, a spoon fraction, or rounding up to the next whole.
  let bestGlyph = '';
  let bestDist = Math.abs(0 - remainder);
  for (const [value, glyph] of SPOON_FRACTIONS) {
    const dist = Math.abs(value - remainder);
    if (dist < bestDist) {
      bestDist = dist;
      bestGlyph = glyph;
    }
  }
  if (Math.abs(1 - remainder) < bestDist) return String(whole + 1);
  if (whole === 0) return bestGlyph === '' ? null : bestGlyph;
  return bestGlyph === '' ? String(whole) : `${whole}${bestGlyph}`;
}

/**
 * An approximate teaspoon/tablespoon rendering of a small volume, e.g.
 * "(≈ ⅓ tsp)" / "（約小さじ⅓）". Returns null when the ingredient cannot be
 * measured by volume (no density) or is large enough that metric is clearer.
 */
function kitchenHint(volumeMl: number | null, locale: Locale): string | null {
  if (volumeMl === null || volumeMl <= 0 || volumeMl > KITCHEN_MAX_ML) {
    return null;
  }
  const useTbsp = volumeMl >= TBSP_ML;
  const count = volumeMl / (useTbsp ? TBSP_ML : TSP_ML);
  const spoons = toSpoonString(count);
  if (spoons === null) return null;

  if (locale === 'ja') {
    return `（約${useTbsp ? '大さじ' : '小さじ'}${spoons}）`;
  }
  return `(≈ ${spoons} ${useTbsp ? 'tbsp' : 'tsp'})`;
}

/**
 * Format a recipe amount for display: the metric value, plus an approximate
 * kitchen-unit hint for small measures (e.g. `2ml (≈ ⅓ tsp)`).
 *
 * @param volumeMl  the amount as a volume, or null if it has no known density
 */
export function formatAmount(
  amount: number,
  unit: Unit,
  volumeMl: number | null,
  locale: Locale,
): string {
  const rounded = Math.round(amount * 100) / 100;
  const metric = `${rounded}${unit}`;
  const hint = kitchenHint(volumeMl, locale);
  return hint === null ? metric : `${metric} ${hint}`;
}
