<script lang="ts">
  // The shopping-list view of the recipe. It is an island (not static markup)
  // because the amounts scale live with the servings slider, and the optional
  // groups reflect the fruit/topping choices made in the Customize tab — both
  // via the shared store.
  import { onMount } from 'svelte';
  import {
    servingsFactor,
    selectedOptional,
    locale,
    initStore,
    defaultSelected,
  } from './RecipeStore';
  import { t } from '../lib/i18n';
  import { formatAmount } from '../lib/units';
  import NextTab from './NextTab.svelte';
  import type { ResolvedIngredient, ResolvedRecipe } from '../lib/types';

  let { recipe }: { recipe: ResolvedRecipe } = $props();

  // `recipe` is a static prop; deriving keeps Svelte from warning that a plain
  // `const` would not track it.
  const defaults = $derived(defaultSelected(recipe));

  // SSR renders the recipe's defaults; after hydration the shared store drives
  // both the scale factor and which optional ingredients are selected.
  let mounted = $state(false);
  onMount(() => {
    initStore(recipe);
    mounted = true;
  });

  const factor = $derived(mounted ? $servingsFactor : 1);
  const selected = $derived(mounted ? $selectedOptional : defaults);

  // Each optional category narrowed to its currently-selected ingredients
  // (kept in recipe order). Categories with nothing selected are dropped.
  const activeCategories = $derived(
    recipe.optionalCategories
      .map((category) => ({
        id: category.id,
        label: category.label,
        ingredients: category.ingredients.filter((ingredient) =>
          (selected[category.id] ?? []).includes(ingredient.id),
        ),
      }))
      .filter((category) => category.ingredients.length > 0),
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
    {#each activeCategories as category (category.id)}
      {@render group(category.label[$locale], category.ingredients)}
    {/each}
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
