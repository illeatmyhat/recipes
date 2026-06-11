# Recipe model v3 — pattern, roles, fills

**Status:** implemented and live — all recipes are v3 and the v1 code path
is removed (2026-06-10). Supersedes the v2 param-centric model after the
2026-06-10 design session re-grounded the project's purpose. Decisions and
rationale from that session are inline; remaining forks are in *Open
questions*. A second design session (2026-06-11, after the first import
stress-tested the pipeline) added questions 11–16 — fidelity/provenance of
choices, intermediates, graph-evaluated nutrition, step apportionment, the
shopping store dimension. This document remains the governing design.

## Purpose (this governs everything)

The site looks like a recipe site, but it is a **teaching tool**: it teaches
the *thought process behind how a recipe is constructed* — what makes the food
"work", and the nutritional consequences of each choice. It is **not a
textbook**: there is no principle ontology, no concept taxonomy, no lessons.
Recipes teach through their *structure*: every element carries its reasoning,
and the reasoning is what makes substitution — the reader's own critical
thinking — safe and legible.

Nutrition is one facet of that teaching and is already covered by the
Nutrition Facts panel (state + per-ingredient breakdown bars). A
"delta/changed-by-your-choice" feature was considered and **dropped** as
unnecessary (2026-06-10).

## The model in one paragraph

> A recipe is a **pattern** (a thesis about why this combination works)
> **instantiated by roles** (the jobs the pattern needs done), each **filled by
> ingredients** (concrete, USDA-backed, gram-weighted), **subject to reality**
> (the physical behavior that stops naive 1:1 swaps).

- **Pattern** — e.g. *"high volume, high fiber, enough protein, low calorie
  density"*. The only element of a recipe that is truly **required**. Every
  substitution is judged against it: a swap that preserves the pattern
  preserves the dish.
- **Role** — a job, with criteria **derived from the pattern**, not from
  culinary category. Pork belly is "a protein" but fails the stew's *lean*
  protein role, because the pattern (satiety per calorie) is what defines the
  role. Stating this derivation is the pedagogy.
- **Fill** — an ingredient doing a job. Fills are worked examples of their
  role; none is sacred.
- **Reality** — "chicken breast dries out when over-simmered." Not a warning;
  a **pedagogical explanation of why the recipe is the way it is**, surfaced
  exactly where the recipe deviates because of it.

### The program metaphor, completed

v2 said "a recipe is a program, ingredients are variables." v3 adds the part
that makes it teach: **roles are the types, ingredients are the values, and
the pattern is the spec the types are derived from.** A program whose
variables are all of type `any` teaches nothing; the types are the pedagogy.
Substitution is providing a different value of the same type; reality notes
are the type's operational quirks ("chicken_breast implements LeanProtein,
but with timing requirements").

The v2 principle survives with one amendment:

> **Declare each *use* once, reference many.** References never own quantity.
> The same food may back multiple declarations (salt in the dough and salt on
> the crust are two roles sharing a fill) — identity belongs to the **role
> declaration**, not the ingredient.

## Invariants (carried over, amended where noted)

1. **Metric grams are the source of truth**; `ml` → grams via density before
   any nutrition math; `tsp`/`tbsp` remain display-only hints.
2. **Nutrition exclusively from USDA SR Legacy**, per-100g in the ingredient DB.
3. **Everything human-facing is localizable** — *amended*: localized content
   lives in **per-locale message catalogs** keyed by stable IDs, with one
   canonical source language in the recipe file itself. (Previously: inline
   `{ en, ja }` pairs — see *Localization*.) Locales are **BCP-47 tags**
   (`en-US` / `ja-JP` / `zh-CN` today), region-qualified on purpose: a locale
   covers language AND market (store geography). The locale set and the
   canonical language are *instance configuration*
   (`LOCALES`/`CANONICAL_LOCALE` in `src/lib/types.ts`) — an adopting site of
   the future open-source SSG may choose different ones.
4. **The default parameter point renders statically** — JS-off readable.
5. **`servings` is just the first scalar parameter.**
6. **Resolution is order-independent** — a function of the final `Params`
   record, never a fold of mutations.

---

## Schema

### Ingredient DB (one file per id) — facts only, unchanged in spirit

```ts
interface Ingredient {
  id: string;                          // == filename
  fdc_id: number;                      // USDA SR Legacy only
  names: Localized;                    // catalog-backed; see Localization
  aliases: Record<Locale, string[]>;
  nutrition: { per_100g: NutritionFacts };
  density_g_per_ml: number | null;     // required iff ever used with `ml`
  aisle: Record<Locale, StoreSection>; // per-locale store section; see "Aisle is locale-specific"
}
```

The DB holds **only invariant facts about a food**. Behavioral knowledge
("dries out when over-simmered") deliberately does **not** live here — it was
considered and rejected (2026-06-10) because auto-surfacing DB-level notes
floods recipes with irrelevant cautions. Relevance is a property of the
*recipe* (does this fact explain why this dish is built this way?), so the
knowledge is authored per-recipe, attached to the fill or step it explains,
fitted to context. The generating skill is the de-duplicator across recipes:
it knows the fact and re-states it fitted to each dish.

### Recipe

```ts
interface Recipe {
  title: string;                       // canonical (EN); translations in catalog
  slug: string;
  hero_image: string;
  locales: Locale[];                   // declared targets; build enforces catalog completeness
  pattern: string;                     // REQUIRED. The thesis. Canonical text.
  servings: { min: number; max: number; default: number };
  knobs?: Record<string, Knob>;        // cross-role parameters (enum/bool/scalar)
  roles: Record<string, Role>;         // the spine of the recipe
  constraints?: Constraint[];
  // intro / tips / method prose live in the MDX body (canonical language).
}
```

### Roles — the universal unit

Every ingredient line is a role. v2's three primitives collapse into this one:

| v2 primitive | v3 equivalent |
| --- | --- |
| `FixedUse` (plain ingredient) | role, `min: 1, max: 1`, one fill |
| `SlotParam` ("pick one liquid") | role, `min: 1, max: 1`, several fills |
| `MultiSelectParam` (toppings) | role, `min: 0`, additive fills |
| *(inexpressible)* "salt is one of several seasonings" | role, `min: 1, max: 3` |

```ts
interface Role {
  why: string;                         // REQUIRED. The job, derived from the pattern.
  range: { min: number; max?: number }; // min is STRUCTURAL, max is ADVISORY
  amount?: Amount;                     // present => substitutive (fills partition it)
  proportionalTo?: string;             // scalar knob; default 'servings'
  fixed?: boolean;                     // true => ignore servings scaling
  scale?: Record<string, number>;      // "<knob>.<value>" -> multiplier (inspectable, no arithmetic)
  fills: Fill[];
}

interface Fill {
  id: string;                          // ingredient id in the DB
  amount?: Amount;                     // additive role: own amount. substitutive role: full-equivalent override.
  default?: boolean;
  why?: string;                        // why it fits / what to know when choosing it (canonical text)
  note?: string;                       // recipe-specific handling ("add at the 20-minute mark")
  alias?: string;                      // recipe-specific PROSE name for in-sentence use; see "Names in prose"
}
```

**Required `why`.** Every role must state its job; a fill carries a `why`
whenever choosing it involves knowledge ("leanest meat option — but breast
dries out over a full simmer; it joins late, see the method"). Rule for the
generating skill: **if you cannot state why a role/knob matters, you may not
introduce it.** This is a quality filter, not bureaucracy — an ingredient
whose job cannot be named is an argument for removing the ingredient.

**Cardinality.** `min` is structural: it decides whether the role can be
unbound (steps reading a `min: 0` role need guards) and whether SSR's default
point includes it; below `min` the dish stops being the dish (bread without
its flour). `max` is advisory: "1–3 seasonings" renders as guidance, exceeding
it warns, never blocks — consistent with the constraint philosophy below.

**Base is derived, never authored:** a role is *base* iff `min ≥ 1` **and**
it has exactly one fill ("required, and no alternative known yet"). Adding a
second fill later automatically un-bases it. The derivation converts the vibe
"is this core?" into the falsifiable question **"does the dish survive its
absence?"** — lentils: no (broth doesn't thicken, protein floor collapses) →
base; olive oil: yes (water-sauté works) → `min: 0`, not base.

**Amount semantics are declared by position** (no mode flag):

- **Role-level `amount` ⇒ substitutive.** The *pattern* owns the quantity
  (the stew wants ~400 g of lean protein however many kinds you pick). Chosen
  fills partition the role **in fraction space**: each chosen fill contributes
  `(1/k) × its own full-equivalent amount` (a fill's `amount` overrides the
  role's as its full-equivalent — tofu 396 g ≡ chicken 250 g). Equal split
  among k chosen fills; author-tunable proportions deferred until a real
  recipe demands them.
- **Fill-level amounts only ⇒ additive.** Each chosen fill brings its own
  amount on top (toppings +15 g each; salt 2 g + cumin 2 g — you don't split a
  "seasoning budget"). Choosing more makes the dish bigger.

Awkward real-world quantities from partitioning ("125 g chicken = ⅔ of a
breast") are accepted; where they'd grate, the author makes that role additive
case-by-case. Display rounding is Open question #4.

**Same ingredient, multiple purposes.** Two roles may share a fill id (dough
salt / crust salt). Identity is the **role**; consequences:

- nutrition fold: already correct — it sums declarations, not unique ids;
- references (`{...}` in steps) target **role names**, which are unique per
  recipe, never ingredient ids;
- projections choose merge-or-not per axis: the **shopping list merges by
  ingredient id** (one line: salt 7 g); the role and step views keep
  declarations separate (the purpose distinction *is* the teaching);
- implementation note: shipped code keys some maps by ingredient id
  (`NutritionPanel.svelte` colour map) — those assumptions must be flushed.

Boundary with split-across-steps: **two purposes = two roles; one purpose
staged = one role with display-only portion hints** ("half the butter now,
half later" — hints partition the canonical total, never add grams). The test
is whether the *why* differs.

### Knobs — the surviving v2 params

`enum` / `bool` / `scalar` parameters that don't add ingredients but drive
amounts (via `scale` tables) and conditional steps. `servings` is the
canonical scalar. Example: overnight-oats `thickness` (enum classic/extra)
scaling chia ×1.5 and liquid ×0.8. Each knob requires a `why`, same rule as
roles. `scale` stays a declarative table — inspectable, renderable ("Extra
thick: chia ×1.5"), no arithmetic.

### Constraints — annotate, don't forbid

```ts
interface Constraint {
  when: string;                        // boolean expression over Params
  warn?: string;                       // soft: a caution (canonical text)
  error?: string;                      // hard: combination disallowed in the UI
}
```

The parameter space should be total where feasible, explicitly constrained
where not. Advisory `max` violations surface through the same warning channel.

### Guard expression grammar (unchanged from v2)

```
expr  := or
or    := and ('||' and)*
and   := cmp ('&&' cmp)*
cmp   := unary (('==' | '!=' | '<' | '>' | '<=' | '>=') unary)?
unary := '!' unary | atom
atom  := roleOrKnob | literal | 'has(' role ',' string ')'
       | 'count(' role ')' | '(' expr ')'
```

`has(protein, 'chicken_breast')` tests fill membership; `count(toppings)` is
the selection's size (added 2026-06-10 so a step can read an optional
multi-fill role generally — `when="count(toppings) > 0"`); `liquid == oat_milk`
is sugar for `has()` on a `min:1,max:1` role.

---

## Method — canonical prose in the body

The method lives in the MDX body (re-confirmed 2026-06-10 against a
frontmatter-YAML alternative): authors need free prose, images mid-method,
and room for creative flexing. What changed is that the body is now written
**once, in the canonical language** — the catalog architecture (below)
removed the parallel-language nesting that made v2's markup XML-dense:

```mdx
<Step id="season">
  Add the <Ref of="seasonings"/> and let them cook a few minutes — the soy
  sauce builds the slow-cooked flavor.
</Step>

<Step id="hold_chicken" when="has(protein, 'chicken_breast')">
  Hold the <Ref of="protein"/> back — breast dries out over a full simmer.
  Stir it in at the 20-minute mark; it cooks through in the last 10.
</Step>

![the pot at the 20-minute mark](./images/stew-simmer.jpg)
```

- `<Step id when?>` — `id` is required (stable key for catalogs and the step
  projection); `when` guards visibility.
- `<Ref of="role"/>` — reads a **role**; renders all currently-chosen fills as
  a localized list join ("tofu and chicken" / 「豆腐と鶏むね肉」). References
  never own quantity.
- `<Ref of="role" fill="chicken_breast"/>` — reads **one named fill** of a
  role; renders just that fill's name. This exists because a fill-specific
  reality step ("hold the chicken back") is scoped by its guard to one fill,
  and a whole-role ref would wrongly name the others too ("hold the *tofu and
  chicken* back" — tofu can simmer fine). The model already carries which fill
  the step is about (the guard says so); the fill scope on the ref just lets
  the prose match. Validated by the prototype (the bug it caught).
- SSR renders the default parameter point (`data-when` / `data-ref` annotated
  HTML); one `MethodController` island re-evaluates guards and patches refs on
  param change, mirroring the `data-theme`/`data-locale` pattern. The guard
  parser is one pure function shared by SSR and the island.

**Boundness rule (simplified):** a step reading a `min: 0` role must carry a
`when` that names it **positively** (`has(role, …)` or `count(role) > 0` not
under negation). Roles with `min ≥ 1` and all knobs are always bound and read
freely. Note: this is *not* a token-presence check — `!has(...)` contains the
token and proves the opposite — the checker evaluates polarity, which is
trivial over this small grammar.

**Names in prose (a rendering finding from the prototype).** The catalog/DB
name is a *canonical* name, not a *sentence* name: USDA names are Title-Cased
and some carry internal commas ("Salt, table"). Interpolated into a step they
read wrong ("Chop the Onion") and, worse, an internal comma collides with the
list-join separator ("…cumin, and Salt, table and cook"). So the name used **in
prose** is resolved separately from the canonical name:

1. a fill may carry a recipe-specific `alias` (e.g. `salt` → "salt", `tofu` →
   "the tofu"); else
2. fall back to a prose-normalized DB name (lower-cased, comma-stripped).

The two tiers divide by *judgment needed*: normalization handles the mechanical
cases for free ("Salt, table" → "salt"), but cannot distil
"Kiwifruit (kiwi), green, peeled, raw" → "peeled kiwis" — that needs a human,
which is what the `alias` is for.

The `alias` is a **bare noun phrase** — no leading article and no trailing
connective. Surrounding grammar belongs to the step template, not the name: the
template writes "the {greens}" or "{protein:chicken_breast} back", so an alias
of "the tofu" would double the article. Good aliases: "salt", "peeled kiwis",
"olive oil". Bad: "the tofu" (article is the template's), "and walnuts"
(connective is the join's).

This `alias` is the recipe-local prose form; it is catalog-localized like any
other text. (Ingredient-view and shopping-list still show the canonical name —
only step prose uses the alias.)

**Empty fill lists in joins (defense in depth).** A `<Ref of="role"/>` whose
selection is empty must render nothing *and* the surrounding connective must
not dangle ("Stir in the lentils and ."). In practice the UI blocks the only
states that cause this (an under-filled `min ≥ 1` role is invalid), but the
join helper still defends: an empty list collapses the clause rather than
emitting a bare "and"/と. (Prototype finding #3.)

**Step data shape (derived, not authored):**

```ts
interface Step {
  id: string;
  when?: string;
  reads: string[];                     // role names its <Ref>s / placeholders resolve
}
```

---

## Localization — message catalogs (decided 2026-06-10)

Inline `{ en, ja }` pairs do not scale (every leaf and the entire method body
duplicate per locale; adding a language means editing every file) and were
replaced with the standard i18n architecture:

1. **Source content exists once, in the canonical language (EN)** — frontmatter
   text fields and the MDX body, with stable IDs (`<Step id>`, role/fill keys).
2. **Translations live in per-locale sidecar catalogs**, e.g.
   `weight-loss-stew.ja.yaml`, keyed by stable paths:

```yaml
title: "満腹ダイエットシチュー"
pattern: "高ボリューム・高食物繊維・十分なタンパク質・低カロリー密度。…"
roles.protein.why: "満腹感にはタンパク質が必要。ただしパターン上は低脂肪であること…"
roles.protein.fills.chicken_breast.why: "最も脂肪の少ない肉。ただし煮込みすぎるとパサつく…"
steps.season: "{seasonings}を加えて数分煮る。しょうゆが旨味を出す。"
steps.hold_chicken: "{protein}は後入れ。20分経過時に加え、最後の10分で火を通す。"
```

3. **All templates share one variable namespace** (ICU-MessageFormat-style
   `{role}` placeholders). A step is one statement with N surface templates;
   each language places each read where its grammar wants it.

Build-time checks:

- **Completeness is an error** (implemented 2026-06-10): every key present in
  every locale the recipe declares; an untranslated string blocks deploy
  rather than silently shipping English. An EN-only recipe (locales without
  `ja`) skips the gate.
- **Read-set parity is a warning, not an error**: Japanese legitimately drops
  arguments English requires (「混ぜて一晩冷蔵する」 needn't re-mention the
  liquid). The lint flags asymmetric reads for review; it does not block.
- **Staleness via source-hash** (the gettext "fuzzy" mechanism): each catalog
  entry stores a hash of the source string it translated; source changed ⇒
  entry flagged stale. Stays a warning — it needs human review by design.

**Ingredient-DB localization (decided 2026-06-10, revised same day):
neutral core + per-locale folders.** The core file
(`data/ingredients/<id>.yaml`) is a **library asset, unbiased toward any
culture**: id, FDC id, per-100g nutrition, density — and nothing
locale-specific, the canonical locale included. (The first cut kept
`en-US`/`ja-JP` inline with other locales as overlays; revised because an
inline privilege for some locales contradicts the SSG goal — every locale
is now an equal citizen.) Each supported locale owns
`data/ingredients/<locale>/<id>.yaml` with that locale's `names`,
`aliases`, `aisle`, and optional `availability` — assembled at load
(`db.ts`). Folder-of-small-files over one-big-file-per-locale because
authorship here is agent-first: per-file work units bound context, avoid
write contention, and coverage is a listing diff. **Every supported locale
needs its file with a name** (and `aisle` is all-or-nothing across
locales) **or the build fails**; a broken locale file fails loudly rather
than degrading to a placeholder. The aisles carry genuinely divergent
market data (soy sauce/salt → condiments in JP, tofu → tofu_soy). No
external i18n format (PO/XLIFF/Fluent) is adopted: the flat-YAML catalogs
already are the standard per-locale key-value pattern, and interchange
formats only pay off if human/community translators enter the loop.

**Site-level UI strings are catalogs too** (decided 2026-06-10): the UI
chrome (labels, nutrient names, store-section names) lives in
`src/locales/<locale>.yaml` — flat dotted keys, one file per supported
locale including the canonical one (chrome has no canonical source document,
so all locales are peers). `src/lib/i18n.ts` is a typed facade whose
completeness gate throws on any key-set drift, in any locale, at build.

The lint splits accordingly: catalogs are flat YAML (trivial loops); only the
canonical body needs MDX walking, and only to *extract* step ids and refs —
no cross-language correlation inside JSX. This removes most of what made v2's
linter its riskiest component.

**Rendering strategy is orthogonal and still the `data-locale` flip** (Open
question #6, re-measured at 3 locales, 2026-06-10): carrying all languages in
one page costs ~9–17 KB of HTML per page at three locales — comfortable.
Astro's per-locale i18n routes remain the fallback when the flip's cost is
actually felt (more locales, or much longer recipes), not before.

---

## Resolution semantics

`Params` = `servings` + knob values + per-role fill selections (a subset of
each role's fills, `|selection| ≥ min` enforced, `> max` warned).
`resolve(recipe, db, P)`:

1. **Validate** `P` (domains, role minima, `error` constraints).
2. **Resolve each role** to zero or more `{roleId, fillId, grams}` rows:
   - *substitutive*: each of the k chosen fills contributes
     `(1/k) × (fill.amount ?? role.amount)`;
   - *additive*: each chosen fill contributes its own `fill.amount`;
   - apply `scale` multipliers whose `"<knob>.<value>"` matches `P`;
   - multiply by `P[proportionalTo ?? 'servings'] / servings.default` unless
     `fixed`;
   - `ml → g` via `db[id].density_g_per_ml`.
3. **Nutrition** `= Σ scaleNutrition(db[id].per_100g, grams / 100)` over all
   rows — a pure fold, honest for any `P`, correct under shared fill ids.
4. **Warnings**: `warn` constraints + advisory-`max` violations whose
   condition holds.
5. **Steps** *(render-time)*: the `MethodController` shows steps whose `when`
   holds and patches refs, using the same guard parser SSR used for the
   default point.

Order-independence holds: multipliers commute and nothing depends on the path
through parameter space.

### Projections (a grouping is a view, not an attribute)

- **Shopping list** — merge rows by ingredient id, group by aisle **in the
  viewer's locale** (see below), sum grams.
- **Ingredient view** — by role, tiered: **Base** (derived) first as the
  dish's skeleton, then substitutable roles, then `min: 0` roles. Tiering
  keeps role count from forcing excessive scrolling: ~9 roles render as 3–4
  visual sections.
- **Step view** — `reads` per step (mise en place), derived from refs.

**Aisle is locale-specific (decided 2026-06-10).** Store geography is *not* an
invariant fact about a food — it differs by country, and the site is EN/JA.
Tofu sits in its own refrigerated soy section in a Japanese supermarket, not
in `dairy_eggs`; eggs are often shelf-stable in Japan; soy sauce/miso are a
major dedicated aisle in Japan and an "international" shelf-slice in the US. So
`aisle` is `Record<Locale, StoreSection>` — each locale has its own section
enum, and the shopping list groups by the **viewer's** locale. The section
*labels* are a fixed bilingual enum in `i18n.ts`. The skill fills both
locales' aisles when it creates the ingredient YAML (it has the context — it
is writing the `.ja.yaml` catalog anyway). Note: the shipped shopping list
currently groups by **role**, not aisle at all, so this is new capability, not
a regression to fix.

---

## Customize UX (design pass — decided 2026-06-10)

How the model is *presented and driven*. The one fixed point: the **Nutrition
Facts panel is non-negotiable** — always visible, always folding honest
numbers from the resolved list. Every customize interaction is "change a control → watch the
nutrition pane (and the live method) respond." The pane is a feedback surface,
never an error channel.

### Stages are modalities, and the modalities are the projections

A recipe is used in three stages, and each reorganizes the ingredient list a
different way — which is exactly the three projection axes. The stages *are* the
projections; the tab bar gives each its moment:

| Tab (stage) | Projection axis | Shows |
| --- | --- | --- |
| **Customize** (decide) | by **role** | roles + fills + whys; the swap controls |
| **Shop** (buy) | by **aisle** | merged by ingredient id, ordered by store section, tick-off |
| **Cook** (make) | by **step** | **mise en place** — ingredients bucketed by the step that needs them |

This replaces the v1 `[Recipe | Customize]` tabs (where customize was a
peripheral optional-toppings toggle) with `[Customize | Shop | Cook]`, customize
elevated to primary. Shop is promoted from a sub-toggle buried in the ingredient
list to its own stage. Mise-en-place is the Cook stage's value: it uses the
by-step data (derived from each step's `<Ref>`s) to answer "what do I gather
before I start?", complementing the method's "what do I do". An ingredient used
in two steps appears under each — correct for mise en place, harmless to
nutrition (a non-owning read).

### Always-on frame

- **Pattern** — the thesis renders as a quiet deck **under the title**,
  visible in every stage. It frames shopping ("why these things"), cooking ("why
  this order"), and substitution ("the bar a swap must clear"). It is the one
  required content element, so it sits with the title, not inside a tab.
- **Servings scaler** — stays above the tabs (it affects all stages).
- **Method** — stays always-visible **below** the tabs (ingredients/method
  separation is a centuries-old standard, kept). Its `<Ref>`s patch live as
  fills change — the clearest demonstration that a recipe is a function of the
  reader's choices, across every stage.

### The role card (the atom of the teaching interaction)

A role expresses its **job** (the `why` line, always visible — the lesson), its
**current fill(s)** with live amount, its **alternatives** (each with its own
`why`/tradeoff), and any **reality note** on the chosen fill. Four shapes fall
out of cardinality:

- **Base** (derived: `min ≥ 1`, single fill) — no choice; a fixed skeleton
  ingredient + why, shown first as a labelled "Base" tier.
- **Substitution** (`max 1`, several fills) — radio.
- **Multi** (`max > 1` / unbounded) — checkboxes.
- **Add-on** (`min 0`) — toggle on/off.

**Responsive disclosure (one DOM, two presentations).** On a phone, each role is
**collapsed**: one line (job + current fill + amount), alternatives one tap away.
On a desktop, every role is **expanded** (all alternatives visible at once —
scrolling is cheap there). This is a native `<details>`/`<summary>` disclosure
force-opened by a `@media (min-width: …)` rule that hides the summary and shows
the fills — so the responsive switch is **pure CSS** (no viewport JS, no resize
thrash) and works **JS-off on every screen** (browser-native expand). The Svelte
island owns only the *selection* (radio/checkbox → store), never the disclosure.
Substitutive multi-fill just shows the split grams; no ratio control (deferred,
open Q7).

### Validation maps min/max straight onto the controls

The model's **min = structural, max = advisory** split *is* the UX:

- **min — the control resists.** A radio role always has exactly one fill
  (unviolable). A multi role with `min ≥ 1` won't deselect below its floor; the
  last required item resists with an explanatory line ("A protein is required —
  it's what makes this filling"). The resistance itself teaches the role is
  load-bearing, and the invalid "dish breaks" state never renders.
- **max — allow and gently flag.** Exceeding the advisory ceiling shows a quiet
  inline note on the role, never a block.
- **constraint `warn`** — a soft caution shown inline beside the controls
  involved, at the moment the combination is chosen.
- **constraint `error` — functional disable.** An option is disabled **iff
  applying it to the current `Params` would produce a `blocked` result**
  (`options.filter(opt => resolve(withOption(P, opt)).blocked)`). This is
  symmetric and complete by construction: it gates *every* click that would
  block, in both directions, so there is no asymmetric back door (the naive
  "disable the option named in the constraint" leaks — set the other half first,
  then the ungated half). Inductively, starting from the always-valid default
  point and disabling every blocking single-step transition, the current
  `Params` is **never** blocked — so no "selected-while-disabled" state can
  exist. The pure-function engine makes the gating correct for free.

All notices live **at their source in the Customize stage** (cause next to
effect), leaving the nutrition pane to its one honest job.

---

## Worked example — the weight-loss stew (abridged)

```yaml
pattern: >
  High volume, high fiber, enough protein, low calorie density. Your stomach
  senses volume, not calories — a liquid meal this size keeps you full for
  hours. No ingredient below is sacred; every role serves this goal, and any
  swap that preserves it preserves the dish.

servings: { min: 1, max: 8, default: 4 }

roles:
  added_fat:
    why: "The whole pot's fat budget is this one tablespoon — flavor carrier,
      not aroma (volatiles boil off in a stew anyway). Skippable: water-sauté
      works."
    range: { min: 0, max: 1 }
    fills:
      - { id: olive_oil, amount: { value: 15, unit: ml }, default: true }

  aromatics:
    why: "The flavor base, built from nearly calorie-free vegetables."
    range: { min: 1 }                  # additive
    fills:
      - { id: onion,  amount: { value: 200, unit: g }, default: true }
      - { id: garlic, amount: { value: 12,  unit: g }, default: true }

  lentils:                             # BASE (derived: min 1, single fill)
    why: "Load-bearing: protein, fiber, iron — and they thicken the broth.
      Nothing else here does both jobs."
    range: { min: 1, max: 1 }
    fills:
      - { id: lentils, amount: { value: 96, unit: g }, default: true }

  protein:
    why: "Satiety needs protein, but the pattern needs it LEAN — pork belly is
      'a protein' and would wreck the calories-per-fullness math."
    range: { min: 1, max: 2 }
    amount: { value: 396, unit: g }    # substitutive: fills partition this
    fills:
      - { id: tofu, default: true,
          why: "Just drain — no pressing. Simmers the whole time without harm." }
      - { id: chicken_breast, amount: { value: 250, unit: g },
          why: "Leanest meat option. Breast dries out when over-simmered — it
            joins late, not at the start. See the method." }

  potato:                              # BASE
    why: "The satiety star — dense, cheap volume. Reheated leftovers form
      resistant starch: even better the next day."
    range: { min: 1, max: 1 }
    fills:
      - { id: potato, amount: { value: 550, unit: g }, default: true }

  greens:
    why: "Volume and micronutrients at almost no calories, folded in last."
    range: { min: 1, max: 2 }
    amount: { value: 60, unit: g }     # substitutive
    fills:
      - { id: spinach, default: true, why: "Wilts in a minute off the heat." }
      - { id: kale, why: "Sturdier — needs ~5 minutes in the pot, not 1." }

  seasonings:
    why: "Umami and warmth at near-zero calories — why this doesn't taste like
      diet food."
    range: { min: 2, max: 6 }          # additive; max is advisory
    fills:
      - { id: soy_sauce, amount: { value: 30, unit: ml }, default: true,
          why: "The slow-cooked taste for ~20 kcal. Low-sodium, so you control
            salt yourself." }
      - { id: cumin,  amount: { value: 2, unit: g }, default: true }
      - { id: salt,   amount: { value: 2, unit: g }, default: true,
          why: "To taste, at the end, after the soy sauce." }
```

Picking `protein: [tofu, chicken_breast]` at 4 servings: tofu contributes
`½ × 396 = 198 g`, chicken `½ × 250 = 125 g`; the guarded step `hold_chicken`
appears; nutrition folds over both rows. Dropping chicken restores 396 g tofu
and hides the step — no other edits.

*(Overnight oats exercises the knob machinery: `thickness` enum scales the
chia role ×1.5 and the liquid role ×0.8; `liquid` is a `min:1,max:1`
substitutive role with kefir/oat-milk/water fills — v2's worked example
translates mechanically.)*

## What this subsumes

| Today (shipped) / v2 | v3 |
| --- | --- |
| `servings_default` + slider | `servings` scalar |
| `base_ingredients` flat list + `group` labels | roles; Base tier **derived**; role/aisle/step views are projections |
| `optional_ingredients` categories | `min: 0` roles, additive |
| v2 `FixedUse` / `SlotUse` / `MultiSelectParam` | the single `Role`/`Fill` primitive + cardinality |
| v2 `warnings` (avoid/good) | pedagogical `why`/`note` on fills + guarded steps ("explain why the recipe is this way", not cautions) |
| inline `{en, ja}` everywhere | canonical EN + per-locale catalogs |
| Tips prose stating "the formula matters more than the recipe" | the required `pattern` field — promoted from incidental prose to structure |

**Pay-as-you-go survives:** a simple recipe is roles with `min:1,max:1`,
single fills, no knobs — exactly a flat ingredient list plus required `why`s.

## Authoring via the skill

`recipe-from-youtube` writes two files: `recipe.mdx` (canonical EN) and
`recipe.ja.yaml`. Transcripts are richer in *why* than in grams — cooks
narrate causality constantly ("don't add the shrimp early, it turns rubbery")
— and the agent's own cooking knowledge fills gaps. Rules: model a narrated
substitution as a fill, a narrated texture/style choice as a knob; never
introduce a role/knob/fill whose `why` you cannot state; fit reality notes to
this dish's context rather than copying generic facts.

## Open questions

1. ~~**Linearity honesty.**~~ **— SETTLED (2026-06-10): keep `servings.max`
   low.** Everything scales `× servings`, but salt/spices scale sub-linearly
   and simmer times don't scale at all. Resolution: this is a home-cook tool,
   so a conservative `servings.max` keeps every recipe inside the region where
   the linear model is honest. No sub-linear math (would break the
   "inspectable multipliers, no arithmetic" rule and add false precision); the
   range cap *is* the mitigation. A role that genuinely shouldn't scale can
   still be marked `fixed`, and a `why` may note "taste as you go" where spice
   non-linearity bites near the top of the range.
2. ~~**`aisle` is not locale-invariant.**~~ **— SETTLED (2026-06-10):
   per-locale aisle map.** `aisle: Record<Locale, StoreSection>`; the shopping
   list groups by the viewer's locale. See "Aisle is locale-specific". (What
   remains is implementation: defining each locale's section enum + ordering.)
3. ~~**`error` constraints in a static build**~~ **— SETTLED (2026-06-10):
   functional disable.** An option is disabled iff applying it to the current
   `Params` would `block`; symmetric/complete, keeps `Params` never-blocked
   inductively from the valid default point. See *Customize UX → Validation*.
4. **Rounding/display of scaled amounts** — reuse/extend `units.ts` hinting.
   (Carried.) Note: the *partition* worry (125 g chicken ≈ ⅔ breast) is
   **settled as a non-issue** (2026-06-10): it's an author concern, not a model
   flaw. Cooking isn't baking — the author sets each fill's full-equivalent so
   the swap *eats* roughly equivalently ("one package of tofu ≈ N chicken
   breasts"); precision isn't required, and the resulting nutrition cascade is
   a consequence the eater is *meant* to notice (the teaching, not a defect).
5. ~~**Amount-less ingredients**~~ **— SETTLED (2026-06-10): no sentinel.**
   To-taste ingredients are authored with a realistic **token amount** plus a
   `note` carrying the "to taste" guidance (the shipped salt fills are the
   worked examples). Folding 0 for a real ingredient would lie about exactly
   the nutrient that matters most (sodium) — "adding zero of something in a
   nutrition tool is shirking responsibility." A token estimate sentinel is
   the same number as a token amount with extra machinery. *Portion hints for
   staged additions* — **settled 2026-06-11 by step apportionment (Q14)**.
6. **Rendering at 3+ locales** — *re-measured with zh-CN live (2026-06-10)*:
   the `data-locale` flip costs ~9–17 KB HTML per page at three locales —
   kept. Astro i18n routes remain the fallback when the cost is actually
   felt, not before.
7. **Partition proportions** — equal split among chosen fills for now;
   author-tunable weights only when a real recipe demands them.
8. **Localized list-join grammar.** A multi-fill `<Ref>` renders a list of
   names ("tofu and chicken" / 「豆腐と鶏むね肉」). Conjunction differs by
   language (English Oxford-comma + "and"; Japanese と/や; others have dual
   forms, gendered connectors). A per-locale `join(names[])` function
   (`joinNames`, names.ts) has now carried three locales — zh-CN added 顿号 +
   和 ("草莓、蓝莓和树莓") with no model change. Holding; revisit only if a
   locale needs context-dependent joins.
9. **Market-divergent content (`availability`) — DECIDED and implemented
   (2026-06-10).** Some ingredient data cannot be a 1:1 translation: brands,
   buying guidance, and market-specific warnings differ by country, not just
   language. `availability` is now **per-locale**
   (`Partial<Record<Locale, MarketGuidance>>`, types.ts): each entry is
   original content *authored for that market in that language* — never
   translated from a canonical (there is no canonical; the legacy
   market-keyed `us`/`ja` shape with `note_en`/`note_ja` tangled language
   into markets and forced near-duplicate cells). Carried by each locale's
   ingredient file (`data/ingredients/<locale>/<id>.yaml`, unkeyed); the
   "don't invent brands" rule applies per market.
   **Optional with no completeness gate** — unlike names/catalogs (which
   translate canonical content), absence here means "no guidance for this
   market" and the surface renders nothing; zh-CN starts empty until someone
   authors for that market. Notes carry an `important` flag: scarcity
   warnings ("カルディや輸入食品店で入手可能") and recipe-correctness picks
   ("use low-sodium soy sauce") pin to the Shop row; everything else, plus
   brand examples, waits behind a per-row "More tips" disclosure (native
   `<details>`) that renders only when there is more to reveal. The recipe
   layer needed no change — catalog surfaces remain independently *authored
   statements* (the parity lint already legitimizes divergence).
10. **Market scarcity — REVISED 2026-06-10 (same day; was "market
    unavailability").** (a) *Not on this market's shelves but orderable*
    ('nduja in the US): the `online` store section — outside the physical
    walk, sorted FIRST (lead time), paired with an `important`
    availability note. Shipped. (b) *Extremely difficult to obtain* — the
    revision: an ingredient is **never declared unobtainable**. That is a
    temporal, falsifiable absolute (today's import ban or supply gap is
    next year's shelf item), and the cook with a local source outranks
    the database. Scarcity is **authored guidance, not derived fact**: an
    `important` availability note in that locale's language carries the
    warning and the why ('nduja: "specialty importers only — allow
    shipping time"; dried scallops/瑶柱 for imitation shark fin soup:
    "expensive; specialty groceries or online"). The previously specified
    `unavailable: true` flag and its compiler ladder (non-viability
    banner, index badge, non-viable-everywhere build error,
    default-selection warning) are **retired before implementation**:
    with no absolute in the data there is nothing sound to derive, and
    the *advisory-never-structural* invariant (locale stays a view
    dimension; resolution is locale-independent) now holds by
    construction — the data cannot express impossibility at all.
    Optional future piece, deferred until a real dish wants it: a
    machine-readable note kind (`scarce: true` alongside `important`) so
    a dish-level *caution* — never a verdict — can be derived per locale
    from base-role fills and echoed on Customize fill buttons. Standing
    doctrine unchanged: substituting a BASE fill is a different dish,
    i.e. a separate recipe. Recorded for later: "unobtainable as a
    product, makeable from obtainable parts" (injera from teff, youtiao)
    is an acquisition mode that points at sub-recipe composition — out
    of scope, noted so it isn't rediscovered.
11. **Fidelity to the source + provenance of choices — DECIDED 2026-06-11.**
    A customization exists only where the source narrated one (a
    substitution, an add-on, a texture choice the cook offered); everything
    else is authored **fixed** — no fabricated toggles. (The first import
    violated this — marinade/finisher on-off switches the video never
    sanctioned — and was re-authored the same day.) Some recipes are
    *definitively* fixed: certified Italian recipes are the anchor case —
    deviation is legal, but it forfeits the name. Knowledge the source
    didn't sanction MAY still become an interactive choice, but it must
    wear its provenance: an inline label distinguishing the cook's options
    from "our addition", plus a **page-state badge** — a recipe opens as
    the cook's exact version ("As taught by …") and flips to "Your
    variation (based on …)" the moment any choice departs from the source
    point; flipping back restores it. Servings scaling and source-narrated
    knobs never trip the badge. Showcase plan: **carbonara** (certified
    pole: the official recipe, with labeled pancetta/parmesan/cream
    heresies — pick cream and the page stops calling it carbonara) before
    **okonomiyaki** (framework pole: opens already in "make it yours").
    Badge + labels are pending implementation; until then imports author
    narrated-only choices and park editorial knowledge in prose.
12. **Named intermediates — DECIDED 2026-06-11 (direction).** The model
    gains "things you make along the way" (soaking water, slurry, the
    marinated chicken): declared with an id and a one-line description,
    produced by one step, used by later ones. Never shoppable — they
    surface in the Cook/gather view ("from step 4: the reserved soaking
    water") and enable a use-before-make build check; step-dependency
    facts ("the soak and the knife work are independent") become derivable
    later for parallelism hints. A full method DSL was considered and
    **rejected**: it tangles language into code (each step is one flat
    sentence per locale — the property that keeps translation tractable)
    and turns adopting cooks into programmers. *Bought* water is
    orthogonal and approved as an ordinary core ingredient (zero
    nutrition, density 1.0) — queued with the Q15 shop work, which owns
    the aisle-less display rules. Sub-recipes stay out of scope; an
    intermediate "big enough to have its own page" is the natural bridge
    when they arrive.
13. **Graph-evaluated nutrition + discard fractions — DECIDED 2026-06-11.**
    Mostly-discarded uses (marinades, brines, frying oil, poaching
    liquids) overstate the panel — the model's single worst credibility
    risk. The surviving fraction is authored **on the step where the
    discard happens** (locality: the discard is an event; one number
    covers the whole marinade; change the step — "reduce it into the
    sauce instead" — and the nutrition follows). Uniform across nutrients
    (per-nutrient absorption would be false precision), stated basis
    required, default = everything survives (pay-as-you-go: simple
    recipes author nothing). This **supersedes the implicit rule that
    nutrition never reads the method**; the invariant is restated as:
    *nutrition is a pure function of the reader's choices, evaluated over
    the recipe's declared graph* — still deterministic and
    order-independent at every parameter point. The shopping list always
    shows full amounts: "what do I buy" and "what do I eat" are different
    questions, each answered honestly.
14. **Step apportionment — DECIDED 2026-06-11; settles Q5's carried
    portion hints.** A step may declare how much of a declared total it
    uses ("toast the scallops: 5 ml of the oil; coat the chicken: the
    other 5"), and the build verifies the portions sum to the
    declaration. This *amends* "references never own quantity": references
    may now **apportion** a declared quantity — the amount is still
    declared exactly once, so the invariant's actual point (no drift, no
    double-counting) survives. Same annotation channel as Q13: one
    mechanism covers staged additions and discards. Kills timing-only
    role splits (the soup's two oil roles merge when this lands).
15. **Store dimension for shopping — DECIDED 2026-06-11; extends Q10.**
    The shop list today is one walk through one imaginary store, with
    `online` bolted on as a pseudo-section — but for a scarce ingredient
    the truthful instruction was never "look in the online aisle", it was
    "this is at a *different store*". Per-locale aisle gains an optional
    store ∈ { primary (default), specialty, online } and the list groups
    store-first — *Order ahead / Your supermarket / Specialty shop* —
    each store keeping its own section walk. Display-only: resolution
    never reads it, so advisory-never-structural holds by construction.
    Store labels are site-catalog data; each market names its own second
    stop (Asian grocery / 中華食材店 / 南北干货店). Un-fudges en-US dried
    scallops and dark soy.
16. **Shopping-distinct cores + shared-nutrition lint — DECIDED and
    implemented 2026-06-11.** `sourcing.md`'s "one file per
    nutritionally-distinct food" becomes "one file per **shopping-distinct
    product**" (the dark-soy precedent: two bottles in one pot cannot
    share an id, because the shop list merges by id). Several cores may
    cite the same SR Legacy entry; the loader now enforces that cores
    sharing an `fdc_id` carry identical `per_100g` blocks, so duplicated
    nutrition cannot silently drift.
