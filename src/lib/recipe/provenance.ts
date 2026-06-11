/**
 * Provenance — does the current parameter point still match the source's
 * recipe? (Q11, docs/recipe-model.md.)
 *
 * The "source point" IS the default parameter point: defaults are the cook's
 * own picks, and an editorial fill can never be a default (schema-gated), so
 * the equivalence holds by construction. A recipe page opens "As taught
 * by …" and flips to "Your variation (based on …)" the moment this returns
 * true; restoring the point restores the badge.
 *
 * What trips it: any role selection differing from the default set — even a
 * swap between two source-narrated options (the cook narrated soy sauce as
 * an alternative, but dad's pick is fish sauce; choosing otherwise is your
 * variation) — and any EDITORIAL knob moved off its default. What never
 * trips it: servings (scaling a recipe is not changing it) and
 * source-narrated knobs (the soup's thickness is dad's own "it's up to
 * you" — every value of it is his recipe).
 *
 * Pure and shared: SSR renders the badge at the default point (never
 * departed); the island re-evaluates per param change.
 */
import type { Params, Recipe } from './types';

/** True when `p` departs from the recipe's source point (= `defaults`). */
export function departsFromSource(recipe: Recipe, defaults: Params, p: Params): boolean {
  for (const roleId of Object.keys(recipe.roles)) {
    const cur = p.selection[roleId] ?? [];
    const def = defaults.selection[roleId] ?? [];
    if (cur.length !== def.length) return true;
    const defSet = new Set(def);
    if (cur.some((id) => !defSet.has(id))) return true;
  }
  for (const [id, knob] of Object.entries(recipe.knobs ?? {})) {
    if (knob.provenance !== 'editorial') continue; // narrated knobs never trip
    if ((p.knobs[id] ?? knob.default) !== (defaults.knobs[id] ?? knob.default)) return true;
  }
  return false;
}
