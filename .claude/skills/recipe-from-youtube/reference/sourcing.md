# USDA SR Legacy nutrition sourcing (HARD RULE)

Every ingredient's `per_100g` nutrition **must come exclusively from the USDA
SR Legacy dataset.** Foundation, FNDDS, and Branded FoodData Central entries are
off-limits — even though the FDC site mixes them together. This is a project
hard rule (CLAUDE.md); it keeps the dataset internally consistent.

## Use the fetch script — it enforces the rule

`scripts/fetch-usda.mjs` only ever searches `dataType=SR Legacy` and **refuses**
to print nutrition for any fdcId that isn't SR Legacy. Always go through it
rather than reading numbers off the website.

```bash
# 1. Find SR Legacy candidates for an ingredient the transcript mentions:
node .claude/skills/recipe-from-youtube/scripts/fetch-usda.mjs --search "rolled oats"
#    -> prints  <fdcId>\t<description>  lines; pick the closest plain entry.

# 2. Write the locale-neutral core file directly (preferred — no hand-copying):
node .claude/skills/recipe-from-youtube/scripts/fetch-usda.mjs 169705 --write rolled_oats
#    -> writes data/ingredients/rolled_oats.yaml; refuses if the file exists.
#    Add --density <g_per_ml> for anything a recipe uses with `ml` (oils 0.91,
#    sauces ~1.15–1.2 — see reference/units.md). Solids omit it (null).

# (Or print the block for inspection without writing:)
node .claude/skills/recipe-from-youtube/scripts/fetch-usda.mjs 169705
```

The per-locale companion files (`data/ingredients/<locale>/<id>.yaml`) stay
hand-authored — names, aisles, and availability are market judgment calls, not
fetchable data.

### API key

The script falls back to `DEMO_KEY` (rate-limited to ~30 req/hr). For real work
set a free, instant key:

```bash
export FDC_API_KEY=...   # PowerShell: $env:FDC_API_KEY = '...'
```

Sign up at https://fdc.nal.usda.gov/api-key-signup.html.

## Picking the right entry

- Prefer the **plain, raw, or unenriched** description that matches the recipe
  ("Oats" not "Cereals, oats, instant, fortified").
- Match the form used in cooking (e.g. "raw" vs "cooked") — nutrition differs.
- For brand-named ingredients in the transcript, map to the generic SR Legacy
  food (e.g. a specific yogurt brand → "Yogurt, plain, whole milk").

## One ingredient file, or several? (varieties)

Keep **one** ingredient YAML per **shopping-distinct product** (revised
2026-06-11; see recipe-model.md Q16). The test is the store shelf, not the
nutrition label: if a shopper following two recipes (or one recipe twice)
must put **two different bottles in the cart**, those are two ingredients —
even when their nutrition is identical — because the shopping list merges
rows by ingredient id and would otherwise collapse them into one wrong line.
Light vs dark soy sauce is the precedent: same SR Legacy family, different
bottle, different job (seasoning vs color), and one pot can need both.

Several cores may cite the **same SR Legacy `fdc_id`** (use the closest
generic entry for each); the build enforces that cores sharing an `fdc_id`
carry identical `per_100g` blocks, so the duplicated numbers can't drift.

When varieties are the *same* purchase steered by taste — olive oil "extra
light" vs "robust", rolled oats brands — keep ONE file and steer per recipe:

- Use the fill's `note`/`why` for recipe-specific steering (a deep-fry wants
  the high-smoke-point oil; a dressing wants the robust one).
- List variety names in the ingredient's `aliases` so shoppers recognize them.
- A wrong-form trap that holds in EVERY recipe (quick vs rolled oats) belongs
  in the locale file's `availability` important note, not duplicated per recipe.

Also split when varieties differ **materially in nutrition** with their own
SR Legacy entries (raw vs roasted nuts, whole vs nonfat milk).

## If no SR Legacy entry exists

Some modern/branded items simply aren't in SR Legacy (it was frozen in 2019).
Options, in order of preference:
1. Use the closest **generic** SR Legacy food that's nutritionally equivalent.
2. Drop the ingredient to optional, or omit it, if it can't be sourced.
Do **not** substitute Foundation/FNDDS/Branded data to fill the gap, and do not
hand-enter numbers from a package label.
