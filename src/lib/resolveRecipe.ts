/**
 * Build-time recipe resolver.
 *
 * Merges the ingredient database (/data/ingredients/*.yaml) with a recipe's
 * MDX frontmatter, scales every ingredient's nutrition from a USDA per-100g
 * basis to the amount the recipe actually uses, and converts volume units to
 * weight via each ingredient's density. Runs only at build time (it touches
 * the filesystem) and returns a fully typed {@link ResolvedRecipe}.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { emptyNutrition, scaleNutrition } from './nutrition';
import { resolveV3Recipe } from './v3/toResolvedRecipe';
import { hydrateRecipe } from './v3/i18n';
import type { CanonicalRecipeFrontmatterV3 } from './v3/types';
import type {
  IngredientData,
  IngredientRef,
  OptionalIngredientRef,
  RecipeFrontmatter,
  ResolvedIngredient,
  ResolvedOptionalCategory,
  ResolvedRecipe,
} from './types';

/** Absolute path to the ingredient YAML directory. */
const INGREDIENT_DIR = join(process.cwd(), 'data', 'ingredients');

/** In-process cache so the same YAML file is parsed once per build. */
const ingredientCache = new Map<string, IngredientData>();

/** Turn an ingredient id into a readable label, e.g. `smoked_paprika` -> `Smoked paprika`. */
function humanizeId(id: string): string {
  const words = id.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A neutral stand-in for an ingredient whose `/data/ingredients/<id>.yaml` does
 * not exist yet. It carries zero nutrition (so totals stay honest rather than
 * fabricated), a humanized name, and density 1 so `ml` refs can still be weighed.
 * The build degrades cleanly — one missing entry no longer fails the whole site —
 * and the placeholder vanishes automatically once the real YAML lands. Loud
 * `console.warn` keeps the gap visible (and surfaces typo'd ids).
 */
function placeholderIngredient(id: string): IngredientData {
  const name = humanizeId(id);
  return {
    id,
    fdc_id: 0,
    names: { en: name, ja: name },
    aliases: { en: [], ja: [] },
    availability: {
      us: { brands: [], note_en: 'Nutrition data pending.' },
      ja: { brands: [], note_en: 'Nutrition data pending.', note_ja: '栄養データは準備中です。' },
    },
    nutrition: { per_100g: emptyNutrition() },
    density_g_per_ml: 1,
  };
}

/** Load and parse a single ingredient YAML file by its id. */
function loadIngredient(id: string): IngredientData {
  const cached = ingredientCache.get(id);
  if (cached) return cached;

  const file = join(INGREDIENT_DIR, `${id}.yaml`);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    console.warn(
      `resolveRecipe: ingredient "${id}" has no ${file} — using a zero-nutrition ` +
        `placeholder. Add /data/ingredients/${id}.yaml (or fix a typo'd id).`,
    );
    const placeholder = placeholderIngredient(id);
    ingredientCache.set(id, placeholder);
    return placeholder;
  }

  const data = load(raw) as IngredientData;
  if (!data || data.id !== id) {
    throw new Error(
      `resolveRecipe: ${file} has id "${data?.id}" but was loaded as "${id}".`,
    );
  }
  ingredientCache.set(id, data);
  return data;
}

/**
 * Convert a recipe amount to grams. `g` is already weight; `ml` is converted
 * via the ingredient's density, which therefore must be present.
 */
function toGrams(ref: IngredientRef, data: IngredientData): number {
  if (ref.unit === 'g') return ref.amount;
  // ref.unit === 'ml'
  if (data.density_g_per_ml == null) {
    throw new Error(
      `resolveRecipe: ingredient "${ref.id}" is used with unit "ml" but its ` +
        `YAML has density_g_per_ml: null. A density is required to weigh liquids.`,
    );
  }
  return ref.amount * data.density_g_per_ml;
}

/**
 * Merge one ingredient reference with its DB entry and scale its nutrition.
 * `category` is the id of the optional category it belongs to, or `null` for
 * a base ingredient.
 */
function resolveIngredient(
  ref: IngredientRef | OptionalIngredientRef,
  category: string | null,
): ResolvedIngredient {
  const data = loadIngredient(ref.id);
  const grams = toGrams(ref, data);
  // Volume is only for the approximate tsp/tbsp display hint, never nutrition.
  const volumeMl =
    data.density_g_per_ml != null ? grams / data.density_g_per_ml : null;
  // (amount / 100) * per_100g_value, expressed as a single factor.
  const nutrition = scaleNutrition(data.nutrition.per_100g, grams / 100);
  const selectedByDefault =
    category === null ? true : (ref as OptionalIngredientRef).default === true;

  return {
    id: data.id,
    fdc_id: data.fdc_id,
    names: data.names,
    aliases: data.aliases,
    availability: data.availability,
    amount: ref.amount,
    unit: ref.unit,
    grams,
    volumeMl,
    notes: ref.notes,
    warnings: ref.warnings ?? [],
    nutrition,
    category,
    selectedByDefault,
    group: ref.group ?? null,
  };
}

/**
 * Resolve a recipe's frontmatter into a fully typed {@link ResolvedRecipe}.
 *
 * Accepts both frontmatter shapes during the v3 migration: a **v3** recipe
 * (has `roles`) is delegated to the v3 engine via the temporary bridge; a
 * **v1** recipe is resolved here. Every ingredient is loaded, merged, and
 * scaled; nothing is `any`.
 */
export function resolveRecipe(
  frontmatter: RecipeFrontmatter | CanonicalRecipeFrontmatterV3,
): ResolvedRecipe {
  // v3: merge the per-locale catalog with the canonical EN frontmatter, then resolve.
  if ('roles' in frontmatter) return resolveV3Recipe(hydrateRecipe(frontmatter));

  const baseIngredients = frontmatter.base_ingredients.map((ref) =>
    resolveIngredient(ref, null),
  );

  // Every optional category the recipe declares — the set is the author's, not
  // the app's. Each ingredient is tagged with its category id.
  const optionalCategories: ResolvedOptionalCategory[] =
    frontmatter.optional_ingredients.map((category) => ({
      id: category.id,
      label: category.label,
      ingredients: category.ingredients.map((ref) =>
        resolveIngredient(ref, category.id),
      ),
    }));

  return {
    title: frontmatter.title,
    slug: frontmatter.slug,
    locales: frontmatter.locales,
    servingsDefault: frontmatter.servings_default,
    customizeTitle: frontmatter.customize_title,
    baseIngredients,
    optionalCategories,
    allIngredients: [
      ...baseIngredients,
      ...optionalCategories.flatMap((category) => category.ingredients),
    ],
  };
}
