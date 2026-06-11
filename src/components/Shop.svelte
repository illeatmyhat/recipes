<script lang="ts">
  // The Shop stage — shopping list grouped by supermarket section IN THE
  // VIEWER'S LOCALE (#5). Store geography is per-locale data on the
  // ingredient (`aisle`): the same list re-groups when the locale flips —
  // tofu files under Dairy & eggs for a US shopper and under 豆腐・大豆製品
  // for a Japanese one. Rows merge by ingredient id; sections render in
  // store-walk order (STORE_SECTIONS); ingredients without aisle data fall
  // back to "other".
  import { onMount } from 'svelte';
  import { locale } from './LocaleStore';
  import { params, resolved, resolveBundle, initRecipe } from './RecipeStore';
  import { t, STORE_SECTIONS } from '../lib/i18n';
  import type { RecipeBundle } from '../lib/recipe/types';
  import type { Locale, Localized, StoreSection } from '../lib/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initRecipe(bundle);
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
            {@const guidance = bundle.ingredients[line.id]?.data.availability?.[$locale]}
            {@const pinned = guidance?.notes?.filter((n) => n.important) ?? []}
            {@const rest = guidance?.notes?.filter((n) => !n.important) ?? []}
            {@const brands = guidance?.brands ?? []}
            <li>
              <button type="button" class="row" class:on aria-pressed={on} onclick={() => toggle(line.id)}>
                <span class="check" aria-hidden="true">{on ? '✓' : ''}</span>
                <span class="name">{L(line.names)}</span>
                <span class="amt">{Math.round(line.grams)} g</span>
              </button>
              <!-- Market guidance (viewer locale): important notes pin to the
                   row; the rest (and brands) wait behind a native disclosure
                   that only exists when there is more to reveal. -->
              {#each pinned as note (note.text)}
                <p class="warn">{note.text}</p>
              {/each}
              {#if rest.length > 0 || brands.length > 0}
                <details class="more">
                  <summary>{t('moreNotes', $locale)}</summary>
                  {#each rest as note (note.text)}
                    <p class="tip">{note.text}</p>
                  {/each}
                  {#if brands.length > 0}
                    <ul class="brands" aria-label={t('brandExamples', $locale)}>
                      {#each brands as brand (brand)}<li>{brand}</li>{/each}
                    </ul>
                  {/if}
                </details>
              {/if}
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
  .warn { margin: 0.25rem 0 0; padding-left: 0.8rem; font-size: 0.82rem; color: var(--accent); }
  .more { margin: 0.2rem 0 0; padding-left: 0.8rem; }
  .more summary { font-size: 0.78rem; color: var(--ink-soft); cursor: pointer; width: fit-content; }
  .more summary:hover { color: var(--ink); }
  .tip { margin: 0.3rem 0 0; font-size: 0.82rem; color: var(--ink-soft); }
  .brands { list-style: none; margin: 0.35rem 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .brands li { font-size: 0.75rem; padding: 0.15rem 0.55rem; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--ink-soft); }
</style>
