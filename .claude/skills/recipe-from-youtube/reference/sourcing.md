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

# 2. Print the ready-to-paste YAML block for the chosen entry:
node .claude/skills/recipe-from-youtube/scripts/fetch-usda.mjs 169705
#    -> fdc_id: 169705 + nutrition.per_100g: {...}  → paste into the YAML template.
```

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

## If no SR Legacy entry exists

Some modern/branded items simply aren't in SR Legacy (it was frozen in 2019).
Options, in order of preference:
1. Use the closest **generic** SR Legacy food that's nutritionally equivalent.
2. Drop the ingredient to optional, or omit it, if it can't be sourced.
Do **not** substitute Foundation/FNDDS/Branded data to fill the gap, and do not
hand-enter numbers from a package label.
