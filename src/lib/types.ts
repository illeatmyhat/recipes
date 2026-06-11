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
 * The locales translated via per-recipe sidecar catalogs — every supported
 * locale except the canonical one. A recipe declaring one of these owes it
 * a complete catalog (missing keys fail the build). (The ingredient DB is
 * NOT canonical-relative: every locale, canonical included, owns a
 * data/ingredients/<locale>/ folder.)
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
 * One sourcing note for a market. `important: true` pins the note to the
 * shopping row (scarcity warnings, recipe-correctness picks); everything
 * else waits behind the row's disclosure. In ingredient YAML a bare string
 * is shorthand for a non-important note (normalized at load, db.ts).
 */
export interface MarketNote {
  text: string;
  important?: boolean;
}

/**
 * Sourcing guidance for one market, authored in that locale's language —
 * original per-market content, never a translation of a canonical note
 * (Q9, docs/recipe-model.md). Per-locale and OPTIONAL with no completeness
 * gate: absence means "no guidance for this market", and the Shop surface
 * simply renders nothing. The don't-invent-brands rule applies per market.
 */
export interface MarketGuidance {
  brands?: string[];
  notes?: MarketNote[];
}

/**
 * Which STORE an errand belongs to (Q15, docs/recipe-model.md). The shopping
 * list is errands, not one walk through one imaginary store: `primary` is
 * the everyday supermarket (the default), `specialty` the market's second
 * stop (a Chinese grocery, an Italian deli — each locale's catalog names
 * it), and `online` is order-ahead — not on any local shelf. The array IS
 * the errand render order: online FIRST (its defining property is lead
 * time, so the cook must see it before the trip), then primary, then
 * specialty. Display-only: resolution never reads it. The `Store` union is
 * derived from this array so the id set, the render walk, and the catalog
 * completeness gate (src/lib/i18n.ts) can never drift apart.
 */
export const STORE_IDS = ['online', 'primary', 'specialty'] as const;
export type Store = (typeof STORE_IDS)[number];

/**
 * Supermarket sections the shopping list can group by, in store-walk render
 * order. One shared id space; each locale's stores pick from it
 * independently (store geography is not an invariant fact about a food —
 * tofu is its own refrigerated soy section in Japan, dairy-adjacent in the
 * US; soy sauce is a major aisle in Japan, an international shelf-slice in
 * the US). Labels live in `STORE_SECTIONS` (src/lib/i18n.ts). The
 * `StoreSection` union is derived from this array — adding a section here
 * is the whole engine-side change.
 */
export const SECTION_IDS = [
  'produce',
  'meat_seafood',
  'tofu_soy',
  'dairy_eggs',
  'dry_goods',
  'canned',
  'condiments',
  'spices',
  'oils',
  'international',
  'other',
] as const;
export type StoreSection = (typeof SECTION_IDS)[number];

/**
 * Where one locale buys a food: a store plus that store's section. In the
 * YAML a bare section string is shorthand for the primary store (normalized
 * at load, db.ts) — every pre-store ingredient file stays valid as-is.
 */
export interface AislePlacement {
  store: Store;
  section: StoreSection;
}

/**
 * An ingredient as assembled at load (src/lib/recipe/db.ts). On disk it is a
 * **locale-neutral core** (`data/ingredients/<id>.yaml`: id, FDC id,
 * nutrition, density — a library asset, unbiased toward any culture) plus
 * one file per supported locale (`data/ingredients/<locale>/<id>.yaml`:
 * names/aliases/aisle/availability). No locale is inlined in the core —
 * the canonical locale included.
 */
export interface IngredientData {
  id: string;
  fdc_id: number;
  names: Localized;
  aliases: Record<Locale, string[]>;
  /** Per-market sourcing guidance, keyed by locale. Optional everywhere. */
  availability?: Partial<Record<Locale, MarketGuidance>>;
  nutrition: {
    per_100g: NutritionFacts;
  };
  /** Grams per millilitre. Required to weigh `ml` ingredients; null for solids. */
  density_g_per_ml: number | null;
  /**
   * Where this food is bought (store + section), per viewer locale.
   * All-or-nothing across locales (gated at load). Absent entirely means the
   * food is NOT bought (water from the tap): it is excluded from the
   * shopping list while remaining a real ingredient everywhere else.
   */
  aisle?: Record<Locale, AislePlacement>;
}

