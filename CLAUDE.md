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

A recipe is a *pattern* (the dish's thesis) instantiated by *roles* (jobs, each with a required `why`), filled by *ingredients* — see `docs/recipe-model.md` (the governing design; its version marker lives in `src/lib/recipe/types.ts`). **Ingredient nutrition lives in a separate database and is merged into recipes at build time**:

- **Locales are BCP-47 tags** — `en-US` (canonical) / `ja-JP` / `zh-CN`, configured in **`site.config.ts` at the repo root** (the single instance-config file; `src/lib/types.ts` re-exports it as `LOCALES`/`CANONICAL_LOCALE`/`CATALOG_LOCALES`) — route locale assumptions through those constants, never literals (the long-term goal is an open-source SSG whose adopters may pick other locales and another canonical language; the engine/instance split and template plan live in `docs/ssg-template.md`).
- `data/ingredients/*.yaml` — one file per ingredient: per-100g nutrition + `density_g_per_ml` + inline en-US/ja-JP names/aliases + per-locale `aisle`. Other locales are **overlay folders** mirroring the filenames (`data/ingredients/zh-CN/<id>.yaml`: names/aliases/aisle), merged at load; every supported locale needs a name + aisle or the build fails.
- `src/content/recipes/<slug>.mdx` — canonical-locale frontmatter (pattern/servings/knobs/roles/constraints, validated by the Zod schema in `src/content.config.ts`) + the method body as `<Step id when? title?>` / `<Ref of fill?/>` components. Each catalog locale lives in a flat sidecar `<slug>.<locale>.yaml` (dotted keys + `steps.<id>` templates) with a machine-written `<slug>.<locale>.hashes.yaml` for the staleness lint (refresh: `$env:REFRESH_CATALOG_HASHES='1'; npm run build`). A recipe declaring a locale owes it a complete catalog — missing keys fail the build.
- `src/lib/recipe/` — the engine. `bundle.ts` builds a serializable `RecipeBundle` (hydrated recipe + ingredient data + defaults + extracted step metadata) at build time; `resolve.ts` is the pure order-independent resolver shared by SSR and the islands; `guards.ts` the step/constraint expression language; `i18n.ts`/`staleness.ts`/`steps.ts`/`Step.astro` carry the build-time lint suite (catalog completeness = build **error** for declared locales; read-set parity, staleness, orphans, role-read-by-no-step = warnings; boundness = error).
- `src/pages/recipes/[...slug].astro` enumerates the content collection and hands each bundle to `RecipePage.astro`.

**Metric (`g`/`ml`) is the single source of truth** for amounts and all nutrition math (`ml` → grams via density at resolve time).

### Islands and shared state

`RecipePage.astro` is a static shell (title, pattern, hero); everything interactive is the single `RecipeApp.svelte` island, which takes the bundle as its **one serialized prop** (Astro serializes island props into the page HTML, so one island ⇒ one ~34 KB copy instead of five) and the server-rendered method (the MDX body) as its slot. Inside it, `ServingsScaler`, `TabBar`, `Customize`, `Shop`, `Cook`, `NutritionPanel`, and the prop-less `MethodController` are plain Svelte children. State is shared through stores, not props: `RecipeStore.ts` (params, resolved output, stage tab) and `LocaleStore.ts` (locale only — also used by the index's `LocaleSwitcher`/`ThemeToggle` islands). Both land in shared build chunks, so the stores are true cross-island singletons.

Each bundle-holding component calls `initRecipe(bundle)` (or `initLocale()` for locale-only islands) in `onMount` — idempotent, the first to mount wins — and uses a `mounted` flag so SSR renders the recipe's defaults and the store takes over only after hydration.

### Document-level UI state: theme, locale, stage

Three concerns are reflected onto `<html>` attributes so CSS can drive them: `data-theme` (dark mode), `data-locale` (a BCP-47 tag), `data-stage` (the Customize/Shop/Cook stage tabs). `data-theme` and `data-locale` are resolved **before first paint** by `is:inline` scripts in `RecipeLayout.astro` (stored choice → system/browser → default) to avoid a flash; the matching island then mirrors that attribute into its store. Theme and locale persist to `localStorage` and sync across open tabs via the `storage` event. The shared `SiteControls.astro` bundles `ThemeToggle` + `LocaleSwitcher` for both the recipe pages and the index.

### Localization (en-US / ja-JP / zh-CN)

Three systems, all driven by the `locale` store:

- **UI chrome** lives in per-locale site catalogs `src/locales/<locale>.yaml` (flat dotted keys: `ui.*`, `nutrients.*`, `sections.*`); `src/lib/i18n.ts` is a typed facade over them (`t(key, locale)`) whose completeness gate fails the build on any key-set drift.
- **Recipe content** is canonical-locale text in the MDX, hydrated with each per-recipe locale catalog at build time into `Localized` (`Record<Locale, string>`) values the islands render by locale.
- **Static prose** (tips, method surfaces) is emitted once per locale (`.lang-<locale>` siblings, see `LocaleText.astro` and the `.lang-*` rules in `global.css`); the `locale` store flips `<html data-locale>` so the right copy shows. This keeps content localized with JS disabled (defaults to the canonical locale). Cost: ~9–17 KB HTML per extra locale per page.

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
