# Converting kitchen units to metric

**Metric (`g` / `ml`) is the single source of truth.** Transcripts give cups,
tablespoons, "a handful", etc. Convert everything to `g` or `ml` before writing
frontmatter. The display layer (`src/lib/units.ts`) regenerates a tsp/tbsp hint
from metric — never store kitchen units.

## Rules of thumb

- **Prefer `g` (weight) for solids and powders.** Volume of a solid varies with
  packing; weight is exact and needs no density.
- **Use `ml` only for liquids** (milk, oil, extracts, water). Any ingredient
  used in `ml` MUST have a non-null `density_g_per_ml` in its YAML, because
  nutrition math weighs it: `grams = ml × density`.
- Round to sensible precision: whole grams for most things, 0.5 g for salt/
  spices, whole ml for liquids.

## Volume → ml (fixed, ingredient-independent)

| Unit            | ml    |
| --------------- | ----- |
| 1 cup (US)      | 240   |
| 1 tablespoon    | 15    |
| 1 teaspoon      | 5     |
| 1 fl oz         | 30    |

## Weight → g (fixed)

| Unit   | g    |
| ------ | ---- |
| 1 oz   | 28.35 |
| 1 lb   | 453.6 |

## Common ingredient weights & densities

When the transcript gives a *volume of a solid*, convert to grams with these
approximate per-cup weights (USDA / common references). For liquids, set the
ingredient's `density_g_per_ml`.

| Ingredient            | g per US cup | density_g_per_ml |
| --------------------- | ------------ | ---------------- |
| Water                 | 240          | 1.00             |
| Milk / kefir / yogurt | ~245         | 1.03             |
| Vegetable / olive oil | ~218         | 0.91             |
| Honey / maple syrup   | ~340         | 1.42             |
| Vanilla & extracts    | —            | 0.88 (≈ water/ethanol) |
| Granulated sugar      | 200          | (use g)          |
| Brown sugar (packed)  | 220          | (use g)          |
| All-purpose flour     | 125          | (use g)          |
| Rolled oats           | 90           | (use g)          |
| Chia / flax seeds     | ~160         | (use g)          |
| Chopped nuts          | ~120         | (use g)          |
| Fresh berries         | ~140         | (use g)          |
| Table salt            | 273          | (use g)          |

These are approximations for converting a recipe's volume into a weight — fine,
because the source recipe's amounts are themselves approximate. The **nutrition
density (per-100g)** is the exact part and always comes from USDA SR Legacy.

When unsure of a solid's cup weight, search it ("grams per cup of <X>") rather
than guessing wildly; the goal is a believable amount, not false precision.
