# The SSG shape — engine vs. instance, and the template plan

The long-term goal (see `memory: oss-ssg-goal`) is to release this project as
an open-source recipe static-site generator. This document records the split
that decision implies and the migration path, so day-to-day work keeps the
boundary clean instead of discovering it later.

## The split: engine vs. instance

**Engine** — everything an adopting site runs but never edits:

- `src/lib/` — the v3 model, resolver, guards, i18n facades, lint suite
- `src/components/`, `src/layouts/`, `src/pages/` — rendering and islands
- `src/styles/global.css` — theme + locale CSS machinery
- `scripts/` — hero processing, USDA fetch

**Instance** — what makes a particular site *that* site:

| Piece | Where | Gate that protects it |
| --- | --- | --- |
| Locale set + canonical language | `site.config.ts` (repo root) | `Locale` union type-checks every per-locale record |
| Site UI strings | `src/locales/<tag>.yaml` | key-set completeness gate (build error) |
| Recipes | `src/content/recipes/*.mdx` + `<slug>.<tag>.yaml` sidecars | Zod schema; catalog completeness per declared locale |
| Ingredient DB | `data/ingredients/*.yaml` + `<tag>/` overlay folders | per-locale name/aisle completeness (build error) |
| Hero images | alongside the recipes | — |
| Site URL / base path | `astro.config.mjs` | — |
| Deploy | `.github/workflows/deploy.yml` | — |

`site.config.ts` is deliberately TypeScript, not YAML: `as const` turns the
locale tags into the `Locale` union, which is what makes `Localized` records
and the completeness gates exhaustive at *compile* time. A data-file config
would degrade `Locale` to `string` and move every guarantee to runtime.

Site-level catalogs are discovered from `src/locales/*.yaml` by filename
(`import.meta.glob` in `src/lib/i18n.ts`), and ingredient overlays from
`data/ingredients/<tag>/` — so adding a locale touches only `site.config.ts`
plus new data files, never engine code. The build errors are the checklist:
each names the missing file or key.

## Phase 1 (current): one repo, clean boundary

Nothing to do beyond discipline: instance edits stay in the table above;
engine code never names a locale tag, recipe slug, or ingredient id.

## Phase 2: GitHub template repository

The cheap, near-term release: mark the repo as a template, and an adopter
clicks "Use this template", then

1. edits `site.config.ts` (locales, canonical language),
2. replaces `src/locales/*.yaml`, the recipes, and `data/ingredients/`,
3. sets `site`/`base` in `astro.config.mjs`,
4. pushes — the Pages workflow deploys.

The example recipes double as living documentation (the README should say
so). Trade-off: engine updates arrive by merging upstream, which conflicts
with instance edits only if the boundary leaked — which is the discipline
phase 1 enforces. No packaging work, no API freeze.

## Phase 3 (eventual): an Astro integration

`@<scope>/astro-recipes` as an npm package: the engine moves into the
package, the instance stays in the adopter's repo, and `astro.config.mjs`
wires it up (locales as integration options, content via the standard
collections API).

The hard part is known: a published package cannot see the adopter's locale
set at its own compile time, so the type-level `Locale` union stops at the
package boundary — `Localized` becomes `Record<string, string>` internally
and the completeness gates (which already exist and already carry the real
safety) become the only enforcement. That is the price of phase 3, and why
phase 2 comes first: it ships the project without paying it.

Do not start phase 3 before there is a second real instance (our own site
counts as the first); a package API frozen against one consumer is guesswork.

## Known hard edges (tracked, not blockers)

- **`global.css` locale matrix** — the `.lang-*` show/hide rules enumerate
  locale pairs by hand; the only engine file a new locale currently touches.
  Fine at 3 locales (n×(n−1) hidden-rules); generate it from `LOCALES` at
  build if the set grows or at phase-2 release.
- **`availability` / Q9** — per-market sourcing data still has the legacy
  `us`/`ja` shape; restructures to per-locale market content together with
  the Shop-stage surface (issue #6, Q9).
- **Astro's own i18n routing** — per-locale URLs (`/ja/...`) would replace
  the `data-locale` CSS flip if page weight or SEO demands it; re-measured
  2026-06 and deliberately not adopted (~9–17 KB HTML per locale per page is
  acceptable, and one URL per recipe keeps sharing simple).
