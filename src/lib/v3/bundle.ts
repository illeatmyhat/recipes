/**
 * Build-time recipe bundle (v3).
 *
 * Packages everything a client island needs to re-resolve a recipe as the user
 * changes parameters: the hydrated recipe, every referenced ingredient's data
 * (so the pure `resolve` runs without filesystem access), and the default
 * parameter point. The result is plain, serializable data handed to the island
 * as a prop. Touches the filesystem (hydrate + ingredient load) — build only.
 */
import { hydrateRecipe } from './i18n';
import { loadIngredient } from './db';
import { defaultParams } from './resolve';
import type { CanonicalRecipeFrontmatterV3, RecipeBundle } from './types';

/** Build the serializable bundle for one v3 recipe from its canonical frontmatter. */
export function buildBundle(fm: CanonicalRecipeFrontmatterV3): RecipeBundle {
  const recipe = hydrateRecipe(fm);

  const ids = new Set<string>();
  for (const role of Object.values(recipe.roles)) {
    for (const fill of role.fills) ids.add(fill.id);
  }

  const ingredients: Record<string, ReturnType<typeof loadIngredient>> = {};
  for (const id of ids) ingredients[id] = loadIngredient(id);

  return { recipe, ingredients, defaults: defaultParams(recipe) };
}
