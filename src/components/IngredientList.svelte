<script lang="ts">
  // The shopping-list view of the recipe. It is an island (not static markup)
  // because the amounts scale live with the servings slider, and the optional
  // groups reflect the fruit/topping choices made in the Customize tab — both
  // via the shared store.
  import { onMount } from 'svelte';
  import {
    servingsFactor,
    selectedFruits,
    selectedToppings,
    locale,
    initStore,
  } from './RecipeStore';
  import { t } from '../lib/i18n';
  import { formatAmount } from '../lib/units';
  import NextTab from './NextTab.svelte';
  import type { ResolvedIngredient, ResolvedRecipe } from '../lib/types';

  let { recipe }: { recipe: ResolvedRecipe } = $props();

  const defaultFruitIds = recipe.fruits
    .filter((f) => f.selectedByDefault)
    .map((f) => f.id);
  const defaultToppingIds = recipe.toppings
    .filter((tp) => tp.selectedByDefault)
    .map((tp) => tp.id);

  // SSR renders the recipe's defaults; after hydration the shared store drives
  // both the scale factor and which optional ingredients are selected.
  let mounted = $state(false);
  onMount(() => {
    initStore({
      servingsDefault: recipe.servingsDefault,
      defaultFruitIds,
      defaultToppingIds,
    });
    mounted = true;
  });

  const factor = $derived(mounted ? $servingsFactor : 1);
  const activeFruitIds = $derived(mounted ? $selectedFruits : defaultFruitIds);
  const activeToppingIds = $derived(mounted ? $selectedToppings : defaultToppingIds);

  // Optional ingredients, filtered to the current selection but kept in recipe
  // order. Base ingredients are always present.
  const fruits = $derived(
    recipe.fruits.filter((f) => activeFruitIds.includes(f.id)),
  );
  const toppings = $derived(
    recipe.toppings.filter((tp) => activeToppingIds.includes(tp.id)),
  );
</script>

{#snippet item(ing: ResolvedIngredient)}
  <li class="ing">
    <div class="ing-head">
      <span class="ing-name">{ing.names[$locale]}</span>
      <span class="ing-amount">
        {formatAmount(
          ing.amount * factor,
          ing.unit,
          ing.volumeMl === null ? null : ing.volumeMl * factor,
          $locale,
        )}
      </span>
    </div>
    <p class="ing-note">{ing.notes[$locale]}</p>
    {#if ing.warnings.length > 0}
      <ul class="warnings">
        {#each ing.warnings as w (w.en)}
          <li class="warning {w.type}">{w[$locale]}</li>
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

{#snippet group(title: string, items: ResolvedIngredient[])}
  <div class="ing-group">
    <h3 class="subhead">{title}</h3>
    <ul class="ing-list">
      {#each items as ing (ing.id)}
        {@render item(ing)}
      {/each}
    </ul>
  </div>
{/snippet}

<section class="ingredients" aria-labelledby="ingredients-heading">
  <h2 id="ingredients-heading">{t('ingredients', $locale)}</h2>
  <div class="groups">
    {@render group(t('base', $locale), recipe.baseIngredients)}
    {#if fruits.length > 0}
      {@render group(t('fruits', $locale), fruits)}
    {/if}
    {#if toppings.length > 0}
      {@render group(t('toppings', $locale), toppings)}
    {/if}
  </div>
  <NextTab from="recipe" />
</section>

<style>
  .ingredients {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.25rem;
    background: var(--surface);
  }
  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.15rem;
  }
  .groups {
    display: grid;
    gap: 1.1rem;
  }
  .subhead {
    margin: 0 0 0.5rem;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .ing-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.85rem;
  }
  .ing {
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.85rem;
  }
  .ing:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .ing-head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: baseline;
  }
  .ing-name {
    font-weight: 600;
  }
  .ing-amount {
    flex: none;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .ing-note {
    margin: 0.2rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
  .warnings {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  .warning {
    font-size: 0.85rem;
    padding: 0.35rem 0.6rem;
    border-radius: 8px;
  }
  .warning.avoid {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .warning.good {
    background: var(--good-soft);
    color: var(--good);
  }
</style>
