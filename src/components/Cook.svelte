<script lang="ts">
  // The Cook stage — true by-step mise en place (#10). Ingredients are
  // bucketed by the step that reads them (bundle.steps, extracted from the
  // method's <Step>/<Ref> markup at build), answering "what do I gather
  // before I start?" alongside the method's "what do I do". Guard-hidden
  // steps drop their buckets; numbering counts every visible step so the
  // buckets match the method's numbers; an ingredient read by two steps
  // appears under each (correct for mise en place — reads don't own
  // quantity, so nutrition is untouched).
  import { onMount } from 'svelte';
  import { locale } from './LocaleStore';
  import { params, resolved, resolveDefaults, initRecipe } from './RecipeStore';
  import { evalGuard } from '../lib/recipe/guards';
  import { t } from '../lib/i18n';
  import { humanizeId, localizeAll } from '../lib/recipe/names';
  import { mergeRowsById, type MergedRow } from '../lib/recipe/resolve';
  import type { Params, RecipeBundle, Resolved, ResolvedRow } from '../lib/recipe/types';
  import type { Localized } from '../lib/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initRecipe(bundle);
    mounted = true;
  });

  const ssr = resolveDefaults(bundle);
  const current = $derived(mounted ? ($resolved ?? ssr) : ssr);
  const currentParams = $derived(mounted ? $params : bundle.defaults);
  const L = (s: Localized): string => s[$locale];

  interface Bucket {
    stepId: string;
    number: number;
    title: Localized;
    rows: MergedRow[];
  }

  function bucketsFor(p: Params, res: Resolved): Bucket[] {
    const out: Bucket[] = [];
    let number = 0;
    for (const step of bundle.steps) {
      if (step.when !== undefined && !evalGuard(step.when, p)) continue;
      number += 1; // every visible step counts, so numbers match the method
      // Collect the step's read declarations (deduped — a step may read a
      // role twice via role- and fill-level refs), then merge by ingredient:
      // two roles sharing a fill are one pile on the counter.
      const decls: ResolvedRow[] = [];
      const seen = new Set<string>(); // "role:id" declarations already counted
      for (const read of step.reads) {
        for (const r of res.rows) {
          if (r.role !== read.role) continue;
          if (read.fill !== undefined && r.id !== read.fill) continue;
          const pair = `${r.role}:${r.id}`;
          if (seen.has(pair)) continue;
          seen.add(pair);
          decls.push(r);
        }
      }
      const rows = mergeRowsById(decls);
      if (rows.length === 0) continue; // nothing to gather for this step
      out.push({
        stepId: step.id,
        number,
        title: step.title ?? localizeAll(humanizeId(step.id)),
        rows,
      });
    }
    return out;
  }

  const buckets = $derived(bucketsFor(currentParams, current));
</script>

<section class="cook" aria-label={t('miseEnPlace', $locale)}>
  <p class="hint">{t('miseHint', $locale)}</p>
  <div class="groups">
    {#each buckets as b (b.stepId)}
      <div class="group">
        <h3><span class="num">{b.number}</span>{L(b.title)}</h3>
        <ul>
          {#each b.rows as row (row.id)}
            <li><span class="name">{L(row.names)}</span><span class="amt">{Math.round(row.grams)} g</span></li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</section>

<style>
  .cook { display: grid; gap: 0.6rem; }
  .hint { margin: 0; font-size: 0.85rem; color: var(--ink-soft); }
  .groups { display: grid; gap: 0.9rem; }
  .group h3 { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.4rem; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
  .num { display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border: 1px solid var(--line); border-radius: 50%; font-size: 0.72rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; flex: none; }
  .group ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .group li { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.4rem 0.7rem; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); }
  .name { font-weight: 600; }
  .amt { color: var(--ink-soft); font-variant-numeric: tabular-nums; }
</style>
