<script lang="ts">
  // The Shop stage — by-ingredient shopping list with tick-off. First pass:
  // merged by ingredient id, flat. Per-locale aisle grouping arrives with #5
  // (needs the DB `aisle` field).
  import { onMount } from 'svelte';
  import { locale } from './RecipeStore';
  import { params, resolved, resolveBundle, initV3 } from './RecipeStoreV3';
  import { t } from '../lib/i18n';
  import type { RecipeBundle } from '../lib/v3/types';
  import type { Localized } from '../lib/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initV3(bundle);
    mounted = true;
  });

  const ssr = resolveBundle(bundle, bundle.defaults);
  const current = $derived(mounted ? ($resolved ?? ssr) : ssr);
  const L = (s: Localized): string => s[$locale];

  // Merge rows by ingredient id (one shopping line per food).
  interface Line { id: string; names: Localized; grams: number; }
  const lines = $derived.by<Line[]>(() => {
    const map = new Map<string, Line>();
    for (const r of current.rows) {
      const existing = map.get(r.id);
      if (existing) existing.grams += r.grams;
      else map.set(r.id, { id: r.id, names: r.names, grams: r.grams });
    }
    return [...map.values()];
  });

  let checked = $state<Record<string, boolean>>({});
  const toggle = (id: string) => (checked = { ...checked, [id]: !checked[id] });
</script>

<section class="shop" aria-label={t('shopStage', $locale)}>
  <p class="hint">{t('shopHint', $locale)}</p>
  <ul class="list">
    {#each lines as line (line.id)}
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
</section>

<style>
  .shop { display: grid; gap: 0.6rem; }
  .hint { margin: 0; font-size: 0.85rem; color: var(--ink-soft); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .row { display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left; padding: 0.6rem 0.8rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); cursor: pointer; font: inherit; color: var(--ink); }
  .row.on { border-color: var(--pick); background: var(--pick-soft); }
  .check { flex: none; width: 1.3rem; height: 1.3rem; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 5px; background: var(--surface); font-weight: 700; color: var(--on-accent); }
  .row.on .check { background: var(--pick); border-color: var(--pick); }
  .name { flex: 1; font-weight: 600; }
  .amt { color: var(--ink-soft); font-variant-numeric: tabular-nums; }
</style>
