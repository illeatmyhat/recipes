---
name: recipe-from-youtube
description: Create a new recipe for this Astro recipe site from a YouTube cooking video (URL or pasted transcript). Writes a bilingual EN/JA recipe MDX plus any missing ingredient YAML files, sources nutrition from USDA SR Legacy, converts units to metric, and processes the hero image. Use when the user wants to add/create a recipe, turn a YouTube video or transcript into a recipe, or mentions importing a recipe from a video.
---

# Recipe from a YouTube transcript

Turns a cooking video into a fully-resolved recipe in this repo. Read
`CLAUDE.md` first for the data pipeline; this skill operates within it.

## Inputs you need

- The **transcript** (preferred: ask the user to paste it). If given only a URL,
  try to fetch captions with WebFetch; if that fails, ask the user to paste it —
  don't invent steps.
- A **hero photo** (a source image file or a reusably-licensed URL, e.g.
  Unsplash). If none is offered, ask for one before the final build.

## Workflow

Work the checklist top to bottom. Paths are relative to the project root.

1. **Extract the recipe** from the transcript: title; servings/yield; the
   ingredient list with amounts; the method as discrete steps; any tips and
   "do / don't" warnings. Group ingredients into **base** (always used) vs
   **optional** categories (e.g. Toppings, Fruits) the way the cook frames them.
2. **Pick a slug** (kebab-case). Files become `src/content/recipes/<slug>.mdx`
   and `src/content/recipes/images/<slug>.jpg`.
3. **Resolve each ingredient.** For every ingredient, check whether
   `data/ingredients/<id>.yaml` already exists (reuse it if so). For each
   missing one, create it from `templates/ingredient.yaml`, sourcing nutrition
   via the fetch script — **USDA SR Legacy only**. See
   [reference/sourcing.md](reference/sourcing.md).
4. **Convert all amounts to metric** (`g`/`ml`). Use `g` for solids, `ml` only
   for liquids (which then need a non-null `density_g_per_ml`). See
   [reference/units.md](reference/units.md).
5. **Write the recipe MDX** from `templates/recipe.mdx`. Every human string is
   bilingual `{ en, ja }` — title, notes, warnings, category labels, AND the
   method body (parallel `.lang-en` / `.lang-ja` `<div>`s, steps in
   `<ol class="steps">`). Translate the JA yourself; keep it natural, not literal.
6. **Process the hero image** (run from the project root):
   `node .claude/skills/recipe-from-youtube/scripts/process-hero.mjs <source> <slug>`
   Then add a credit line to `README.md` matching the existing hero credit.
7. **Verify — the gate.** Run `npm run check` (must be **0 errors / 0 warnings /
   0 hints**) and `npm run build` (must succeed). Fix anything before finishing.
   The recipe auto-appears on the index and at `/recipes/<slug>/`; no manual
   registration. Optionally view it at `npm run dev` → `/recipes/<slug>/`.

## Hard rules (do not violate)

- Nutrition comes **exclusively from USDA SR Legacy** — the fetch script
  enforces this; never hand-enter package-label numbers or other FDC datasets.
- **Everything bilingual EN/JA.** No English-only strings reach the frontmatter
  or method body.
- **Metric is the source of truth.** Never store tsp/tbsp/cups; the UI derives
  the kitchen hint from grams.
- All files are **LF**, no CRLF. TypeScript is strict, no `any`.

## Files in this skill

- `templates/recipe.mdx`, `templates/ingredient.yaml` — copy and fill in.
- `scripts/fetch-usda.mjs` — SR-Legacy-only nutrition lookup (search + by-id).
- `scripts/process-hero.mjs` — crop any photo to the 1280×720 16:9 hero.
- `reference/sourcing.md` — USDA SR Legacy rules + fetch script usage.
- `reference/units.md` — kitchen→metric conversions and densities.
