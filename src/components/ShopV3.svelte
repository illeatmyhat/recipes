<script lang="ts">
  // The Shop stage — shopping list grouped by supermarket section IN THE
  // VIEWER'S LOCALE (#5). Store geography is per-locale data on the
  // ingredient (`aisle`): the same list re-groups when the locale flips —
  // tofu files under Dairy & eggs for a US shopper and under 豆腐・大豆製品
  // for a Japanese one. Rows merge by ingredient id; sections render in
  // store-walk order (STORE_SECTIONS); ingredients without aisle data fall
  // back to "other".
  import { onMount } from 'svelte';
  import { locale } from './RecipeStore';
  import { params, resolved, resolveBundle, initV3 } from './RecipeStoreV3';
  import { t, STORE_SECTIONS } from '../lib/i18n';
  import type { RecipeBundle } from '../lib/v3/types';
  import type { Locale, Localized, StoreSection } from '../lib/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initV3(bundle);
    mounted = true;
  });

  const ssr = resolveBundle(bundle, bundle.defaults);
  const current = $derived(mounted ? ($resolved ?? ssr) : ssr);
  const L = (s: Localized): string => s[$locale];

  interface Line {
    id: string;
    names: Localized;
    grams: number;
  }
  interface Section {
    id: StoreSection;
    label: Localized;
    lines: Line[];
  }

  function sectionOf(id: string, loc: Locale): StoreSection {
    return bundle.ingredients[id]?.data.aisle?.[loc] ?? 'other';
  }

  // Merge rows by ingredient id (one shopping line per food), then group by
  // the viewer locale's aisle, in store-walk order.
  const sections = $derived.by<Section[]>(() => {
    const merged = new Map<string, Line>();
    for (const r of current.rows) {
      const existing = merged.get(r.id);
      if (existing) existing.grams += r.grams;
      else merged.set(r.id, { id: r.id, names: r.names, grams: r.grams });
    }
    const bySection = new Map<StoreSection, Line[]>();
    for (const line of merged.values()) {
      const section = sectionOf(line.id, $locale);
      const lines = bySection.get(section);
      if (lines) lines.push(line);
      else bySection.set(section, [line]);
    }
    return STORE_SECTIONS.flatMap(({ id, label }) => {
      const lines = bySection.get(id);
      return lines ? [{ id, label, lines }] : [];
    });
  });

  let checked = $state<Record<string, boolean>>({});
  const toggle = (id: string) => (checked = { ...checked, [id]: !checked[id] });
</script>

<section class="shop" aria-label={t('shopStage', $locale)}>
  <p class="hint">{t('shopHint', $locale)}</p>
  <div class="sections">
    {#each sections as section (section.id)}
      <div class="aisle">
        <h3>{L(section.label)}</h3>
        <ul class="list">
          {#each section.lines as line (line.id)}
            {@const on = checked[line.id] === true}
            <li>
              <button type="button" class="row" class:on aria-pressed={on} onclick={() => toggle(line.id)}>
                <span class="check" aria-hidden="true">{on ? '✓' : ''}</span>
                <span class="name">{L(line.names)}</span>
                <span class="amt">{Math.round(line.grams)} g</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</section>

<style>
  .shop { display: grid; gap: 0.6rem; }
  .hint { margin: 0; font-size: 0.85rem; color: var(--ink-soft); }
  .sections { display: grid; gap: 0.9rem; }
  .aisle h3 { margin: 0 0 0.4rem; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .row { display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left; padding: 0.6rem 0.8rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); cursor: pointer; font: inherit; color: var(--ink); }
  .row.on { border-color: var(--pick); background: var(--pick-soft); }
  .check { flex: none; width: 1.3rem; height: 1.3rem; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 5px; background: var(--surface); font-weight: 700; color: var(--on-accent); }
  .row.on .check { background: var(--pick); border-color: var(--pick); }
  .name { flex: 1; font-weight: 600; }
  .amt { color: var(--ink-soft); font-variant-numeric: tabular-nums; }
</style>
