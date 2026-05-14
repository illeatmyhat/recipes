/**
 * Shared TypeScript types for the recipes site.
 * No `any` anywhere — every shape that crosses a build-time or runtime
 * boundary is described here.
 */

export type Locale = 'en' | 'ja';

/** A string that exists in every supported locale. */
export type Localized = Record<Locale, string>;

/** Units accepted in recipe frontmatter. `ml` ingredients need a density. */
export type Unit = 'g' | 'ml';

/** Categories an optional ingredient can belong to. */
export type OptionalCategory = 'fruits' | 'toppings';

/** The twelve nutrients tracked per ingredient, USDA per-100g basis. */
export interface NutritionFacts {
  /** kcal */
  calories: number;
  /** g */
  fat: number;
  /** g */
  saturated_fat: number;
  /** g */
  trans_fat: number;
  /** mg */
  cholesterol: number;
  /** mg */
  sodium: number;
  /** g */
  carbohydrates: number;
  /** g */
  fiber: number;
  /** g */
  sugars: number;
  /** g */
  protein: number;
  /** mg */
  calcium: number;
  /** mg */
  iron: number;
}

/** The keys of {@link NutritionFacts}, useful for iteration. */
export type NutrientKey = keyof NutritionFacts;

/** Per-market sourcing guidance for an ingredient. */
export interface Availability {
  brands: string[];
  note_en: string;
  note_ja?: string;
}

/** A single ingredient YAML file under /data/ingredients/<id>.yaml. */
export interface IngredientData {
  id: string;
  fdc_id: number;
  names: Localized;
  aliases: Record<Locale, string[]>;
  availability: {
    us: Availability;
    ja: Availability;
  };
  nutrition: {
    per_100g: NutritionFacts;
  };
  /** Grams per millilitre. Required to weigh `ml` ingredients; null for solids. */
  density_g_per_ml: number | null;
}

/** A warning attached to an ingredient in recipe frontmatter. */
export interface IngredientWarning {
  type: 'avoid' | 'good';
  en: string;
  ja: string;
}

/** A reference to an ingredient from recipe frontmatter (base ingredients). */
export interface IngredientRef {
  id: string;
  amount: number;
  unit: Unit;
  notes: Localized;
  warnings: IngredientWarning[];
}

/** An optional ingredient reference — same as {@link IngredientRef} plus a default flag. */
export interface OptionalIngredientRef extends IngredientRef {
  default: boolean;
}

/** Raw recipe frontmatter as parsed from the MDX file. */
export interface RecipeFrontmatter {
  title: Localized;
  slug: string;
  locales: Locale[];
  servings_default: number;
  base_ingredients: IngredientRef[];
  optional_ingredients: {
    fruits: OptionalIngredientRef[];
    toppings: OptionalIngredientRef[];
  };
}

/**
 * A single ingredient after the ingredient DB has been merged with the recipe
 * reference and nutrition has been scaled to the recipe amount.
 */
export interface ResolvedIngredient {
  id: string;
  fdc_id: number;
  names: Localized;
  aliases: Record<Locale, string[]>;
  availability: IngredientData['availability'];
  /** The amount as written in the recipe. */
  amount: number;
  unit: Unit;
  /** The amount converted to grams (via density for `ml` ingredients). */
  grams: number;
  notes: Localized;
  warnings: IngredientWarning[];
  /** Nutrition scaled from per-100g to {@link grams}. */
  nutrition: NutritionFacts;
  /** Which optional bucket this belongs to, or `null` for base ingredients. */
  category: OptionalCategory | null;
  /** Whether the recipe selects this ingredient by default. Always true for base. */
  selectedByDefault: boolean;
}

/**
 * A fully resolved recipe: frontmatter merged with the ingredient DB, every
 * ingredient scaled, ready to hand to the static shell and the islands.
 */
export interface ResolvedRecipe {
  title: Localized;
  slug: string;
  locales: Locale[];
  servingsDefault: number;
  baseIngredients: ResolvedIngredient[];
  fruits: ResolvedIngredient[];
  toppings: ResolvedIngredient[];
  /** Every ingredient (base + fruits + toppings) in one list. */
  allIngredients: ResolvedIngredient[];
}
