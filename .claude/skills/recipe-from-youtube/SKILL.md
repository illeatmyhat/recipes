---
name: recipe-from-youtube
description: Create a new recipe for this Astro recipe site from a YouTube cooking video (URL or pasted transcript). Writes a v3 recipe (pattern/roles/fills, canonical-EN MDX + a sidecar catalog per locale: ja-JP and zh-CN) plus any missing ingredient YAML files (incl. per-locale overlays), sources nutrition from USDA SR Legacy, converts units to metric, and processes the hero image. Use when the user wants to add/create a recipe, turn a YouTube video or transcript into a recipe, or mentions importing a recipe from a video.
---

# Recipe from a YouTube transcript

Turns a cooking video into a fully-resolved **v3 recipe** in this repo. Read
`CLAUDE.md` first for the data pipeline and
[docs/recipe-model.md](../../../docs/recipe-model.md) for the model this
authors against (pattern / roles / fills — it governs every choice below).

## Inputs you need

- The **transcript** (preferred: ask the user to paste it). If given only a URL,
  try to fetch captions with WebFetch; if that fails, ask the user to paste it —
  don't invent steps.
- A **hero photo** (a source image file or a reusably-licensed URL, e.g.
  Unsplash). If none is offered, ask for one before the final build.

## Workflow

Work the checklist top to bottom. Paths are relative to the project root.

1. **Extract the model, not a list.** Transcripts are richer in *why* than in
   grams — cooks narrate causality constantly ("don't add the shrimp early, it
   turns rubbery"). Capture, deliberately:

   - **The pattern (required).** The recipe's *thesis* — why this combination
     works ("high volume, high fiber, enough protein, low calorie density").
     If the cook never states it, infer it from the dish; if you genuinely
     can't, the recipe may not have a teachable spine — say so rather than
     inventing one.
   - **Roles.** Each ingredient line is a role: a *job derived from the
     pattern*, with a required `why`. A narrated substitution ("you could use
     chicken instead of tofu") is a second **fill** of the same role. **If you
     cannot state why a role/knob/fill matters, you may not introduce it** —
     that's a quality filter, not bureaucracy.
   - **Knobs.** A narrated texture/style choice that adds no ingredient
     ("blend half for creaminess", "extra thick") is a knob (`bool` / `enum` /
     `scalar`) driving `scale` tables and step guards.
   - **Reality as explanation.** "Breast joins at the 20-minute mark
     **because** it dries out over a full simmer" — authored as a fill `note`
     or a guarded `<Step>`, fitted to *this* dish, never a generic caution.

2. **Pick a slug** (kebab-case). Files become
   `src/content/recipes/<slug>.mdx`, one `<slug>.<locale>.yaml` per catalog
   locale (`ja-JP`, `zh-CN` — see `CATALOG_LOCALES` in `src/lib/types.ts`),
   their machine-written `.hashes.yaml` sidecars, and
   `src/content/recipes/images/<slug>.jpg`.

3. **Resolve each ingredient.** For every fill, check whether
   `data/ingredients/<id>.yaml` already exists (reuse it if so). For each
   missing one, create it from `templates/ingredient.yaml` (inline
   en-US/ja-JP), sourcing nutrition via the fetch script — **USDA SR Legacy
   only**, see [reference/sourcing.md](reference/sourcing.md) — **plus one
   overlay file per remaining locale** (`data/ingredients/zh-CN/<id>.yaml`:
   `names`/`aliases`/`aisle`). Every supported locale needs a name and an
   `aisle` (its OWN market's store geography — soy sauce: international in
   the US, condiments in JP/CN) or the build fails. Only fill `brands` when
   buyers commonly get the wrong form; don't invent brand names.

4. **Convert all amounts to metric** (`g`/`ml`; `ml` needs a non-null
   `density_g_per_ml`). See [reference/units.md](reference/units.md).

5. **Write the recipe MDX** from `templates/recipe.mdx` — canonical **EN
   only** in the frontmatter and method body (the JA goes in the catalog,
   step 6). Model rules that bite:

   - **Cardinality**: `min` is structural (below it the dish stops being the
     dish), `max` is advisory (exceeding warns, never blocks). A role with
     `min ≥ 1` + one fill renders as Base automatically — never author a
     "base" flag.
   - **Amounts by position**: role-level `amount` ⇒ substitutive (chosen
     fills partition it; a fill's own `amount` overrides its full-equivalent);
     fill-level amounts only ⇒ additive (each chosen fill adds its own).
   - **Method** is `<Step id title? when?>` / `<Ref of="role" fill?/>` inside
     `<ol class="steps">`. Guards use the grammar in `src/lib/v3/guards.ts`
     (`has(role, 'fill')`, `count(role)`, knob names, `&&`/`||`/`!`,
     comparisons).
   - **Boundness (build error)**: a step reading a `min: 0` role must carry a
     `when` that proves it bound — a positive `has(role, '…')` conjunct, or
     `count(role) > 0` for the general case ("add the toppings", whatever was
     chosen, hidden when nothing is).
   - **To-taste amounts**: never zero, never amount-less. Author a realistic
     token amount and put "to taste" in the `note` — folding 0 would lie
     about sodium, the nutrient people actually check.
   - **Reach every ingredient**: the Cook stage buckets ingredients by the
     steps that read them, with **no catch-all** — a chosen fill read by no
     step silently vanishes from mise en place (and the build warns when a
     whole role is read by no step). Give fill-specific realities their own
     guarded step (`when="has(role, 'fill')"` + `<Ref of="role" fill="…"/>`).
   - **Aliases**: a fill whose DB name reads badly in prose (normalization
     lower-cases and strips parentheticals/comma-clauses — check what's left)
     gets an `alias`: a bare noun phrase, no article, no connective.

6. **Write one catalog per locale** (`<slug>.ja-JP.yaml`, `<slug>.zh-CN.yaml`)
   from `templates/recipe.locale.yaml`: one flat dotted key per localizable
   string — `title`, `pattern`, `customize_title`, every
   `roles.<r>.label/.why`, every authored fill `note`/`why`/`alias`, every
   knob `label`/`why`/`optionLabels.<v>`, every `constraints.<i>.warn/.error`,
   and per step `steps.<id>` (+ `steps.<id>.title`). Step templates are that
   locale's surface of the EN body: `{role}` / `{role:fill}` placeholders,
   placed where the language's grammar wants them (dropping a read EN needs
   is fine — the parity lint is a warning, not an error). Translate
   naturally, not literally; where local reality differs (market quirks), a
   locale's `note` may diverge from the canonical — catalogs are authored
   statements, not forced 1:1 translations. **Every localizable EN string
   needs its key in every declared locale — a missing key fails the build.**

7. **Process the hero image** (run from the project root):
   `node .claude/skills/recipe-from-youtube/scripts/process-hero.mjs <source> <slug>`
   Then add a credit line to `README.md` matching the existing hero credit.

8. **Generate the hashes sidecars**: `$env:REFRESH_CATALOG_HASHES='1'; npm run build`
   (bash: `REFRESH_CATALOG_HASHES=1 npm run build`). This writes one
   `<slug>.<locale>.hashes.yaml` per catalog — commit them; never edit by hand.

9. **Verify — the gate.** `npm run check` (must be **0/0/0**) and a plain
   `npm run build` whose output shows **no v3 lint warnings** for your recipe
   (read-set parity, stale/orphaned entries, roles read by no step). Missing
   catalog keys, boundness violations, and malformed placeholders fail the
   build outright. The recipe auto-appears on the index and at
   `/recipes/<slug>/`. Spot-check in the browser (see CLAUDE.md → Browser
   testing): default SSR point, knob behavior, guarded steps, and each
   locale's surface via the switcher.

## Hard rules (do not violate)

- Nutrition comes **exclusively from USDA SR Legacy** — the fetch script
  enforces this; never hand-enter package-label numbers or other FDC datasets.
- **Canonical EN + one sidecar catalog per locale** (`ja-JP`, `zh-CN`). No
  inline localized pairs in recipe frontmatter; an incomplete catalog or a
  missing ingredient overlay fails the build.
- **No role/knob/fill without a stateable `why`.**
- **Metric is the source of truth.** Never store tsp/tbsp/cups.
- All files are **LF**, no CRLF. TypeScript is strict, no `any`.

## Files in this skill

- `templates/recipe.mdx` — v3 recipe skeleton (frontmatter + Step/Ref method).
- `templates/recipe.locale.yaml` — per-locale catalog skeleton (one per catalog locale).
- `templates/ingredient.yaml` — ingredient DB entry (nutrition + aisle); pair
  with an overlay file per non-inline locale (see the template's footer note).
- `scripts/fetch-usda.mjs` — SR-Legacy-only nutrition lookup (search + by-id).
- `scripts/process-hero.mjs` — crop any photo to the 1280×720 16:9 hero.
- `reference/sourcing.md` — USDA SR Legacy rules + fetch script usage.
- `reference/units.md` — kitchen→metric conversions and densities.

Live reference implementations: `src/content/recipes/weight-loss-stew.mdx`
(constraints, bool+scalar knobs, water-sauté guarded steps) and
`overnight-oats.mdx` (enum knob + scale, advisory max, additive multi-fill
roles, fill-scoped reality steps).
