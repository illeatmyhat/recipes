---
name: recipe-from-youtube
description: Create a new recipe for this Astro recipe site from a YouTube cooking video (URL or pasted transcript). Writes a recipe (pattern/roles/fills, canonical-EN MDX + a sidecar catalog per locale: ja-JP and zh-CN) plus any missing ingredient YAML files (incl. per-locale overlays), sources nutrition from USDA SR Legacy, converts units to metric, and processes the hero image. Use when the user wants to add/create a recipe, turn a YouTube video or transcript into a recipe, or mentions importing a recipe from a video.
---

# Recipe from a YouTube transcript

Turns a cooking video into a fully-resolved recipe in this repo. Read
`CLAUDE.md` first for the data pipeline and
[docs/recipe-model.md](../../../docs/recipe-model.md) for the model this
authors against (pattern / roles / fills — it governs every choice below).

## Inputs you need

- The **transcript** (preferred: ask the user to paste it). If given only a
  URL, try to fetch captions with WebFetch; if that fails, transcribe locally
  with `scripts/transcribe.py` (yt-dlp audio grab + faster-whisper large-v3
  on GPU — seed `--prompt` with the dish's proper nouns; setup notes in the
  script header). Never invent steps.
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
   - **Fidelity and provenance (Q11, live).** Name the source:
     `source: { name: <attribution> }` in the frontmatter drives the
     provenance badge ("As taught by …" → "Your variation (based on …)"
     once the cook departs from the default point). A choice the source
     narrated ("you could use…", "thick or thin, up to you") is plain
     `provenance: source` (the default — omit the key). A choice YOU add
     from good cooking knowledge is allowed, but it must wear
     `provenance: editorial` (on the fill or knob) — it renders with an
     "our addition" mark, and **an editorial fill can never be
     `default: true`**: the default parameter point IS the source point,
     that's what makes the badge truthful. Anything not worth an
     interactive choice stays prose (`why`/`note`/tips). When nothing is a
     choice at all, author fixed: `min` = the fill count, no advisory
     `max`, no fabricated toggles.
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
   missing one, **generate the locale-neutral core with the fetch script**
   (`fetch-usda.mjs <fdcId> --write <id> [--density <g_per_ml>]` writes
   `data/ingredients/<id>.yaml` itself — don't transcribe nutrition blocks
   by hand) — **USDA SR Legacy only**, see
   [reference/sourcing.md](reference/sourcing.md) —
   **plus one locale file per supported locale**
   (`data/ingredients/<locale>/<id>.yaml`: `names`/`aliases`/`aisle`,
   optionally `availability`; shape documented in the template). Every
   supported locale needs its file with a name and an `aisle` (its OWN
   market's store geography — soy sauce: international in the US,
   condiments in JP/CN) or the build fails. An aisle is a **store +
   section** (Q15): a bare `aisle: <section>` is shorthand for the primary
   supermarket; the full form `aisle: { store: <store>, section: <section> }`
   files the errand under `online` (order-ahead, not on this market's
   shelves — pair with an important lead-time note) or `specialty` (the
   market's second stop). Store and section ids come from
   `STORE_IDS`/`SECTION_IDS` in `src/lib/types.ts` and are **validated at
   build** — a typo is a red build, not a missing row. An ingredient that
   is genuinely not bought (tap water) gets NO aisle in any locale
   (all-or-nothing across locales): it stays real in Cook and nutrition
   but never appears on the shopping list. `availability` is optional
   market guidance authored in that market's language (never translated);
   `important: true` notes pin to the Shop row — reserve them for scarcity
   and wrong-form warnings. Only fill `brands` when buyers commonly get the
   wrong form; don't invent brand names. Note texts and brands must be
   unique within a file (build-gated).

4. **Convert all amounts to metric** (`g`/`ml`; `ml` needs a non-null
   `density_g_per_ml`). See [reference/units.md](reference/units.md).

5. **Write the recipe MDX** from `templates/recipe.mdx` — canonical **EN
   only** in the frontmatter and method body (the JA goes in the catalog,
   step 6). Model rules that bite:

   - **Cardinality**: `min` is structural (below it the dish stops being the
     dish), `max` is advisory (exceeding warns, never blocks). A role whose
     `min` covers every fill renders as Base automatically (static, no
     toggles) — never author a "base" flag, and every fill of such a role
     **must** be `default: true` (schema-gated; corollary: an editorial
     fill can never sit in a zero-freedom role).
   - **Provenance**: `source: { name: … }` in the frontmatter;
     `provenance: editorial` on every fill/knob the source didn't narrate;
     editorial is never `default: true` (schema-gated — see step 1).
   - **Amounts by position**: role-level `amount` ⇒ substitutive (chosen
     fills partition it; a fill's own `amount` overrides its full-equivalent);
     fill-level amounts only ⇒ additive (each chosen fill adds its own).
   - **Method** is `<Step id title? when?>` / `<Ref of="role" fill?/>` inside
     `<ol class="steps">`. Guards use the grammar in `src/lib/recipe/guards.ts`
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
   string — `title`, `pattern`, `customize_title`, `source.name`, every
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
   `npm run build` whose output shows **no recipe lint warnings** for your recipe
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

- `templates/recipe.mdx` — recipe skeleton (frontmatter + Step/Ref method).
- `templates/recipe.locale.yaml` — per-locale catalog skeleton (one per catalog locale).
- `templates/ingredient.yaml` — ingredient DB entry (nutrition + aisle); pair
  with an overlay file per non-inline locale (see the template's footer note).
- `scripts/fetch-usda.mjs` — SR-Legacy-only nutrition lookup (search + by-id).
- `scripts/process-hero.mjs` — crop any photo to the 1280×720 16:9 hero.
- `scripts/transcribe.py` — local GPU transcription when captions fail
  (yt-dlp + faster-whisper large-v3; venv setup in the header).
- `reference/sourcing.md` — USDA SR Legacy rules + fetch script usage.
- `reference/units.md` — kitchen→metric conversions and densities.

Live reference implementations: `src/content/recipes/weight-loss-stew.mdx`
(constraints, bool+scalar knobs, water-sauté guarded steps),
`overnight-oats.mdx` (enum knob + scale, advisory max, additive multi-fill
roles, fill-scoped reality steps), `carbonara.mdx` (the provenance
showcase: `source:` + a certified anchor recipe, an all-editorial option
ladder with an editorial bool knob guarding rescue steps, substitutive
partition fills), and `dried-scallop-chicken-soup.mdx` (narrated-only
choices, water as a real aisle-less ingredient, order-ahead/specialty
aisle placements).
