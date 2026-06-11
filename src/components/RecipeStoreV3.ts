/**
 * Shared Svelte stores for the v3 recipe islands.
 *
 * Unlike v1 (which pre-bakes the resolved recipe at build time), v3 must
 * **re-resolve on the client** when the user swaps a fill or turns a knob. The
 * island is handed a {@link RecipeBundle} (recipe + every fill's ingredient
 * data); this store holds the live {@link Params} and derives the resolved
 * result by running the pure `resolve` over a map lookup — no filesystem, so the
 * same function used at build time runs unchanged in the browser.
 *
 * Locale is shared with the v1 store (one chunk, one singleton); tabs are
 * v3-specific (`customize | shop | cook`).
 */
import { writable, derived, type Readable } from 'svelte/store';
import { resolve } from '../lib/v3/resolve';
import { emptyNutrition } from '../lib/nutrition';
import { humanizeId, localizeAll } from '../lib/v3/names';
import { initLocale } from './RecipeStore';
import type {
  KnobValue,
  LoadedIngredient,
  Params,
  RecipeBundle,
  ResolvedV3,
} from '../lib/v3/types';

/** The live parameter record. Seeded from the bundle's defaults by {@link initV3}. */
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
      names: localizeAll(humanizeId(id)),
      aliases: { 'en-US': [], 'ja-JP': [], 'zh-CN': [] },
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
export function resolveBundle(b: RecipeBundle, p: Params): ResolvedV3 {
  return resolve(b.recipe, (id) => b.ingredients[id] ?? placeholder(id), p);
}

/**
 * The live resolved result. `null` until {@link initV3} runs — islands render
 * their SSR default (resolved from the bundle prop) until then.
 */
export const resolved: Readable<ResolvedV3 | null> = derived(params, ($params) =>
  bundle ? resolveBundle(bundle, $params) : null,
);

/** Seed the v3 stores from a bundle and initialise locale + tabs. Idempotent. */
export function initV3(b: RecipeBundle): void {
  if (!initialized) {
    initialized = true;
    bundle = b;
    params.set(b.defaults);
  }
  initLocale();
  initV3Tabs();
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

export type TabV3 = 'customize' | 'shop' | 'cook';
export const TABS_V3: ReadonlyArray<TabV3> = ['customize', 'shop', 'cook'];
export const activeTabV3 = writable<TabV3>('customize');

let tabsInitialized = false;

/** Reflect the active stage onto `<html data-stage>` so the page CSS swaps panels. */
export function initV3Tabs(): void {
  if (tabsInitialized) return;
  tabsInitialized = true;
  activeTabV3.subscribe((tab) => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.stage = tab;
  });
}
