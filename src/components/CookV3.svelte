<script lang="ts">
  // The Cook stage — mise en place. First pass groups the resolved ingredients
  // by role (what each part of the dish needs). True by-step bucketing arrives
  // with the <Step>/<Ref> method components (#3), which provide the
  // step→ingredient mapping; the method itself is always-visible below.
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

  interface Group { roleId: string; label: Localized; rows: { id: string; names: Localized; grams: number }[]; }
  const groups = $derived.by<Group[]>(() => {
    const out: Group[] = [];
    for (const [roleId, role] of Object.entries(bundle.recipe.roles)) {
      const rows = current.rows.filter((r) => r.role === roleId).map((r) => ({ id: r.id, names: r.names, grams: r.grams }));
      if (rows.length > 0) out.push({ roleId, label: role.label, rows });
    }
    return out;
  });
</script>

<section class="cook" aria-label={t('miseEnPlace', $locale)}>
  <p class="hint">{t('miseHint', $locale)}</p>
  <div class="groups">
    {#each groups as g (g.roleId)}
      <div class="group">
        <h3>{L(g.label)}</h3>
        <ul>
          {#each g.rows as row (row.id)}
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
  .group h3 { margin: 0 0 0.4rem; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
  .group ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .group li { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.4rem 0.7rem; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); }
  .name { font-weight: 600; }
  .amt { color: var(--ink-soft); font-variant-numeric: tabular-nums; }
</style>
