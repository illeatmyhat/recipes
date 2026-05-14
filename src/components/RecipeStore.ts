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
import type { Locale, ResolvedRecipe } from '../lib/types';

/** How many servings the user currently wants. Starts at 1; `initStore` resets it. */
export const servings = writable<number>(1);

/**
 * The user's optional-ingredient selection: the chosen ingredient ids for each
 * optional category, keyed by category id. The categories themselves are
 * defined per-recipe, so this is a generic map rather than fixed fields.
 */
export const selectedOptional = writable<Record<string, string[]>>({});

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

/** The main-column tabs, in carousel order. Shared by TabBar and NextTab. */
export type Tab = 'recipe' | 'customize';
export const TABS: ReadonlyArray<Tab> = ['recipe', 'customize'];

/** Which main-column tab is showing. {@link initTabs} reflects it onto
 *  `<html data-tab>`, which the CSS in RecipePage uses to swap panels. */
export const activeTab = writable<Tab>('recipe');

/**
 * The ingredient ids selected by default in each optional category, keyed by
 * category id — the seed for {@link selectedOptional}. Exported so islands can
 * render the same selection before hydration that `initStore` will set after.
 */
export function defaultSelected(recipe: ResolvedRecipe): Record<string, string[]> {
  return Object.fromEntries(
    recipe.optionalCategories.map((category) => [
      category.id,
      category.ingredients
        .filter((ingredient) => ingredient.selectedByDefault)
        .map((ingredient) => ingredient.id),
    ]),
  );
}

let storeInitialized = false;
let localeInitialized = false;
let tabsInitialized = false;

/**
 * Reflect the active tab onto `<html data-tab>` so the CSS in RecipePage shows
 * the matching panel. Idempotent. Called by TabBar and NextTab.
 */
export function initTabs(): void {
  if (tabsInitialized) return;
  tabsInitialized = true;

  activeTab.subscribe((tab) => {
    if (typeof document === 'undefined') return;
    // 'recipe' is the CSS default — clear the attribute rather than set it.
    if (tab === 'recipe') delete document.documentElement.dataset.tab;
    else document.documentElement.dataset.tab = tab;
  });
}

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
 * Seed the recipe stores from a resolved recipe, and initialise the locale.
 * Idempotent: the first island to hydrate wins, later ones are no-ops, so
 * every island shares one consistent initial state.
 */
export function initStore(recipe: ResolvedRecipe): void {
  if (!storeInitialized) {
    storeInitialized = true;
    servingsDefault.set(recipe.servingsDefault);
    servings.set(recipe.servingsDefault);
    selectedOptional.set(defaultSelected(recipe));
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

/** Toggle one optional ingredient's selection within its category. */
export function toggleOptional(categoryId: string, ingredientId: string): void {
  selectedOptional.update((selected) => {
    const current = selected[categoryId] ?? [];
    const next = current.includes(ingredientId)
      ? current.filter((id) => id !== ingredientId)
      : [...current, ingredientId];
    return { ...selected, [categoryId]: next };
  });
}
