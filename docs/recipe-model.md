# Recipe model v3 — pattern, roles, fills

**Status:** design proposal (not yet implemented). Supersedes the v2
param-centric model after the 2026-06-10 design session re-grounded the
project's purpose. Decisions and rationale from that session are inline;
remaining forks are in *Open questions*.

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
   canonical source language (EN) in the recipe file itself. (Previously:
   inline `{ en, ja }` pairs — see *Localization*.) The site remains fully
   bilingual EN/JA; the storage shape now scales to N locales.
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
  aisle: StoreSection;                 // see Open question #2 (locale-dependence)
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
atom  := roleOrKnob | literal | 'has(' role ',' string ')' | '(' expr ')'
```

`has(protein, 'chicken_breast')` tests fill membership; `liquid == oat_milk`
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
- `<Ref of="role"/>` — reads a role; renders the chosen fills' localized names
  (multi-fill renders a localized list join: "tofu and chicken" /
  「豆腐と鶏むね肉」). References never own quantity.
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

- **Completeness is an error**: every key present in every declared locale.
- **Read-set parity is a warning, not an error**: Japanese legitimately drops
  arguments English requires (「混ぜて一晩冷蔵する」 needn't re-mention the
  liquid). The lint flags asymmetric reads for review; it does not block.
- **Staleness via source-hash** (the gettext "fuzzy" mechanism): each catalog
  entry stores a hash of the source string it translated; source changed ⇒
  entry flagged stale.

The lint splits accordingly: catalogs are flat YAML (trivial loops); only the
canonical body needs MDX walking, and only to *extract* step ids and refs —
no cross-language correlation inside JSX. This removes most of what made v2's
linter its riskiest component.

**Rendering strategy is orthogonal and deferred** (Open question #6): today's
both-languages-in-one-page + `data-locale` flip works at 2 locales; Astro's
built-in i18n routing (per-locale routes) is the standard at 3+.

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

- **Shopping list** — merge rows by ingredient id, group by aisle (Open
  question #2), sum grams.
- **Ingredient view** — by role, tiered: **Base** (derived) first as the
  dish's skeleton, then substitutable roles, then `min: 0` roles. Tiering
  keeps role count from forcing excessive scrolling: ~9 roles render as 3–4
  visual sections.
- **Step view** — `reads` per step (mise en place), derived from refs.

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

1. **Linearity honesty.** Everything scales `× servings`, but salt/spices
   scale sub-linearly and simmer times don't scale at all. The model silently
   teaches "cooking is linear", which a critical-thinking tool shouldn't.
   Candidate mitigations: conservative `servings.max` (the range *is* the
   region where linearity holds), `fixed` roles, or a scaling note. Unsettled.
2. **`aisle` is not locale-invariant.** Store geography differs by country
   (tofu in a Japanese supermarket is its own section, not `dairy_eggs`); an
   8-value Anglo-grocery enum in the DB contradicts the bilingual goal.
   Candidates: per-locale aisle map in the DB, or locale-specific section
   *ordering* over one neutral enum. Unsettled.
3. **`error` constraints in a static build** — disable the control vs
   allow-and-flag. (Carried from v2.)
4. **Rounding/display of scaled amounts** (partition can yield 125 g of
   chicken breast ≈ ⅔ breast) — reuse/extend `units.ts` hinting. (Carried.)
5. **Amount-less ingredients** — `to_taste` sentinel folds 0 nutrition vs a
   token estimate; portion hints for staged additions. (Carried; the
   two-purposes-vs-staged boundary is now settled, see Roles.)
6. **Rendering at 3+ locales** — `data-locale` flip (today) vs Astro i18n
   routes. Orthogonal to the catalog format; decide when a third locale is
   real.
7. **Partition proportions** — equal split among chosen fills for now;
   author-tunable weights only when a real recipe demands them.
