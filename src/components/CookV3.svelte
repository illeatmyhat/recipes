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
  import { locale } from './RecipeStore';
  import { params, resolved, resolveBundle, initV3 } from './RecipeStoreV3';
  import { evalGuard } from '../lib/v3/guards';
  import { t } from '../lib/i18n';
  import { localizeAll } from '../lib/v3/names';
  import type { Params, RecipeBundle, ResolvedV3 } from '../lib/v3/types';
  import type { Localized } from '../lib/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initV3(bundle);
    mounted = true;
  });

  const ssr = resolveBundle(bundle, bundle.defaults);
  const current = $derived(mounted ? ($resolved ?? ssr) : ssr);
  const currentParams = $derived(mounted ? $params : bundle.defaults);
  const L = (s: Localized): string => s[$locale];

  interface BucketRow {
    id: string;
    names: Localized;
    grams: number;
  }
  interface Bucket {
    stepId: string;
    number: number;
    title: Localized;
    rows: BucketRow[];
  }

  function bucketsFor(p: Params, res: ResolvedV3): Bucket[] {
    const out: Bucket[] = [];
    let number = 0;
    for (const step of bundle.steps) {
      if (step.when !== undefined && !evalGuard(step.when, p)) continue;
      number += 1; // every visible step counts, so numbers match the method
      const rows: BucketRow[] = [];
      const seen = new Set<string>();
      for (const read of step.reads) {
        for (const r of res.rows) {
          if (r.role !== read.role) continue;
          if (read.fill !== undefined && r.id !== read.fill) continue;
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          rows.push({ id: r.id, names: r.names, grams: r.grams });
        }
      }
      if (rows.length === 0) continue; // nothing to gather for this step
      out.push({
        stepId: step.id,
        number,
        title: step.title ?? localizeAll(step.id.replace(/_/g, ' ')),
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
