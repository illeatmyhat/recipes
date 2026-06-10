/**
 * Shared TypeScript types for the recipes site.
 * No `any` anywhere — every shape that crosses a build-time or runtime
 * boundary is described here.
 */

export type Locale = 'en' | 'ja';

/** Colour theme. Resolved from a stored choice or the OS preference. */
export type Theme = 'light' | 'dark';

/** A string that exists in every supported locale. */
export type Localized = Record<Locale, string>;

/**
 * Units accepted in recipe frontmatter — always metric. `ml` ingredients need
 * the ingredient's `density_g_per_ml` so they can be weighed for nutrition.
 * Kitchen units (tsp/tbsp) are a display-only rendering, never a source unit.
 */
export type Unit = 'g' | 'ml';

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
  /**
   * Optional sub-group heading for base ingredients (e.g. "Protein",
   * "Seasonings"), letting a long base list read as labelled clusters. When no
   * base ingredient sets one, the list renders under the single generic "Base"
   * heading. Unused by optional ingredients (they group by their category).
   */
  group?: Localized;
}

/** An optional ingredient reference — same as {@link IngredientRef} plus a default flag. */
export interface OptionalIngredientRef extends IngredientRef {
  default: boolean;
}

/**
 * A named group of optional ingredients, defined entirely by the recipe — e.g.
 * "Fruits", "Toppings", "Sauces". The app hard-codes no particular set; a
 * recipe declares whichever categories it wants.
 */
export interface OptionalCategoryRef {
  /** Stable id, used as the key for the user's selection within the category. */
  id: string;
  label: Localized;
  ingredients: OptionalIngredientRef[];
}

/** Raw recipe frontmatter as parsed from the MDX file. */
export interface RecipeFrontmatter {
  title: Localized;
  slug: string;
  locales: Locale[];
  servings_default: number;
  /** Optional per-recipe heading for the Customize tab; falls back to i18n. */
  customize_title?: Localized;
  base_ingredients: IngredientRef[];
  optional_ingredients: OptionalCategoryRef[];
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
  /**
   * The amount as a volume in millilitres, when a density is known (always for
   * `ml` ingredients; for `g` ingredients only if the YAML sets a density).
   * `null` when it cannot be measured by volume. Used only to render an
   * approximate teaspoon/tablespoon hint — never for nutrition.
   */
  volumeMl: number | null;
  notes: Localized;
  warnings: IngredientWarning[];
  /** Nutrition scaled from per-100g to {@link grams}. */
  nutrition: NutritionFacts;
  /** The id of the optional category this belongs to, or `null` for base. */
  category: string | null;
  /** Whether the recipe selects this ingredient by default. Always true for base. */
  selectedByDefault: boolean;
  /** Optional sub-group heading for a base ingredient; `null` when ungrouped. */
  group: Localized | null;
}

/** An optional category after its ingredient refs have been resolved. */
export interface ResolvedOptionalCategory {
  id: string;
  label: Localized;
  ingredients: ResolvedIngredient[];
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
  /** Per-recipe Customize-tab heading; `undefined` falls back to the i18n string. */
  customizeTitle?: Localized;
  baseIngredients: ResolvedIngredient[];
  /** The recipe's optional-ingredient categories, in author order. */
  optionalCategories: ResolvedOptionalCategory[];
  /** Every ingredient (base + all optional categories) in one list. */
  allIngredients: ResolvedIngredient[];
}
