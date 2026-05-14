<script lang="ts">
  import { onMount } from 'svelte';
  import {
    servingsFactor,
    selectedFruits,
    selectedToppings,
    servings,
    locale,
    initStore,
  } from './RecipeStore';
  import {
    NUTRIENT_UNITS,
    scaleNutrition,
    sumNutrition,
    totalWeight,
    pct,
    fmt,
  } from '../lib/nutrition';
  import { NUTRIENT_LABELS, t } from '../lib/i18n';
  import type {
    NutrientKey,
    NutritionFacts,
    ResolvedRecipe,
    Locale,
  } from '../lib/types';

  let { recipe }: { recipe: ResolvedRecipe } = $props();

  // --- hydration bridge -----------------------------------------------------
  // SSR renders this panel with the recipe's default servings and default
  // ingredient selections; after hydration the shared stores take over.
  const defaultFruitIds = recipe.fruits
    .filter((f) => f.selectedByDefault)
    .map((f) => f.id);
  const defaultToppingIds = recipe.toppings
    .filter((tp) => tp.selectedByDefault)
    .map((tp) => tp.id);

  let mounted = $state(false);
  onMount(() => {
    initStore({
      servingsDefault: recipe.servingsDefault,
      defaultFruitIds,
      defaultToppingIds,
    });
    mounted = true;
  });

  // The panel shows per-serving nutrition by default. The "× N" toggle
  // multiplies everything by the chosen number of servings (the whole recipe).
  let showTotal = $state(false);
  const perServingFactor = 1 / recipe.servingsDefault;
  const factor = $derived.by(() => {
    if (!showTotal) return perServingFactor;
    return mounted ? $servingsFactor : 1;
  });
  const activeFruitIds = $derived(mounted ? $selectedFruits : defaultFruitIds);
  const activeToppingIds = $derived(mounted ? $selectedToppings : defaultToppingIds);
  const servingCount = $derived(mounted ? $servings : recipe.servingsDefault);

  // --- colour assignment ----------------------------------------------------
  const PALETTE = [
    '#e8743b',
    '#19a979',
    '#945ecf',
    '#13a4b4',
    '#525df4',
    '#bf399e',
    '#6c8893',
    '#ee6868',
    '#2f6497',
  ];
  const colourOf = new Map<string, string>(
    recipe.allIngredients.map((ing, i) => [ing.id, PALETTE[i % PALETTE.length] ?? '#888888']),
  );

  // --- the live ingredient set ----------------------------------------------
  interface ActiveIngredient {
    id: string;
    names: Record<Locale, string>;
    colour: string;
    grams: number;
    nutrition: NutritionFacts;
  }

  const activeIngredients = $derived.by<ActiveIngredient[]>(() => {
    const fruitSet = new Set(activeFruitIds);
    const toppingSet = new Set(activeToppingIds);
    const chosen = [
      ...recipe.baseIngredients,
      ...recipe.fruits.filter((f) => fruitSet.has(f.id)),
      ...recipe.toppings.filter((tp) => toppingSet.has(tp.id)),
    ];
    return chosen.map((ing) => ({
      id: ing.id,
      names: ing.names,
      colour: colourOf.get(ing.id) ?? '#888888',
      grams: ing.grams * factor,
      nutrition: scaleNutrition(ing.nutrition, factor),
    }));
  });

  const totals = $derived(sumNutrition(activeIngredients));
  const totalGrams = $derived(totalWeight(activeIngredients));

  // --- FDA panel layout -----------------------------------------------------
  const ROWS: ReadonlyArray<{ key: NutrientKey; sub: boolean }> = [
    { key: 'fat', sub: false },
    { key: 'saturated_fat', sub: true },
    { key: 'trans_fat', sub: true },
    { key: 'cholesterol', sub: false },
    { key: 'sodium', sub: false },
    { key: 'carbohydrates', sub: false },
    { key: 'fiber', sub: true },
    { key: 'sugars', sub: true },
    { key: 'protein', sub: false },
  ];
  const MICROS: ReadonlyArray<NutrientKey> = ['calcium', 'iron'];
  const HIGHLIGHTS: ReadonlyArray<NutrientKey> = ['fiber', 'protein', 'calcium', 'iron'];

  // --- ingredient breakdown -------------------------------------------------
  let expanded = $state<NutrientKey | null>(null);
  function toggle(key: NutrientKey): void {
    expanded = expanded === key ? null : key;
  }

  interface Segment {
    id: string;
    names: Record<Locale, string>;
    colour: string;
    value: number;
    share: number;
  }

  function breakdown(key: NutrientKey): Segment[] {
    const raw = activeIngredients
      .map((ing) => ({
        id: ing.id,
        names: ing.names,
        colour: ing.colour,
        value: ing.nutrition[key],
      }))
      .filter((s) => s.value > 0.0001);
    const sum = raw.reduce((acc, s) => acc + s.value, 0);
    return raw
      .map((s) => ({ ...s, share: sum > 0 ? (s.value / sum) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }

  function dvLabel(key: NutrientKey, value: number): string {
    const p = pct(key, value);
    return p === null ? '' : `${p}%`;
  }
</script>

<section class="panel" aria-labelledby="nutrition-heading">
  <header class="head">
    <div class="head-row">
      <h2 id="nutrition-heading">{t('nutritionFacts', $locale)}</h2>
      <button
        type="button"
        class="scale-toggle"
        class:on={showTotal}
        aria-pressed={showTotal}
        aria-label={t('scaleToggle', $locale)}
        disabled={servingCount === 1}
        onclick={() => (showTotal = !showTotal)}
      >
        × {servingCount}
      </button>
    </div>
    <p class="serving-line">
      {#if showTotal}
        {servingCount}
        {servingCount === 1 ? t('serving', $locale) : t('servingsPlural', $locale)}
        <span aria-hidden="true">·</span>
        {fmt(totalGrams)}g {t('totalWord', $locale)}
      {:else}
        {t('perServing', $locale)}
        <span aria-hidden="true">·</span>
        {fmt(totalGrams)}g
      {/if}
    </p>
  </header>

  <div class="calories-row">
    <span class="cal-label">{t('calories', $locale)}</span>
    <span class="cal-value">{fmt(totals.calories, 'calories')}</span>
  </div>

  <p class="dv-head">{t('dailyValue', $locale)}</p>

  <table class="facts">
    <tbody>
      {#each ROWS as row (row.key)}
        {@const open = expanded === row.key}
        {@const dv = dvLabel(row.key, totals[row.key])}
        <tr class="fact" class:sub={row.sub} class:open>
          <td class="cell">
            <button
              type="button"
              class="rowbtn"
              aria-expanded={open}
              onclick={() => toggle(row.key)}
            >
              <span class="nutrient">
                <span class="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                <span class="nlabel" class:bold={!row.sub}>
                  {NUTRIENT_LABELS[row.key][$locale]}
                </span>
                <span class="amount">
                  {fmt(totals[row.key], row.key)}{NUTRIENT_UNITS[row.key]}
                </span>
              </span>
              <span class="dv">{dv}</span>
            </button>
          </td>
        </tr>
        {#if open}
          {@const segs = breakdown(row.key)}
          <tr class="breakdown-row">
            <td>
              {#if segs.length > 0}
                <div
                  class="bar"
                  role="img"
                  aria-label={`${NUTRIENT_LABELS[row.key][$locale]} ${t('breakdownHint', $locale)}`}
                >
                  {#each segs as seg (seg.id)}
                    <span
                      class="seg"
                      style:width={`${seg.share}%`}
                      style:background={seg.colour}
                      title={seg.names[$locale]}
                    ></span>
                  {/each}
                </div>
                <ul class="legend">
                  {#each segs as seg (seg.id)}
                    <li>
                      <span class="swatch" style:background={seg.colour}></span>
                      <span class="lname">{seg.names[$locale]}</span>
                      <span class="lval">
                        {fmt(seg.value, row.key)}{NUTRIENT_UNITS[row.key]}
                        <span class="lshare">({Math.round(seg.share)}%)</span>
                      </span>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty">—</p>
              {/if}
            </td>
          </tr>
        {/if}
      {/each}

      {#each MICROS as key (key)}
        {@const open = expanded === key}
        <tr class="fact micro" class:open>
          <td class="cell">
            <button
              type="button"
              class="rowbtn"
              aria-expanded={open}
              onclick={() => toggle(key)}
            >
              <span class="nutrient">
                <span class="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                <span class="nlabel">{NUTRIENT_LABELS[key][$locale]}</span>
                <span class="amount">{fmt(totals[key], key)}{NUTRIENT_UNITS[key]}</span>
              </span>
              <span class="dv">{dvLabel(key, totals[key])}</span>
            </button>
          </td>
        </tr>
        {#if open}
          {@const segs = breakdown(key)}
          <tr class="breakdown-row">
            <td>
              {#if segs.length > 0}
                <div class="bar" role="img" aria-label={NUTRIENT_LABELS[key][$locale]}>
                  {#each segs as seg (seg.id)}
                    <span
                      class="seg"
                      style:width={`${seg.share}%`}
                      style:background={seg.colour}
                      title={seg.names[$locale]}
                    ></span>
                  {/each}
                </div>
                <ul class="legend">
                  {#each segs as seg (seg.id)}
                    <li>
                      <span class="swatch" style:background={seg.colour}></span>
                      <span class="lname">{seg.names[$locale]}</span>
                      <span class="lval">
                        {fmt(seg.value, key)}{NUTRIENT_UNITS[key]}
                        <span class="lshare">({Math.round(seg.share)}%)</span>
                      </span>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty">—</p>
              {/if}
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>

  <p class="footnote">{t('dvFootnote', $locale)}</p>
  <p class="footnote disclaimer">{t('dataDisclaimer', $locale)}</p>
  <p class="hint">{t('breakdownHint', $locale)}</p>

  <section class="highlights" aria-label={t('highlights', $locale)}>
    <h3>{t('highlights', $locale)}</h3>
    <div class="grid">
      {#each HIGHLIGHTS as key (key)}
        {@const p = pct(key, totals[key])}
        <div class="hcard">
          <span class="hlabel">{NUTRIENT_LABELS[key][$locale]}</span>
          <span class="hvalue">{fmt(totals[key], key)}{NUTRIENT_UNITS[key]}</span>
          {#if p !== null}
            <span class="hdv">{p}% {t('dailyValue', $locale).replace('*', '')}</span>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</section>

<style>
  .panel {
    border: 2px solid var(--ink);
    border-radius: 8px;
    padding: 1rem 1.1rem 1.25rem;
    background: var(--surface);
    font-variant-numeric: tabular-nums;
  }
  .head-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .head h2 {
    margin: 0;
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .scale-toggle {
    flex: none;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: 0.3rem 0.75rem;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .scale-toggle:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .scale-toggle.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .scale-toggle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .serving-line {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
  .calories-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 8px solid var(--ink);
    border-bottom: 4px solid var(--ink);
    margin-top: 0.5rem;
    padding: 0.25rem 0;
  }
  .cal-label {
    font-size: 1.4rem;
    font-weight: 800;
  }
  .cal-value {
    font-size: 2rem;
    font-weight: 800;
  }
  .dv-head {
    margin: 0;
    padding: 0.2rem 0;
    text-align: right;
    font-size: 0.8rem;
    font-weight: 700;
    border-bottom: 1px solid var(--ink);
  }
  .facts {
    width: 100%;
    border-collapse: collapse;
  }
  .fact > .cell {
    padding: 0;
    border-bottom: 1px solid var(--line);
  }
  .rowbtn {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font: inherit;
    color: var(--ink);
    text-align: left;
  }
  .rowbtn:hover {
    background: var(--accent-soft);
  }
  .nutrient {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .caret {
    color: var(--ink-soft);
    font-size: 0.7rem;
  }
  .nlabel.bold {
    font-weight: 700;
  }
  .fact.sub .nutrient {
    padding-left: 1rem;
  }
  .amount {
    color: var(--ink);
  }
  .dv {
    font-weight: 700;
  }
  .breakdown-row td {
    padding: 0.5rem 0.1rem 0.85rem;
    border-bottom: 1px solid var(--line);
  }
  .bar {
    display: flex;
    height: 1.4rem;
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg);
  }
  .seg {
    height: 100%;
    min-width: 2px;
  }
  .legend {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .swatch {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 3px;
    flex: none;
  }
  .lname {
    flex: 1;
  }
  .lval {
    color: var(--ink-soft);
  }
  .lshare {
    color: var(--ink-soft);
  }
  .empty {
    margin: 0;
    color: var(--ink-soft);
  }
  .micro > .cell {
    border-bottom: 1px solid var(--line);
  }
  .footnote {
    margin: 0.6rem 0 0;
    font-size: 0.72rem;
    color: var(--ink-soft);
    line-height: 1.4;
  }
  .disclaimer {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  .hint {
    margin: 0.35rem 0 0;
    font-size: 0.8rem;
    color: var(--accent);
  }
  .highlights {
    margin-top: 1rem;
  }
  .highlights h3 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .hcard {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
  }
  .hlabel {
    font-size: 0.78rem;
    color: var(--ink-soft);
  }
  .hvalue {
    font-size: 1.3rem;
    font-weight: 700;
  }
  .hdv {
    font-size: 0.75rem;
    color: var(--accent);
  }
  @media (min-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
