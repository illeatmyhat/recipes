<script lang="ts">
  // Small island: 🇺🇸 / 🇯🇵 flag buttons. Writes to the shared `locale` store,
  // which in turn updates <html data-locale> and the ?lang= URL param, so both
  // the Svelte islands and the CSS-localized static content react instantly.
  import { onMount } from 'svelte';
  import { locale, initStore } from './RecipeStore';
  import { t } from '../lib/i18n';
  import type { Locale, ResolvedRecipe } from '../lib/types';

  let { recipe }: { recipe: ResolvedRecipe } = $props();

  const OPTIONS: ReadonlyArray<{ code: Locale; flag: string; label: string }> = [
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'ja', flag: '🇯🇵', label: '日本語' },
  ];

  onMount(() => {
    initStore({
      servingsDefault: recipe.servingsDefault,
      defaultFruitIds: recipe.fruits.filter((f) => f.selectedByDefault).map((f) => f.id),
      defaultToppingIds: recipe.toppings
        .filter((tp) => tp.selectedByDefault)
        .map((tp) => tp.id),
    });
  });
</script>

<div class="locale" role="group" aria-label={t('language', $locale)}>
  {#each OPTIONS as opt (opt.code)}
    <button
      type="button"
      class="flag"
      class:active={$locale === opt.code}
      aria-pressed={$locale === opt.code}
      onclick={() => locale.set(opt.code)}
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
