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

let storeInitialized = false;
let localeInitialized = false;

/**
 * Initialise the UI locale from the value the inline script in RecipeLayout
 * resolved before first paint, and keep `<html data-locale>` in sync with the
 * store thereafter. Idempotent.
 *
 * Split out from {@link initStore} because the index page has locale-switching
 * but no recipe — its LocaleSwitcher calls this directly.
 */
export function initLocale(): void {
  if (localeInitialized) return;
  localeInitialized = true;

  locale.set(detectLocale());

  // The CSS-driven (JS-optional) static content follows the store, so reflect
  // every change onto the document.
  locale.subscribe(applyLocaleToDocument);

  // Mirror a language change made in another tab of this origin. `storage`
  // fires only in the *other* tabs, so this never echoes our own write.
  window.addEventListener('storage', (event) => {
    if (event.key === 'locale' && (event.newValue === 'en' || event.newValue === 'ja')) {
      locale.set(event.newValue);
    }
  });
}

/**
 * Seed the recipe stores from a recipe's defaults, and initialise the locale.
 * Idempotent: the first island to hydrate wins, later ones are no-ops, so
 * every island shares one consistent initial state.
 */
export function initStore(defaults: StoreDefaults): void {
  if (!storeInitialized) {
    storeInitialized = true;
    servingsDefault.set(defaults.servingsDefault);
    servings.set(defaults.servingsDefault);
    selectedFruits.set([...defaults.defaultFruitIds]);
    selectedToppings.set([...defaults.defaultToppingIds]);
  }
  initLocale();
}

/**
 * The initial UI locale. The inline script in RecipeLayout has already
 * resolved it (stored choice → browser language → English) and written it to
 * `<html data-locale>` before first paint, so just trust that — exactly how
 * ThemeToggle reads `data-theme`.
 */
export function detectLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  return document.documentElement.dataset.locale === 'ja' ? 'ja' : 'en';
}

/** Reflect the locale onto `<html data-locale>` so CSS can localize static content. */
function applyLocaleToDocument(value: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.locale = value;
  document.documentElement.lang = value;
}

/** Switch the UI locale and remember the choice in localStorage. */
export function setLocale(value: Locale): void {
  locale.set(value);
  try {
    localStorage.setItem('locale', value);
  } catch {
    // Storage blocked — the choice still applies for this page view.
  }
}

/** Toggle an id within a `string[]` store (used by the customize toggles). */
export function toggleId(store: typeof selectedFruits, id: string): void {
  store.update((ids) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
  );
}
