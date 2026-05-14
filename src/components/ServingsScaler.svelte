<script lang="ts">
  import { onMount } from 'svelte';
  import { servings, locale, initStore } from './RecipeStore';
  import { t } from '../lib/i18n';
  import type { ResolvedRecipe } from '../lib/types';

  let { recipe }: { recipe: ResolvedRecipe } = $props();

  // Slider range — dragging it scales every amount, weight, and nutrient
  // value across the page via the shared `servings` store.
  const MIN = 1;
  const MAX = 12;

  // SSR renders the recipe's default; after hydration the shared store drives it.
  let mounted = $state(false);
  const count = $derived(mounted ? $servings : recipe.servingsDefault);

  onMount(() => {
    initStore(recipe);
    mounted = true;
  });

  function onInput(event: Event): void {
    servings.set(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<section class="scaler" aria-labelledby="scaler-heading">
  <div class="head">
    <h2 id="scaler-heading">{t('servings', $locale)}</h2>
    <output class="value" for="servings-range" aria-live="polite">
      <span class="num">{count}</span>
      <span class="unit"
        >{count === 1 ? t('serving', $locale) : t('servingsPlural', $locale)}</span
      >
    </output>
  </div>
  <input
    id="servings-range"
    class="range"
    type="range"
    min={MIN}
    max={MAX}
    step="1"
    value={count}
    oninput={onInput}
    aria-label={t('servings', $locale)}
  />
  <div class="ticks" aria-hidden="true">
    <span>{MIN}</span>
    <span>{MAX}</span>
  </div>
</section>

<style>
  .scaler {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    background: var(--surface);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  h2 {
    margin: 0;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .value {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }
  .num {
    font-size: 1.8rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .unit {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .range {
    width: 100%;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .ticks {
    display: flex;
    justify-content: space-between;
    margin-top: 0.25rem;
    font-size: 0.72rem;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
</style>
