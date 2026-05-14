# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server
- `npm run build` — static build to `dist/`
- `npm run preview` — serve the production build (recipe URL: `http://localhost:4321/recipes/recipes/overnight-oats/`)
- `npm run check` — `astro check`. **This is the only verification gate** — there is no test suite. It must stay at 0 errors / 0 warnings / 0 hints.
- `node scripts/process-hero.mjs <source.jpg>` — one-off: crop a source photo to the 16:9 hero image.

TypeScript is strict and there is no `any` anywhere in `src/lib` — keep it that way.

## Architecture

A static **Astro 6 + MDX + Svelte 5** recipe site. Pages pre-render to plain HTML and stay fully readable with JS disabled; Svelte islands hydrate on scroll (`client:visible`) to add interactivity.

### Build-time data pipeline

The core idea is that **ingredient nutrition lives in a separate database and is merged into recipes at build time**:

- `data/ingredients/*.yaml` — one file per ingredient: per-100g nutrition + `density_g_per_ml` + bilingual names/aliases/availability.
- `src/content/recipes/*.mdx` — recipe frontmatter (ingredient refs, amounts, notes, warnings) + the method body. Frontmatter is validated by the Zod schema in `src/content.config.ts`.
- `src/lib/resolveRecipe.ts` — runs at build time only (touches the filesystem). Merges the ingredient DB with a recipe's frontmatter, scales each ingredient's nutrition from the per-100g basis to the recipe amount, and converts `ml` amounts to grams via density. Returns a fully typed `ResolvedRecipe` (`src/lib/types.ts`).
- `src/pages/recipes/[...slug].astro` enumerates the content collection and hands each `ResolvedRecipe` to `RecipePage.astro`.

**Metric (`g`/`ml`) is the single source of truth** for amounts and all nutrition math. `tsp`/`tbsp` rendering in `src/lib/units.ts` is a display-only approximate hint and never feeds back into data.

### Islands and shared state

`RecipePage.astro` is a static shell; the interactive parts are Svelte islands in `src/components/*.svelte` (`ServingsScaler`, `IngredientList`, `CustomizePanel`, `NutritionPanel`, `LocaleSwitcher`). They share mutable state — servings, ingredient selections, locale — through the writable stores in `RecipeStore.ts`, not props. `RecipeStore` ends up in a single shared build chunk, so the stores are true cross-island singletons (verified: every island bundle in `dist/_astro/` imports it from the same chunk). Static recipe data is still passed as props since it never changes.

Each island calls `initStore()` in `onMount` (idempotent — the first to hydrate wins) and uses a `mounted` flag so SSR renders the recipe's defaults and the store takes over only after hydration.

### Localization (EN/JA)

Two parallel systems, both driven by the `locale` store:

- **Islands** read UI strings reactively from `src/lib/i18n.ts` via `t(key, locale)`.
- **Static content** is emitted twice (`.lang-en` / `.lang-ja` siblings, see `Bilingual.astro` and the `.lang-*` rules in `global.css`); the `locale` store flips `<html data-locale>` so the right copy shows. This keeps content localized with JS disabled (defaults to EN).

## Hard rules

- **Nutrition data must come exclusively from the USDA SR Legacy dataset.** Foundation, FNDDS, and Branded entries are off-limits. (The README says "FoodData Central" loosely — SR Legacy is the actual constraint.)
- Commits: sign off with `-c commit.gpgsign=false` and end the message with the `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.
- All text files are LF (`.gitattributes` enforces it) — do not introduce CRLF.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` (`withastro/action`, Node 22) → GitHub Pages. The site is served under a `/recipes` base path (`astro.config.mjs`), so it lives at `https://illeatmyhat.github.io/recipes/`.
