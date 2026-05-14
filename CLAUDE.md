# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Astro dev server with hot module reload. Run it **once** and leave it up; edits reflect live with no rebuild. Port 4321 is often already taken, so it usually lands on 4322 — check the startup output. Recipe URL: `http://localhost:<port>/recipes/recipes/overnight-oats/`.
- `npm run build` — static build to `dist/`.
- `npm run preview` — serve the built `dist/`. **No** hot reload (it serves the last build), so it's only worth running for things that need the production output: Lighthouse scores, inspecting build chunks.
- `npm run check` — `astro check` (type-checking).
- `node scripts/process-hero.mjs <source.jpg>` — one-off: crop a source photo to the 16:9 hero image.

**Local workflow:** keep a single `npm run dev` running and let HMR handle edits — don't start a second dev/preview server (starting extra servers is what causes "port creep"). Before committing, run `npm run check` **and** `npm run build`: together they are the verification gate — there is no test suite, so `check` must stay at 0 errors / 0 warnings / 0 hints and the build must succeed.

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

`RecipePage.astro` is a static shell; the interactive parts are Svelte islands in `src/components/*.svelte` (`ServingsScaler`, `IngredientList`, `NutritionPanel`, `LocaleSwitcher`, `ThemeToggle`, `TabBar`, plus `CustomizePanel` which is `client:idle` because it starts inside a `display:none` tab). They share mutable state — servings, ingredient selections, locale — through the writable stores in `RecipeStore.ts`, not props. `RecipeStore` ends up in a single shared build chunk, so the stores are true cross-island singletons (verified: every island bundle in `dist/_astro/` imports it from the same chunk). Static recipe data is still passed as props since it never changes.

Each island calls `initStore()` (or `initLocale()` for locale-only islands) in `onMount` — idempotent, the first to hydrate wins — and uses a `mounted` flag so SSR renders the recipe's defaults and the store takes over only after hydration.

### Document-level UI state: theme, locale, tabs

Three concerns are reflected onto `<html>` attributes so CSS can drive them: `data-theme` (dark mode), `data-locale` (EN/JA), `data-tab` (Recipe/Customize tab). `data-theme` and `data-locale` are resolved **before first paint** by `is:inline` scripts in `RecipeLayout.astro` (stored choice → system/browser → default) to avoid a flash; the matching island then mirrors that attribute into its store. Theme and locale persist to `localStorage` and sync across open tabs via the `storage` event. The shared `SiteControls.astro` bundles `ThemeToggle` + `LocaleSwitcher` for both the recipe pages and the index.

### Localization (EN/JA)

Two parallel systems, both driven by the `locale` store:

- **Islands** read UI strings reactively from `src/lib/i18n.ts` via `t(key, locale)`.
- **Static content** is emitted twice (`.lang-en` / `.lang-ja` siblings, see `Bilingual.astro` and the `.lang-*` rules in `global.css`); the `locale` store flips `<html data-locale>` so the right copy shows. This keeps content localized with JS disabled (defaults to EN).

## Browser testing (Chrome)

There is no browser on `PATH` in this environment — not even Edge. A standalone
Chromium is installed at `chrome/` (gitignored); install or refresh it with
`npx @puppeteer/browsers install chrome@stable`. That command prints the exact
`chrome.exe` path — reference it as `$CH` below.

**Lighthouse** — `CHROME_PATH=$CH npx lighthouse <url> --preset=desktop --chrome-flags="--headless --no-sandbox" --output=json --output-path=./lh.json`. The report is written fine; an `EPERM` error on temp-dir cleanup afterward is harmless — ignore it. Parse scores from the JSON. Target is ≥ 90 in every category (currently 100s). `lh-*.json` is gitignored.

**Screenshots** — `"$CH" --headless --no-sandbox --disable-gpu --hide-scrollbars --window-size=W,H --screenshot=<out.png> <url>`:
- The capture is only as tall as the window — set `--window-size` height tall enough for the whole page.
- Headless Chrome 148 defaults to `prefers-color-scheme: dark`. Force it with `--blink-settings=preferredColorScheme=0` (dark) or `=1` (light).
- Add `--force-device-scale-factor=2` for legible text, then crop regions with `sharp` (already a dependency) — there is no other image tool.

**Interactive checks (CDP)** — for clicking/toggling, launch Chrome with `--remote-debugging-port=9222` and drive it from a Node script (Node 22+ has a built-in `WebSocket`). Create a tab with `PUT /json/new?<url>` (a GET is rejected), connect to its `webSocketDebuggerUrl`, then use `Runtime.evaluate` and `Page.captureScreenshot`. This is how tab switching, locale persistence, and cross-tab `storage` sync were verified. Note: `client:visible` islands need a few seconds and may need the element scrolled into view before they hydrate.

**Path note** — in the Bash tool `/tmp/...` resolves to `C:\Users\...\AppData\Local\Temp\...`. When a path crosses into Node or `sharp`, pass the absolute Windows path the tool printed, not `/tmp/...`.

Reuse one debugging Chrome across a work session rather than relaunching it per check — keeping it alive (alongside the single dev server) avoids relaunch overhead. Clean both up by port when the work is done.

## Hard rules

- **Nutrition data must come exclusively from the USDA SR Legacy dataset.** Foundation, FNDDS, and Branded entries are off-limits. (The README says "FoodData Central" loosely — SR Legacy is the actual constraint.)
- All text files are LF (`.gitattributes` enforces it) — do not introduce CRLF.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` (`withastro/action`, Node 22) → GitHub Pages. The site is served under a `/recipes` base path (`astro.config.mjs`), so it lives at `https://illeatmyhat.github.io/recipes/`.
