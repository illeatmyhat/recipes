<script lang="ts">
  // The shopping-list view of the recipe. It is an island (not static markup)
  // because the amounts scale live with the servings slider, and the optional
  // groups reflect the fruit/topping choices made in the Customize tab — both
  // via the shared store.
  //
  // It also has a self-contained "shopping list" mode: a toggle turns every
  // ingredient row into a tick-off card. That state is purely local — it is
  // not shared with other islands and is not persisted.
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
  import type { Localized, ResolvedIngredient, ResolvedRecipe } from '../lib/types';

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

  // Base ingredients partitioned into their optional sub-groups, preserving
  // recipe order. A `null` label is the generic "Base" bucket — used for any
  // ungrouped ingredient, and the only bucket when the recipe sets no groups
  // (so older recipes render exactly as before, under one "Base" heading).
  const baseGroups = $derived.by(() => {
    const groups: { key: string; label: Localized | null; items: ResolvedIngredient[] }[] = [];
    const byKey = new Map<string, number>();
    for (const ing of recipe.baseIngredients) {
      const key = ing.group ? ing.group.en : '';
      let i = byKey.get(key);
      if (i === undefined) {
        i = groups.length;
        byKey.set(key, i);
        groups.push({ key, label: ing.group, items: [] });
      }
      groups[i].items.push(ing);
    }
    return groups;
  });

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

  // --- shopping-list mode ---------------------------------------------------
  // `shopping` flips the list into tick-off mode; `checked` records which
  // ingredient ids have been ticked. Both are local, in-memory state — a row
  // stays ticked while you scale servings or change optional ingredients, and
  // a reload clears it.
  let shopping = $state(false);
  let checked = $state<Record<string, boolean>>({});

  function toggleChecked(id: string): void {
    checked = { ...checked, [id]: !checked[id] };
  }
</script>

{#snippet body(ing: ResolvedIngredient)}
  <span class="ing-head">
    <span class="ing-name">{ing.names[$locale]}</span>
    <span class="ing-amount">
      {formatAmount(
        ing.amount * factor,
        ing.unit,
        ing.volumeMl === null ? null : ing.volumeMl * factor,
        $locale,
      )}
    </span>
  </span>
  <span class="ing-note">{ing.notes[$locale]}</span>
  {#if ing.warnings.length > 0}
    <span class="warnings">
      {#each ing.warnings as w (w.en)}
        <span class="warning {w.type}">{w[$locale]}</span>
      {/each}
    </span>
  {/if}
{/snippet}

{#snippet item(ing: ResolvedIngredient)}
  {#if shopping}
    {@const on = checked[ing.id] === true}
    <li class="ing shop" class:checked={on}>
      <button
        type="button"
        class="ing-btn"
        aria-pressed={on}
        onclick={() => toggleChecked(ing.id)}
      >
        <span class="ing-check" aria-hidden="true">{on ? '✓' : ''}</span>
        <span class="ing-main">{@render body(ing)}</span>
      </button>
    </li>
  {:else}
    <li class="ing">{@render body(ing)}</li>
  {/if}
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
  <div class="ing-top">
    <h2 id="ingredients-heading">{t('ingredients', $locale)}</h2>
    <button
      type="button"
      class="shop-toggle"
      class:on={shopping}
      aria-pressed={shopping}
      onclick={() => (shopping = !shopping)}
    >
      {t('shoppingList', $locale)}
    </button>
  </div>
  <div class="groups">
    {#each baseGroups as g (g.key)}
      {@render group(g.label ? g.label[$locale] : t('base', $locale), g.items)}
    {/each}
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
  .ing-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  /* The shopping-mode toggle. Its "on" state borrows --pick — the same colour
     that highlights a ticked row — so the control and its effect read as one. */
  .shop-toggle {
    flex: none;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    color: var(--ink-soft);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.35rem 0.8rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .shop-toggle:hover {
    color: var(--ink);
  }
  .shop-toggle.on {
    background: var(--pick);
    color: var(--on-accent);
    border-color: var(--pick);
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
  /* Shopping mode: the row's <li> stops being a divider and the inner <button>
     becomes the tick-off card. */
  .ing.shop {
    border-bottom: none;
    padding-bottom: 0;
  }
  .ing-btn {
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
    font: inherit;
    color: var(--ink);
    user-select: none;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .ing-btn:hover {
    border-color: var(--pick);
  }
  .ing.shop.checked .ing-btn {
    border-color: var(--pick);
    background: var(--pick-soft);
  }
  .ing-check {
    flex: none;
    width: 1.4rem;
    height: 1.4rem;
    margin-top: 0.1rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--on-accent);
  }
  .ing.shop.checked .ing-check {
    background: var(--pick);
    border-color: var(--pick);
  }
  .ing-main {
    flex: 1;
    min-width: 0;
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
    display: block;
    margin-top: 0.2rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
  .warnings {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.5rem;
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
