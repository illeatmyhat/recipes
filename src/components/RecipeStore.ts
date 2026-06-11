/**
 * Shared Svelte stores for the recipe islands.
 *
 * The page **re-resolves on the client** when the user swaps a fill or turns
 * a knob. The island is handed a {@link RecipeBundle} (recipe + every fill's
 * ingredient data); this store holds the live {@link Params} and derives the
 * resolved result by running the pure `resolve` over a map lookup — no
 * filesystem, so the same function used at build time runs unchanged in the
 * browser.
 *
 * Locale lives in LocaleStore.ts (one chunk, one singleton — the index needs
 * it with no recipe in sight); the stage tabs live here
 * (`customize | shop | cook`).
 */
import { writable, derived, type Readable } from 'svelte/store';
import { resolve } from '../lib/recipe/resolve';
import { emptyNutrition } from '../lib/nutrition';
import { fallbackNames } from '../lib/recipe/names';
import { perLocale } from '../lib/types';
import { initLocale } from './LocaleStore';
import type {
  KnobValue,
  LoadedIngredient,
  Params,
  RecipeBundle,
  Resolved,
} from '../lib/recipe/types';

/** The live parameter record. Seeded from the bundle's defaults by {@link initRecipe}. */
export const params = writable<Params>({ servings: 1, knobs: {}, selection: {} });

let bundle: RecipeBundle | null = null;
let initialized = false;

/**
 * The bundle seeded by the first island to hydrate, or `null` before any has.
 * Lets prop-less islands (MethodController) reach the shared recipe data
 * without embedding yet another serialized bundle copy in the page HTML.
 */
export function getBundle(): RecipeBundle | null {
  return bundle;
}

/** A defensive zero-nutrition stand-in (the bundle should carry every fill id). */
function placeholder(id: string): LoadedIngredient {
  return {
    data: {
      id,
      fdc_id: 0,
      names: fallbackNames(id),
      aliases: perLocale<string[]>(() => []),
      availability: {
        us: { brands: [], note_en: '' },
        ja: { brands: [], note_en: '' },
      },
      nutrition: { per_100g: emptyNutrition() },
      density_g_per_ml: 1,
    },
    placeholder: true,
  };
}

/** Resolve a bundle at a parameter point on the client (pure; no I/O). */
export function resolveBundle(b: RecipeBundle, p: Params): Resolved {
  return resolve(b.recipe, (id) => b.ingredients[id] ?? placeholder(id), p);
}

/**
 * The live resolved result. `null` until {@link initRecipe} runs — islands render
 * their SSR default (resolved from the bundle prop) until then.
 */
export const resolved: Readable<Resolved | null> = derived(params, ($params) =>
  bundle ? resolveBundle(bundle, $params) : null,
);

/** Seed the recipe stores from a bundle and initialise locale + tabs. Idempotent. */
export function initRecipe(b: RecipeBundle): void {
  if (!initialized) {
    initialized = true;
    bundle = b;
    params.set(b.defaults);
  }
  initLocale();
  initTabs();
}

// ── selection helpers ─────────────────────────────────────────────────────────

export function setServings(n: number): void {
  params.update((p) => ({ ...p, servings: Math.max(1, n) }));
}

export function setKnob(name: string, value: KnobValue): void {
  params.update((p) => ({ ...p, knobs: { ...p.knobs, [name]: value } }));
}

/** Choose exactly one fill for a role (radio / pick-one semantics). */
export function setFill(roleId: string, fillId: string): void {
  params.update((p) => ({ ...p, selection: { ...p.selection, [roleId]: [fillId] } }));
}

/** Add or remove a fill from a role's selection (checkbox / toggle semantics). */
export function toggleFill(roleId: string, fillId: string): void {
  params.update((p) => {
    const cur = p.selection[roleId] ?? [];
    const next = cur.includes(fillId)
      ? cur.filter((id) => id !== fillId)
      : [...cur, fillId];
    return { ...p, selection: { ...p.selection, [roleId]: next } };
  });
}

// ── tabs (customize | shop | cook) ────────────────────────────────────────────

export type Tab = 'customize' | 'shop' | 'cook';
export const TABS: ReadonlyArray<Tab> = ['customize', 'shop', 'cook'];
export const activeTab = writable<Tab>('customize');

let tabsInitialized = false;

/** Reflect the active stage onto `<html data-stage>` so the page CSS swaps panels. */
export function initTabs(): void {
  if (tabsInitialized) return;
  tabsInitialized = true;
  activeTab.subscribe((tab) => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.stage = tab;
  });
}
