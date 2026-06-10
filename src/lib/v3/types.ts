/**
 * Recipe model v3 — types (pattern / roles / fills).
 *
 * The deterministic core of the v3 model from `docs/recipe-model.md`. These
 * types describe a recipe as a pattern instantiated by roles, filled by
 * ingredients, plus the `Params` that drive resolution and the resolved output.
 *
 * **Localizable slot `T`.** Every human-facing string is a type parameter:
 * `T = string` is the *canonical* (authored EN) form that lives in the MDX
 * frontmatter; `T = Localized` is the *hydrated* form (merged with the per-locale
 * catalog — see i18n.ts) that the engine consumes. The `…T<T>` interfaces are
 * the general shape; the bare `Role` / `Fill` / `RecipeV3` aliases are the
 * `Localized` instantiation the engine uses, so engine code is unchanged. No `any`.
 */
import type { Locale, Localized, Unit, NutritionFacts, IngredientData } from '../types';

/** A metric amount as written in a role/fill (`g` for solids, `ml` for liquids). */
export interface Amount {
  value: number;
  unit: Unit;
}

/** Min/max number of fills a role accepts. `min` is structural, `max` advisory. */
export interface Range {
  min: number;
  /** Absent ⇒ unbounded ("as many as you want"). */
  max?: number;
}

/** One concrete ingredient that can fill a role. `T` is the localizable slot. */
export interface FillT<T> {
  /** Ingredient id in the DB. */
  id: string;
  amount?: Amount;
  default?: boolean;
  /** Why this fill fits / what to know when choosing it. */
  why?: T;
  /** Recipe-specific handling ("add at the 20-minute mark"). */
  note?: T;
  /** Recipe-specific PROSE name (bare noun phrase) for in-sentence use. */
  alias?: T;
}

/** A job the pattern needs done; filled by one or more ingredients. */
export interface RoleT<T> {
  /** Display heading for the by-role projection (e.g. "Protein" / "タンパク質"). */
  label: T;
  why: T;
  range: Range;
  /** Present ⇒ substitutive: the role owns this total, chosen fills partition it. */
  amount?: Amount;
  /** Scalar param this role scales with; defaults to `servings`. */
  proportionalTo?: string;
  /** True ⇒ a true constant: ignore servings/scalar scaling. */
  fixed?: boolean;
  /** Declarative multiplier table: "<knob>.<value>" -> multiplier. No arithmetic. */
  scale?: Record<string, number>;
  fills: FillT<T>[];
}

/** A closed choice that drives scaling/guards but adds no ingredient. */
export interface EnumKnobT<T> {
  kind: 'enum';
  label: T;
  why?: T;
  values: string[];
  default: string;
  optionLabels?: Record<string, T>;
}

/** An on/off knob. */
export interface BoolKnobT<T> {
  kind: 'bool';
  label: T;
  why?: T;
  default: boolean;
}

/** A continuous/stepped number knob (not `servings`, which is its own field). */
export interface ScalarKnobT<T> {
  kind: 'scalar';
  label: T;
  why?: T;
  min: number;
  max: number;
  step?: number;
  default: number;
}

export type KnobT<T> = EnumKnobT<T> | BoolKnobT<T> | ScalarKnobT<T>;

/** A value a knob can hold in `Params`. */
export type KnobValue = string | number | boolean;

/** An explicit annotation over a region of the parameter space. */
export interface ConstraintT<T> {
  /** Boolean expression over params (see guards.ts grammar). */
  when: string;
  /** Soft: show a caution when `when` holds. */
  warn?: T;
  /** Hard: the combination is disallowed in the UI when `when` holds. */
  error?: T;
}

/** The servings scalar — the canonical first parameter. */
export interface ServingsSpec {
  min: number;
  max: number;
  default: number;
}

/** A v3 recipe's structured data, generic over the localizable slot `T`. */
export interface RecipeT<T> {
  title: T;
  slug: string;
  /** The thesis — why this combination works. The only required content element. */
  pattern: T;
  locales: Locale[];
  servings: ServingsSpec;
  knobs?: Record<string, KnobT<T>>;
  roles: Record<string, RoleT<T>>;
  constraints?: ConstraintT<T>[];
}

// ── Hydrated (Localized) aliases — what the engine consumes ───────────────────
export type Fill = FillT<Localized>;
export type Role = RoleT<Localized>;
export type EnumKnob = EnumKnobT<Localized>;
export type BoolKnob = BoolKnobT<Localized>;
export type ScalarKnob = ScalarKnobT<Localized>;
export type Knob = KnobT<Localized>;
export type Constraint = ConstraintT<Localized>;
export type RecipeV3 = RecipeT<Localized>;

// ── Canonical (authored EN) forms — what the MDX frontmatter holds ────────────
export type CanonicalRecipeV3 = RecipeT<string>;

/**
 * Parsed v3 MDX frontmatter (canonical EN): a {@link CanonicalRecipeV3} plus the
 * optional Customize-tab heading. Hydrated to {@link RecipeFrontmatterV3} by
 * merging the per-locale catalog (i18n.ts). (`hero_image` is resolved by Astro
 * and handled by the page, not the resolver.)
 */
export interface CanonicalRecipeFrontmatterV3 extends CanonicalRecipeV3 {
  customize_title?: string;
}

/** The hydrated v3 frontmatter the resolver/bridge consume. */
export interface RecipeFrontmatterV3 extends RecipeV3 {
  customize_title?: Localized;
}

/**
 * The user-driven inputs to resolution: a final parameter *record* (not a fold
 * of mutations). `defaults ⊕ user selections`. Resolution is a pure function of
 * this value.
 */
export interface Params {
  servings: number;
  /** Knob name -> chosen value. */
  knobs: Record<string, KnobValue>;
  /** Role name -> chosen fill ids (length checked against the role's range). */
  selection: Record<string, string[]>;
}

/** One emitted ingredient row after resolution. */
export interface ResolvedRow {
  /** The role this row fills. */
  role: string;
  /** Ingredient id. */
  id: string;
  names: Localized;
  /** Recipe-specific prose alias, if the fill declared one. */
  alias: Localized | null;
  /** Final weight in grams (after partition, scaling, ml→g). */
  grams: number;
  /** Volume in ml when a density is known; else null (display hint only). */
  volumeMl: number | null;
  /** Nutrition scaled from per-100g to `grams`. */
  nutrition: NutritionFacts;
  /** True when the ingredient YAML is a zero-nutrition placeholder. */
  placeholder: boolean;
}

/**
 * A non-fatal notice surfaced by resolution. Locale-agnostic and structured so
 * the UI renders it; constraint notices carry author text.
 */
export type ResolvedNotice =
  | { kind: 'constraint-warn'; text: Localized }
  | { kind: 'constraint-error'; text: Localized }
  | { kind: 'below-min'; role: string; have: number; min: number }
  | { kind: 'above-max'; role: string; have: number; max: number }
  | { kind: 'unknown-fill'; role: string; fill: string };

/** The full result of resolving a recipe at a parameter point. */
export interface ResolvedV3 {
  rows: ResolvedRow[];
  /** Fold of `per_100g · grams/100` over every row. */
  nutrition: NutritionFacts;
  notices: ResolvedNotice[];
  /** True when an `error` constraint holds — the combination is disallowed. */
  blocked: boolean;
}

/** An ingredient loaded from the DB, plus whether it is a zero-nutrition placeholder. */
export interface LoadedIngredient {
  data: IngredientData;
  placeholder: boolean;
}

/**
 * Injected ingredient lookup. `resolve` takes this rather than touching the
 * filesystem itself, keeping it a pure, testable function; `db.ts` provides the
 * build-time implementation.
 */
export type IngredientLookup = (id: string) => LoadedIngredient;
