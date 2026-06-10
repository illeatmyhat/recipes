/**
 * TEMPORARY v3 → v1 bridge (migration scaffolding).
 *
 * Renders a v3 recipe through the *existing* v1 components by shaping its
 * default parameter point into a {@link ResolvedRecipe}. This keeps the build
 * green while the real v3 Customize/Shop/Cook UI (issues #3/#5) is built; it
 * will be deleted once the components consume v3 `resolve()` output directly.
 *
 * Mapping at the default point:
 *  - roles with `min ≥ 1` → **base ingredients**, grouped by the role's label
 *    (only their default-selected fills — substitution alternatives are not
 *    expressible in the v1 UI, so they are omitted here);
 *  - roles with `min == 0` → **optional categories** (each fill a toggle,
 *    default per `fill.default`).
 *
 * Nutrition and grams are emitted at the default servings (factor 1); the
 * existing islands scale them by the servings factor exactly as for v1.
 */
import { resolve, defaultParams } from './resolve';
import { loadIngredient } from './db';
import type { Amount, Params, RecipeFrontmatterV3, ResolvedRow, Role } from './types';
import type {
  Localized,
  ResolvedIngredient,
  ResolvedOptionalCategory,
  ResolvedRecipe,
  Unit,
} from '../types';

const EMPTY: Localized = { en: '', ja: '' };

/** Shape one resolved v3 row into a v1 ResolvedIngredient. */
function toIngredient(
  row: ResolvedRow,
  role: Role,
  category: string | null,
  selectedByDefault: boolean,
): ResolvedIngredient {
  const { data } = loadIngredient(row.id);
  const fill = role.fills.find((f) => f.id === row.id);
  // Prefer the authored amount/unit for display (e.g. "15 ml"); grams/nutrition
  // remain the resolved truth. For a substitutive default with a single fill,
  // the authored full-equivalent equals the resolved grams.
  const display: Amount | undefined = fill?.amount ?? role.amount;
  const unit: Unit = display ? display.unit : 'g';
  const amount = display ? display.value : row.grams;
  return {
    id: row.id,
    fdc_id: data.fdc_id,
    names: data.names,
    aliases: data.aliases,
    availability: data.availability,
    amount,
    unit,
    grams: row.grams,
    volumeMl: row.volumeMl,
    notes: fill?.note ?? EMPTY,
    warnings: [],
    nutrition: row.nutrition,
    category,
    selectedByDefault,
    group: role.label,
  };
}

/** Resolve a single fill of a role alone, returning its row (for optional fills). */
function resolveFillRow(
  recipe: RecipeFrontmatterV3,
  base: Params,
  roleId: string,
  fillId: string,
): ResolvedRow | undefined {
  const params: Params = {
    ...base,
    selection: { ...base.selection, [roleId]: [fillId] },
  };
  return resolve(recipe, loadIngredient, params).rows.find(
    (r) => r.role === roleId && r.id === fillId,
  );
}

/** Build a v1 ResolvedRecipe from v3 frontmatter at its default parameter point. */
export function resolveV3Recipe(recipe: RecipeFrontmatterV3): ResolvedRecipe {
  const base = defaultParams(recipe);
  const resolved = resolve(recipe, loadIngredient, base);

  // Base ingredients: default-selected fills of min ≥ 1 roles, in role order.
  const baseIngredients: ResolvedIngredient[] = [];
  for (const [roleId, role] of Object.entries(recipe.roles)) {
    if (role.range.min < 1) continue;
    for (const row of resolved.rows) {
      if (row.role === roleId) baseIngredients.push(toIngredient(row, role, null, true));
    }
  }

  // Optional categories: min == 0 roles, each fill a toggle.
  const optionalCategories: ResolvedOptionalCategory[] = [];
  for (const [roleId, role] of Object.entries(recipe.roles)) {
    if (role.range.min !== 0) continue;
    const ingredients: ResolvedIngredient[] = [];
    for (const fill of role.fills) {
      const row = resolveFillRow(recipe, base, roleId, fill.id);
      if (!row) continue;
      ingredients.push(toIngredient(row, role, roleId, fill.default === true));
    }
    if (ingredients.length > 0) {
      optionalCategories.push({ id: roleId, label: role.label, ingredients });
    }
  }

  return {
    title: recipe.title,
    slug: recipe.slug,
    locales: recipe.locales,
    servingsDefault: recipe.servings.default,
    customizeTitle: recipe.customize_title,
    baseIngredients,
    optionalCategories,
    allIngredients: [
      ...baseIngredients,
      ...optionalCategories.flatMap((c) => c.ingredients),
    ],
  };
}
