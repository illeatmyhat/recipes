<script lang="ts">
  // Small island: 🇺🇸 / 🇯🇵 flag buttons. setLocale writes the shared `locale`
  // store and remembers the choice in localStorage (the same way the theme
  // toggle does); the store update flips <html data-locale>, so both the
  // Svelte islands and the CSS-localized static content react instantly.
  import { onMount } from 'svelte';
  import { locale, initLocale, setLocale } from './RecipeStore';
  import { t } from '../lib/i18n';
  import type { Locale } from '../lib/types';

  const OPTIONS: ReadonlyArray<{ code: Locale; flag: string; label: string }> = [
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'ja', flag: '🇯🇵', label: '日本語' },
  ];

  // Locale switching needs no recipe data, so this works on any page (the
  // index included). Recipe-page islands also call initLocale (via initV3) —
  // all idempotent, so whichever hydrates first wins.
  onMount(() => initLocale());
</script>

<div class="locale" role="group" aria-label={t('language', $locale)}>
  {#each OPTIONS as opt (opt.code)}
    <button
      type="button"
      class="flag"
      class:active={$locale === opt.code}
      aria-pressed={$locale === opt.code}
      onclick={() => setLocale(opt.code)}
    >
      <span class="emoji" aria-hidden="true">{opt.flag}</span>
      <span class="text">{opt.label}</span>
    </button>
  {/each}
</div>

<style>
  .locale {
    display: inline-flex;
    gap: 0.35rem;
    padding: 0.25rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
  }
  .flag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.8rem;
    border: none;
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
    color: var(--ink-soft);
    font-size: 0.85rem;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .flag:hover {
    color: var(--ink);
  }
  .flag.active {
    background: var(--accent);
    color: var(--on-accent);
  }
  .emoji {
    font-size: 1.05rem;
    line-height: 1;
  }
</style>
