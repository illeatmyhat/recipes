<script lang="ts">
  import { onMount } from 'svelte';
  import {
    selectedOptional,
    servingsFactor,
    locale,
    toggleOptional,
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

  // Before hydration the panel reflects the recipe's default selections so the
  // static HTML matches what NutritionPanel pre-renders. Every island calls
  // initStore (it is idempotent) because client:visible means any island can
  // be the first to hydrate.
  let mounted = $state(false);
  onMount(() => {
    initStore(recipe);
    mounted = true;
  });

  const selected = $derived(mounted ? $selectedOptional : defaults);
  // Amounts scale live with the servings slider.
  const factor = $derived(mounted ? $servingsFactor : 1);

  // The heading: a recipe may supply its own phrasing ("Customize your bowl"),
  // otherwise fall back to the generic localized UI string.
  const heading = $derived(
    recipe.customizeTitle
      ? recipe.customizeTitle[$locale]
      : t('customizeTitle', $locale),
  );
</script>

{#snippet group(
  categoryId: string,
  title: string,
  items: ResolvedIngredient[],
  active: string[],
)}
  <fieldset class="group">
    <legend>
      {title}
      <span class="count">{active.length} {t('selected', $locale)}</span>
    </legend>
    <ul class="options">
      {#each items as item (item.id)}
        {@const on = active.includes(item.id)}
        <li>
          <button
            type="button"
            class="toggle"
            class:on
            aria-pressed={on}
            onclick={() => toggleOptional(categoryId, item.id)}
          >
            <span class="check" aria-hidden="true">{on ? '✓' : ''}</span>
            <span class="body">
              <span class="name">
                {item.names[$locale]}
                <span class="amount"
                  >{formatAmount(
                    item.amount * factor,
                    item.unit,
                    item.volumeMl === null ? null : item.volumeMl * factor,
                    $locale,
                  )}</span
                >
              </span>
              <span class="note">{item.notes[$locale]}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </fieldset>
{/snippet}

<section class="customize" aria-labelledby="customize-heading">
  <h2 id="customize-heading">{heading}</h2>
  <p class="hint">{t('customizeHint', $locale)}</p>
  {#each recipe.optionalCategories as category (category.id)}
    {@render group(
      category.id,
      category.label[$locale],
      category.ingredients,
      selected[category.id] ?? [],
    )}
  {/each}
  <NextTab from="customize" />
</section>

<style>
  .customize {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1.25rem;
    background: var(--surface);
  }
  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.15rem;
  }
  .hint {
    margin: 0 0 1rem;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }
  .group {
    border: none;
    padding: 0;
    margin: 0 0 1rem;
  }
  .group:last-child {
    margin-bottom: 0;
  }
  legend {
    padding: 0;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-bottom: 0.5rem;
  }
  .count {
    color: var(--accent);
    font-weight: 600;
  }
  .options {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .toggle {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    width: 100%;
    text-align: left;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--bg);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .toggle:hover {
    border-color: var(--accent);
  }
  .toggle.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .check {
    flex: none;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    color: var(--accent);
    font-weight: 700;
  }
  .toggle.on .check {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .name {
    font-weight: 600;
  }
  .amount {
    font-weight: 400;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
  .note {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
