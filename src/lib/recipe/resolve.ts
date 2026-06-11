/**
 * Resolution — the deterministic core.
 *
 * `resolve(recipe, lookup, P)` is a pure function of the final parameter record
 * `P` (not a fold of mutations), so it is order-independent by construction. It
 * turns each role's chosen fills into gram-weighted rows — substitutive roles
 * partition their total in fraction space, additive roles sum their fills — then
 * folds nutrition over the rows. Steps are NOT resolved here (they live in the
 * MDX body, patched at render time); this owns the data half only.
 *
 * Validated against the prototype (`docs/proto-recipe-model.mjs`).
 */
import { scaleNutrition, sumNutrition } from '../nutrition';
import type { IngredientData } from '../types';
import { evalGuard } from './guards';
import type {
  Amount,
  IngredientLookup,
  Params,
  Recipe,
  ResolvedNotice,
  ResolvedRow,
  Resolved,
} from './types';

/** Convert a metric amount to grams (`ml` via density, which must then exist). */
function toGrams(amount: Amount, data: IngredientData): number {
  if (amount.unit === 'g') return amount.value;
  if (data.density_g_per_ml == null) {
    throw new Error(
      `recipe resolve: ingredient "${data.id}" is used with "ml" but density_g_per_ml is null.`,
    );
  }
  return amount.value * data.density_g_per_ml;
}

/** The default value of a scalar parameter (`servings` or a scalar knob). */
function scalarDefault(recipe: Recipe, name: string): number {
  if (name === 'servings') return recipe.servings.default;
  const knob = recipe.knobs?.[name];
  if (!knob || knob.kind !== 'scalar') {
    throw new Error(`recipe resolve: proportionalTo "${name}" is not a scalar parameter.`);
  }
  return knob.default;
}

/** The current value of a scalar parameter under `P`. */
function scalarValue(name: string, p: Params): number {
  if (name === 'servings') return p.servings;
  return Number(p.knobs[name]);
}

/** Product of every `scale` entry whose "<knob>.<value>" matches `P`. */
function scaleMultiplier(scale: Record<string, number> | undefined, p: Params): number {
  if (!scale) return 1;
  let m = 1;
  for (const [key, mult] of Object.entries(scale)) {
    const dot = key.indexOf('.');
    if (dot < 0) continue;
    const knob = key.slice(0, dot);
    const value = key.slice(dot + 1);
    const current = knob === 'servings' ? String(p.servings) : String(p.knobs[knob]);
    if (current === value) m *= mult;
  }
  return m;
}

/**
 * Resolve a recipe at a parameter point. Pure: all I/O is behind `lookup`.
 */
export function resolve(recipe: Recipe, lookup: IngredientLookup, p: Params): Resolved {
  const rows: ResolvedRow[] = [];
  const notices: ResolvedNotice[] = [];

  for (const [roleId, role] of Object.entries(recipe.roles)) {
    const picked = p.selection[roleId] ?? [];
    const max = role.range.max ?? Infinity;
    if (picked.length < role.range.min) {
      notices.push({ kind: 'below-min', role: roleId, have: picked.length, min: role.range.min });
    }
    if (picked.length > max) {
      notices.push({ kind: 'above-max', role: roleId, have: picked.length, max });
    }
    if (picked.length === 0) continue;

    const substitutive = role.amount != null;
    const k = picked.length;

    for (const fillId of picked) {
      const fill = role.fills.find((f) => f.id === fillId);
      if (!fill) {
        notices.push({ kind: 'unknown-fill', role: roleId, fill: fillId });
        continue;
      }

      // Base amount before scaling.
      let base: Amount;
      if (substitutive) {
        // role.amount is non-null here; fill may override the full-equivalent.
        const full = fill.amount ?? (role.amount as Amount);
        base = { value: full.value / k, unit: full.unit };
      } else {
        if (!fill.amount) {
          throw new Error(
            `recipe resolve: additive role "${roleId}" fill "${fillId}" has no amount.`,
          );
        }
        base = fill.amount;
      }

      let m = scaleMultiplier(role.scale, p);
      if (!role.fixed) {
        const prop = role.proportionalTo ?? 'servings';
        m *= scalarValue(prop, p) / scalarDefault(recipe, prop);
      }

      const { data, placeholder } = lookup(fillId);
      const grams = toGrams(base, data) * m;
      const volumeMl = data.density_g_per_ml != null ? grams / data.density_g_per_ml : null;

      rows.push({
        role: roleId,
        id: fillId,
        names: data.names,
        alias: fill.alias ?? null,
        grams,
        volumeMl,
        nutrition: scaleNutrition(data.nutrition.per_100g, grams / 100),
        placeholder,
      });
    }
  }

  let blocked = false;
  for (const c of recipe.constraints ?? []) {
    if (!evalGuard(c.when, p)) continue;
    if (c.error) {
      notices.push({ kind: 'constraint-error', text: c.error });
      blocked = true;
    } else if (c.warn) {
      notices.push({ kind: 'constraint-warn', text: c.warn });
    }
  }

  return { rows, nutrition: sumNutrition(rows), notices, blocked };
}

/** The default parameter point: servings/knob/role defaults. Renders statically (SSR). */
export function defaultParams(recipe: Recipe): Params {
  const knobs: Record<string, string | number | boolean> = {};
  for (const [name, knob] of Object.entries(recipe.knobs ?? {})) {
    knobs[name] = knob.default;
  }
  const selection: Record<string, string[]> = {};
  for (const [roleId, role] of Object.entries(recipe.roles)) {
    selection[roleId] = role.fills.filter((f) => f.default).map((f) => f.id);
  }
  return { servings: recipe.servings.default, knobs, selection };
}
