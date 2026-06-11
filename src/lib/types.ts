/**
 * Shared TypeScript types for the recipes site.
 * No `any` anywhere — every shape that crosses a build-time or runtime
 * boundary is described here.
 */

import { siteConfig } from '../../site.config';

/**
 * Site locale configuration. This is *instance* configuration, not a model
 * invariant — it lives in `site.config.ts` at the repo root (the file an
 * adopting site edits); these re-exports are how engine code reaches it.
 * Keep locale assumptions routed through these constants rather than
 * scattered literals.
 */
export const LOCALES = siteConfig.locales;
export type Locale = (typeof LOCALES)[number];

/**
 * The canonical authoring language: recipe MDX and the DB's inline text.
 * The `Locale` annotation type-checks that it is a member of the locale set.
 */
export const CANONICAL_LOCALE: Locale = siteConfig.canonicalLocale;

/**
 * The locales translated via sidecar catalogs and ingredient overlays —
 * every supported locale except the canonical one. A recipe declaring one of
 * these owes it a complete catalog (missing keys fail the build).
 */
export const CATALOG_LOCALES: readonly Locale[] = LOCALES.filter(
  (l) => l !== CANONICAL_LOCALE,
);

/** Whether a runtime string is one of the configured locales (type guard). */
export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/** Build a per-locale record from the configured locale set. */
export function perLocale<T>(value: (loc: Locale) => T): Record<Locale, T> {
  return Object.fromEntries(LOCALES.map((l) => [l, value(l)])) as Record<Locale, T>;
}

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

/**
 * Per-market sourcing guidance for an ingredient.
 *
 * KNOWN INSTANCE LEAK: the `us`/`ja` market keys and `note_en`/`note_ja`
 * fields predate the configurable locale set. The data is dormant (no
 * surface renders it); Q9 (issue #6) restructures it into per-locale
 * market-authored content together with the Shop-stage "where to buy"
 * surface. Don't extend this shape — fix it there.
 */
export interface Availability {
  brands: string[];
  note_en: string;
  note_ja?: string;
}

/**
 * Supermarket sections the shopping list can group by. One shared id space;
 * each locale's stores pick from it independently (store geography is not an
 * invariant fact about a food — tofu is its own refrigerated soy section in
 * Japan, dairy-adjacent in the US; soy sauce is a major aisle in Japan, an
 * international shelf-slice in the US). Labels live in `STORE_SECTIONS`
 * (src/lib/i18n.ts), in store-walk order.
 */
export type StoreSection =
  | 'produce'
  | 'meat_seafood'
  | 'tofu_soy'
  | 'dairy_eggs'
  | 'dry_goods'
  | 'canned'
  | 'condiments'
  | 'spices'
  | 'oils'
  | 'international'
  | 'other';

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
  /**
   * Which supermarket section carries this food, per viewer locale. Optional
   * during migration — the shopping list groups absentees under "other".
   */
  aisle?: Record<Locale, StoreSection>;
}

