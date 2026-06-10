# Prototype verdict — v3 recipe model

**Question:** does the pattern/role/fill model compute end-to-end when it meets
a runtime, and where does it break?

**Run:** `node docs/proto-recipe-model.mjs` (interactive; `help` for commands).
Throwaway — delete once findings are folded into `docs/recipe-model.md`.

## What WORKS (structural model is sound)

- **Substitutive partition** — protein alone = tofu 396 g; `[tofu,chicken]` =
  198 g + 125 g (½ of each full-equivalent); composes correctly with servings
  (×2 → 99 + 62.5). Fraction-space split is right.
- **Additive roles** — aromatics/seasonings each contribute their own grams.
- **Servings scaling, ml→g** — olive_oil 15 ml → 13.7 g (real density), all
  rows scale linearly.
- **Nutrition fold** — honest sum over resolved rows; placeholders fold 0 and
  are flagged, totals stay truthful.
- **Derived Base** — lentils & potato auto-flagged `[BASE]` (min≥1, single
  fill); substitutive/additive roles correctly not.
- **Boundness/guard-polarity checker** — passes all good steps; catches all
  three broken kinds: unguarded read of a min:0 role, `!has()` (negated, proves
  the opposite), and `has() || …` (disjunct doesn't guarantee bound).
- **Localized list-join** — EN Oxford comma + "and"; JA と. Mechanically fine.

## What BROKE (findings — need model decisions)

### 1. No fill-specific reference token. (highest value)
The chicken-timing step `<Ref of="protein"/>` renders the **whole role's
selection**: *"Hold the Tofu and Chicken breast back — add at the 20-minute
mark."* But the step is about chicken **only** — tofu can simmer the whole
time. The model has a "reference a role" token but **no "reference a specific
fill" token**, yet fill-specific reality steps (the canonical reason guarded
steps exist) need exactly that. This is a real gap, not cosmetics.
*Proposed fix:* a fill-targeted ref, e.g. `<Ref of="protein" fill="chicken_breast"/>`
(or `<Ref of="protein.chicken_breast"/>`), rendering just that fill's name; the
guard already scopes the step, so the ref should scope to match.

### 2. DB names are not prose-ready.
USDA/display names are Title-Cased and some carry internal commas
("Salt, table"). Interpolated mid-sentence they read wrong — *"Chop the Onion"*
— and in a list join the internal comma **collides with the list separator**:
*"…Ground cumin, and Salt, table and cook"* is ambiguous garbage.
*Proposed fix:* a separate prose/display name distinct from the canonical
catalog name (lower-case, comma-free), or a normalization pass before
interpolation. Either way the canonical name ≠ the in-sentence name.

### 3. Refs to an under-bound role emit dangling connectives.
With protein deselected (an invalid state: protein is min 1), the step reading
it renders *"Stir in the Dried lentils and ."* / JA *"…と を加える"* — a
dangling "and"/と. The boundness checker only guards **min:0** roles; a min≥1
role left under-selected still produces garbage. Bounded in practice because
the real UI blocks invalid states, but the join should defend against an empty
fill list (lower severity).

## Fixes applied + re-validated (2026-06-10)

All three findings were folded into `docs/recipe-model.md` and proven in the
prototype:

1. **Fill-scoped ref** `{role:fill}` (`<Ref of="protein" fill="chicken_breast"/>`)
   → *"Hold the chicken back"* / 「鶏むね肉は後入れ」 — names only the guarded
   fill. Confirmed a **templating affordance, not a model change**: the guard
   already scoped the step; the ref just needed to match.
2. **Recipe-specific `alias` on a fill** + prose-normalized fallback (lower-case,
   comma-stripped) → *"onion and garlic"*, *"…cumin, and salt"* ("Salt, table"
   no longer leaks its comma into the join). Canonical name still used in the
   ingredient/shopping views.
3. **Empty-list join defense** → an empty `{role}` collapses to '' rather than a
   dangling "and"/と. (Residual dangling only in invalid under-filled states,
   which the UI blocks; a template that hard-codes "and" between two refs is an
   authoring choice, not a model fault.)

## Bottom line

The **spine is validated** — pattern/role/fill, the two amount semantics,
derived Base, the fold, and the guard-polarity check survived contact with a
runtime unchanged. Every breakage was at the **rendering boundary** (role/fill
→ words) and is now fixed and re-proven. The model is ready to leave paper:
this `.mjs` is the executable reference for implementing the real `resolve()`.
