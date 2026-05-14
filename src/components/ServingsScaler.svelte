<script lang="ts">
  import { onMount } from 'svelte';
  import { servings, locale, initStore } from './RecipeStore';
  import { t } from '../lib/i18n';
  import type { ResolvedRecipe } from '../lib/types';

  let { recipe }: { recipe: ResolvedRecipe } = $props();

  // Discrete serving sizes — picking one scales every amount, weight, and
  // nutrient value across the page via the shared `servings` store.
  const OPTIONS = [1, 2, 3, 5] as const;

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

  function choose(n: number): void {
    servings.set(n);
  }
</script>

<section class="scaler" aria-labelledby="scaler-heading">
  <h2 id="scaler-heading">{t('servings', $locale)}</h2>
  <div class="control" role="group" aria-label={t('servings', $locale)}>
    {#each OPTIONS as n (n)}
      <button
        type="button"
        class="opt"
        class:on={count === n}
        aria-pressed={count === n}
        onclick={() => choose(n)}
      >
        {n}
      </button>
    {/each}
  </div>
  <p class="caption" aria-live="polite">
    {count === 1 ? t('serving', $locale) : t('servingsPlural', $locale)}
  </p>
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
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.4rem;
  }
  .opt {
    padding: 0.7rem 0;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--bg);
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .opt:hover:not(.on) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .opt.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .caption {
    margin: 0.6rem 0 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
