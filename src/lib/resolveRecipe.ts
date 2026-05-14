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
import { scaleNutrition } from './nutrition';
import { UNIT_ML } from './units';
import type {
  IngredientData,
  IngredientRef,
  OptionalCategory,
  OptionalIngredientRef,
  RecipeFrontmatter,
  ResolvedIngredient,
  ResolvedRecipe,
} from './types';

/** Absolute path to the ingredient YAML directory. */
const INGREDIENT_DIR = join(process.cwd(), 'data', 'ingredients');

/** In-process cache so the same YAML file is parsed once per build. */
const ingredientCache = new Map<string, IngredientData>();

/** Load and parse a single ingredient YAML file by its id. */
function loadIngredient(id: string): IngredientData {
  const cached = ingredientCache.get(id);
  if (cached) return cached;

  const file = join(INGREDIENT_DIR, `${id}.yaml`);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `resolveRecipe: ingredient "${id}" not found at ${file}. ` +
        `Every id referenced in recipe frontmatter needs a /data/ingredients/<id>.yaml file.`,
    );
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
 * Convert a recipe amount to grams. `g` is already weight; volume units
 * (`ml`, `tsp`, `tbsp`) are converted to millilitres and then weighed via the
 * ingredient's density, which therefore must be present.
 */
function toGrams(ref: IngredientRef, data: IngredientData): number {
  if (ref.unit === 'g') return ref.amount;
  // Volume unit — needs a density to be weighed.
  if (data.density_g_per_ml == null) {
    throw new Error(
      `resolveRecipe: ingredient "${ref.id}" is used with unit "${ref.unit}" ` +
        `but its YAML has density_g_per_ml: null. Volume units need a density.`,
    );
  }
  const millilitres = ref.amount * UNIT_ML[ref.unit];
  return millilitres * data.density_g_per_ml;
}

/** Merge one ingredient reference with its DB entry and scale its nutrition. */
function resolveIngredient(
  ref: IngredientRef | OptionalIngredientRef,
  category: OptionalCategory | null,
): ResolvedIngredient {
  const data = loadIngredient(ref.id);
  const grams = toGrams(ref, data);
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
    notes: ref.notes,
    warnings: ref.warnings ?? [],
    nutrition,
    category,
    selectedByDefault,
  };
}

/**
 * Resolve a recipe's frontmatter into a fully typed {@link ResolvedRecipe}.
 * Every ingredient is loaded, merged, and scaled; nothing is `any`.
 */
export function resolveRecipe(frontmatter: RecipeFrontmatter): ResolvedRecipe {
  const baseIngredients = frontmatter.base_ingredients.map((ref) =>
    resolveIngredient(ref, null),
  );
  const fruits = frontmatter.optional_ingredients.fruits.map((ref) =>
    resolveIngredient(ref, 'fruits'),
  );
  const toppings = frontmatter.optional_ingredients.toppings.map((ref) =>
    resolveIngredient(ref, 'toppings'),
  );

  return {
    title: frontmatter.title,
    slug: frontmatter.slug,
    locales: frontmatter.locales,
    servingsDefault: frontmatter.servings_default,
    baseIngredients,
    fruits,
    toppings,
    allIngredients: [...baseIngredients, ...fruits, ...toppings],
  };
}
