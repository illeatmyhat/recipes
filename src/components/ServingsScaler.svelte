<script lang="ts">
  import { onMount } from 'svelte';
  import { servings, locale, initStore } from './RecipeStore';
  import { t } from '../lib/i18n';
  import type { ResolvedRecipe } from '../lib/types';

  let { recipe }: { recipe: ResolvedRecipe } = $props();

  const MIN = 1;
  const MAX = 12;

  // SSR renders the recipe's default; after hydration the shared store drives it.
  let mounted = $state(false);
  const count = $derived(mounted ? $servings : recipe.servingsDefault);

  onMount(() => {
    initStore({
      servingsDefault: recipe.servingsDefault,
      defaultFruitIds: recipe.fruits.filter((f) => f.selectedByDefault).map((f) => f.id),
      defaultToppingIds: recipe.toppings
        .filter((tp) => tp.selectedByDefault)
        .map((tp) => tp.id),
    });
    mounted = true;
  });

  function dec(): void {
    servings.update((n) => Math.max(MIN, n - 1));
  }
  function inc(): void {
    servings.update((n) => Math.min(MAX, n + 1));
  }
</script>

<section class="scaler" aria-labelledby="scaler-heading">
  <h2 id="scaler-heading">{t('servings', $locale)}</h2>
  <div class="control">
    <button
      type="button"
      class="step"
      onclick={dec}
      disabled={count <= MIN}
      aria-label={t('decrease', $locale)}>&minus;</button
    >
    <output class="value" aria-live="polite">
      <span class="num">{count}</span>
      <span class="label"
        >{count === 1 ? t('serving', $locale) : t('servingsPlural', $locale)}</span
      >
    </output>
    <button
      type="button"
      class="step"
      onclick={inc}
      disabled={count >= MAX}
      aria-label={t('increase', $locale)}>+</button
    >
  </div>
</section>

<style>
  .scaler {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    background: var(--surface);
  }
  h2 {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .step {
    width: 2.75rem;
    height: 2.75rem;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--bg);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    color: var(--ink);
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .step:hover:not(:disabled) {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .step:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .value {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .num {
    font-size: 2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .label {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
