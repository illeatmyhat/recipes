/**
 * The shared locale store for every island.
 *
 * Locale is document-level UI state (it outlives any one recipe and exists on
 * the index too), so it lives here rather than in RecipeStoreV3. Every island
 * imports `locale` from this module — it lands in one shared build chunk, so
 * the store is a true cross-island singleton.
 */
import { writable } from 'svelte/store';
import type { Locale } from '../lib/types';

/** Active UI locale. SSR/static render uses `en`; hydration runs detection. */
export const locale = writable<Locale>('en');

let localeInitialized = false;

/**
 * Initialise the UI locale from the value the inline script in RecipeLayout
 * resolved before first paint, and keep `<html data-locale>` in sync with the
 * store thereafter. Idempotent — the first island to hydrate wins.
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
  const de = document.documentElement;
  de.dataset.locale = value;
  de.lang = value;
  // The page <title> lives in <head> with no .lang-* siblings, so swap it
  // directly from the localized strings the layout stamped onto <html>.
  const title = value === 'ja' ? de.dataset.titleJa : de.dataset.titleEn;
  if (title) document.title = title;
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
