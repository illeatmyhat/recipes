/**
 * Shared Svelte stores for the recipe islands.
 *
 * Every interactive island (ServingsScaler, CustomizePanel, NutritionPanel,
 * LocaleSwitcher) imports from here, so servings, ingredient selections, and
 * locale stay in sync across components with zero prop drilling.
 *
 * These stores hold the *interactive* state only. Static recipe data is still
 * passed to islands as props — it never changes, so it does not belong here.
 */
import { writable, derived, type Readable } from 'svelte/store';
import type { Locale } from '../lib/types';

/** How many servings the user currently wants. Starts at 1; `initStore` resets it. */
export const servings = writable<number>(1);

/** IDs of the optional fruits the user has selected. */
export const selectedFruits = writable<string[]>([]);

/** IDs of the optional toppings the user has selected. */
export const selectedToppings = writable<string[]>([]);

/** Active UI locale. SSR/static render uses `en`; hydration runs detection. */
export const locale = writable<Locale>('en');

/** The recipe's default servings count, needed to compute the scale factor. */
export const servingsDefault = writable<number>(1);

/**
 * Multiplier applied to per-recipe nutrition: current servings ÷ default
 * servings. A recipe authored for 1 serving viewed at 3 servings yields 3.
 */
export const servingsFactor: Readable<number> = derived(
  [servings, servingsDefault],
  ([$servings, $default]) => ($default > 0 ? $servings / $default : 1),
);

/** Defaults pulled from a resolved recipe, handed to {@link initStore}. */
export interface StoreDefaults {
  servingsDefault: number;
  defaultFruitIds: string[];
  defaultToppingIds: string[];
}

let initialized = false;

/**
 * Seed the stores from a recipe's defaults and run locale detection.
 * Idempotent: the first island to hydrate wins, later ones are no-ops, so
 * every island shares one consistent initial state.
 */
export function initStore(defaults: StoreDefaults): void {
  if (initialized) return;
  initialized = true;

  servingsDefault.set(defaults.servingsDefault);
  servings.set(defaults.servingsDefault);
  selectedFruits.set([...defaults.defaultFruitIds]);
  selectedToppings.set([...defaults.defaultToppingIds]);

  const detected = detectLocale();
  locale.set(detected);
  applyLocaleToDocument(detected);

  // Keep the <html data-locale> attribute and the URL in sync with the store
  // so CSS-driven (JS-optional) content and shareable links both follow along.
  locale.subscribe((value) => {
    applyLocaleToDocument(value);
    syncLocaleToUrl(value);
  });
}

/**
 * Resolve the initial locale: an explicit `?lang=` query param wins, otherwise
 * fall back to the browser's `navigator.language`, otherwise English.
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const param = new URLSearchParams(window.location.search).get('lang');
  if (param === 'ja' || param === 'en') return param;
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('ja') ? 'ja' : 'en';
}

/** Reflect the locale onto `<html data-locale>` so CSS can localize static content. */
function applyLocaleToDocument(value: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.locale = value;
  document.documentElement.lang = value;
}

/** Reflect the locale into `?lang=` without adding history entries. */
function syncLocaleToUrl(value: Locale): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('lang') === value) return;
  url.searchParams.set('lang', value);
  window.history.replaceState({}, '', url);
}

/** Toggle an id within a `string[]` store (used by the customize toggles). */
export function toggleId(store: typeof selectedFruits, id: string): void {
  store.update((ids) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
  );
}
