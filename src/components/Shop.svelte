<script lang="ts">
  // The Shop stage — the list is ERRANDS (Q15, #12): rows group store-first
  // (Order ahead / Your supermarket / Specialty shop, errand order), each
  // store keeping its own section walk IN THE VIEWER'S LOCALE (#5). Store
  // geography is per-locale data on the ingredient (`aisle`): the same list
  // re-groups when the locale flips — dark soy is a specialty errand for a
  // US shopper and an ordinary condiments-aisle row for a Chinese one. Rows
  // merge by ingredient id. A REAL ingredient with no aisle at all is NOT
  // bought (tap water): it never appears here, while staying a real
  // ingredient in Cook and the nutrition math — but a PLACEHOLDER (missing
  // or typo'd ingredient data) is aisle-less too, and that one must stay
  // visible: it files under the primary store's "other" section rather than
  // silently dropping off the list. When the single errand is the primary
  // store, its heading is dropped — one store is just "the list"; a lone
  // online or specialty errand keeps its heading (for order-ahead it IS the
  // lead-time signal).
  import { onMount } from 'svelte';
  import { locale } from './LocaleStore';
  import { params, resolved, resolveBundle, initRecipe } from './RecipeStore';
  import { t, STORES, STORE_SECTIONS } from '../lib/i18n';
  import type { RecipeBundle } from '../lib/recipe/types';
  import type { AislePlacement, Locale, Localized, Store, StoreSection } from '../lib/types';

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
    placeholder: boolean;
  }
  interface Section {
    id: StoreSection;
    label: Localized;
    lines: Line[];
  }
  interface Errand {
    id: Store;
    label: Localized;
    sections: Section[];
  }

  function placementOf(id: string, loc: Locale): AislePlacement | null {
    return bundle.ingredients[id]?.data.aisle?.[loc] ?? null;
  }

  // Merge rows by ingredient id (one shopping line per food), group by the
  // viewer locale's store in errand order, then by section in store-walk
  // order within each store. Aisle-less foods are not bought — skipped.
  const errands = $derived.by<Errand[]>(() => {
    const merged = new Map<string, Line>();
    for (const r of current.rows) {
      const existing = merged.get(r.id);
      if (existing) existing.grams += r.grams;
      else
        merged.set(r.id, {
          id: r.id,
          names: r.names,
          grams: r.grams,
          placeholder: r.placeholder,
        });
    }
    const byStore = new Map<Store, Map<StoreSection, Line[]>>();
    for (const line of merged.values()) {
      const placement =
        placementOf(line.id, $locale) ??
        // Missing ingredient data must not read as "deliberately not bought":
        // surface the row under primary/other so the shopper still sees it.
        (line.placeholder ? { store: 'primary' as const, section: 'other' as const } : null);
      if (!placement) continue; // a real, aisle-less food is not bought (e.g. water)
      const bySection = byStore.get(placement.store) ?? new Map<StoreSection, Line[]>();
      byStore.set(placement.store, bySection);
      const lines = bySection.get(placement.section);
      if (lines) lines.push(line);
      else bySection.set(placement.section, [line]);
    }
    return STORES.flatMap(({ id, label }) => {
      const bySection = byStore.get(id);
      if (!bySection) return [];
      const sections = STORE_SECTIONS.flatMap(({ id: sid, label: slabel }) => {
        const lines = bySection.get(sid);
        return lines ? [{ id: sid, label: slabel, lines }] : [];
      });
      return [{ id, label, sections }];
    });
  });

  let checked = $state<Record<string, boolean>>({});
  const toggle = (id: string) => (checked = { ...checked, [id]: !checked[id] });
</script>

<section class="shop" aria-label={t('shopStage', $locale)}>
  <p class="hint">{t('shopHint', $locale)}</p>
  <div class="errands">
    {#each errands as errand (errand.id)}
      <div class="store">
        {#if errands.length > 1 || errand.id !== 'primary'}
          <h3 class="store-head">{L(errand.label)}</h3>
        {/if}
        <div class="sections">
          {#each errand.sections as section (section.id)}
            <div class="aisle">
              <h4>{L(section.label)}</h4>
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
      </div>
    {/each}
  </div>
</section>

<style>
  .shop { display: grid; gap: 0.6rem; }
  .hint { margin: 0; font-size: 0.85rem; color: var(--ink-soft); }
  .errands { display: grid; gap: 1.2rem; }
  .store-head { margin: 0 0 0.6rem; font-size: 0.95rem; font-weight: 700; letter-spacing: -0.01em; padding-bottom: 0.35rem; border-bottom: 2px solid var(--line); }
  .sections { display: grid; gap: 0.9rem; }
  .aisle h4 { margin: 0 0 0.4rem; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
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
