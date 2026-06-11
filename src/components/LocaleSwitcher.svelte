<script lang="ts">
  // Small island: a language dropdown (a native <select> — keyboard, screen
  // reader, and mobile behavior for free, and it scales past the two-locale
  // button row this used to be). setLocale writes the shared `locale` store
  // and remembers the choice in localStorage (the same way the theme toggle
  // does); the store update flips <html data-locale>, so both the Svelte
  // islands and the CSS-localized static content react instantly.
  import { onMount } from 'svelte';
  import { locale, initLocale, setLocale } from './RecipeStore';
  import { t } from '../lib/i18n';
  import { LOCALES, type Locale } from '../lib/types';

  // Locale switching needs no recipe data, so this works on any page (the
  // index included). Recipe-page islands also call initLocale (via initV3) —
  // all idempotent, so whichever hydrates first wins.
  onMount(() => initLocale());
</script>

<span class="locale">
  <select
    class="picker"
    aria-label={t('language', $locale)}
    value={$locale}
    onchange={(e) => setLocale(e.currentTarget.value as Locale)}
  >
    {#each LOCALES as code (code)}
      <!-- Each language named in itself (the endonym a lost reader can find):
           every catalog carries its OWN ui.languageLabel. -->
      <option value={code}>{t('languageLabel', code)}</option>
    {/each}
  </select>
  <span class="chevron" aria-hidden="true">▾</span>
</span>

<style>
  .locale {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .picker {
    appearance: none;
    padding: 0.45rem 1.9rem 0.45rem 0.9rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }
  .picker:hover {
    border-color: var(--accent);
  }
  .chevron {
    position: absolute;
    right: 0.8rem;
    pointer-events: none;
    font-size: 0.7rem;
    color: var(--ink-soft);
  }
</style>
