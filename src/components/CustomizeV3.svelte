<script lang="ts">
  // The Customize stage — the by-role projection and the core teaching
  // interaction. Each role is a card: its job (`why`), current fill(s) with live
  // grams, and the alternatives. Collapsed on mobile / expanded on desktop via
  // native <details> force-opened by CSS. The island owns only selection.
  import { onMount } from 'svelte';
  import { locale } from './RecipeStore';
  import { params, resolved, resolveBundle, initV3, setFill, toggleFill } from './RecipeStoreV3';
  import { t } from '../lib/i18n';
  import type { RecipeBundle, RoleT } from '../lib/v3/types';
  import type { Localized } from '../lib/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initV3(bundle);
    mounted = true;
  });

  const sel = $derived(mounted ? $params.selection : bundle.defaults.selection);
  const ssr = resolveBundle(bundle, bundle.defaults);
  const current = $derived(mounted ? ($resolved ?? ssr) : ssr);

  const L = (s: Localized): string => s[$locale];

  type Entry = { id: string; role: RoleT<Localized> };
  // Order: Base tier first, then substitutable required roles, then add-ons.
  const ordered = $derived.by<Entry[]>(() => {
    const all: Entry[] = Object.entries(bundle.recipe.roles).map(([id, role]) => ({ id, role }));
    const isBase = (r: RoleT<Localized>) => r.range.min >= 1 && r.fills.length === 1;
    const rank = (e: Entry) => (isBase(e.role) ? 0 : e.role.range.min >= 1 ? 1 : 2);
    return all.sort((a, b) => rank(a) - rank(b));
  });

  const gramsOf = (id: string): number =>
    current.rows.filter((r) => r.id === id).reduce((s, r) => s + r.grams, 0);

  function kindOf(role: RoleT<Localized>): 'base' | 'radio' | 'multi' {
    if (role.range.min >= 1 && role.fills.length === 1) return 'base'; // skeleton
    if (role.range.min === 0) return 'multi'; // add-on: toggle on/off
    return (role.range.max ?? Infinity) === 1 ? 'radio' : 'multi'; // pick-one vs pick-many
  }

  function picked(roleId: string, fillId: string): boolean {
    return (sel[roleId] ?? []).includes(fillId);
  }

  // min-resist: don't allow a multi role to drop below its floor.
  function onMulti(roleId: string, fillId: string, min: number): void {
    const cur = sel[roleId] ?? [];
    if (cur.includes(fillId) && cur.length <= min) return; // would violate min
    toggleFill(roleId, fillId);
  }

  function cardinalityHint(role: RoleT<Localized>): string {
    const max = role.range.max;
    if (role.range.min >= 1 && role.fills.length === 1) return t('required', $locale);
    if (max === 1) return '';
    if (max === undefined) return '';
    return `${t('pickUpTo', $locale)} ${max}`;
  }
</script>

<section class="customize" aria-label={t('customizeStage', $locale)}>
  {#each ordered as { id, role } (id)}
    {@const kind = kindOf(role)}
    <details class="role" open={kind === 'base'}>
      <summary class="role-head">
        <span class="role-label">{L(role.label)}</span>
        <span class="role-meta">
          {#if cardinalityHint(role)}<span class="card-hint">{cardinalityHint(role)}</span>{/if}
          {#if kind !== 'base'}<span class="swap" aria-hidden="true">{t('swap', $locale)}</span>{/if}
        </span>
      </summary>
      <p class="why">{L(role.why)}</p>

      <ul class="fills" class:base={kind === 'base'}>
        {#each role.fills as fill (fill.id)}
          {@const on = picked(id, fill.id)}
          <li>
            {#if kind === 'base'}
              <div class="fill static">
                <span class="fill-main">
                  <span class="fill-name">{fill.alias ? L(fill.alias) : L(role.label)}</span>
                  {#if on}<span class="fill-amt">{Math.round(gramsOf(fill.id))} g</span>{/if}
                </span>
                {#if fill.note}<span class="fill-note">{L(fill.note)}</span>{/if}
              </div>
            {:else}
              <button
                type="button"
                class="fill"
                class:on
                role={kind === 'radio' ? 'radio' : 'checkbox'}
                aria-checked={on}
                onclick={() => (kind === 'radio' ? setFill(id, fill.id) : onMulti(id, fill.id, role.range.min))}
              >
                <span class="mark {kind}" class:on aria-hidden="true">{on ? (kind === 'radio' ? '●' : '✓') : ''}</span>
                <span class="fill-body">
                  <span class="fill-main">
                    <span class="fill-name">{fill.alias ? L(fill.alias) : fill.id.replace(/_/g, ' ')}</span>
                    {#if on}<span class="fill-amt">{Math.round(gramsOf(fill.id))} g</span>{/if}
                  </span>
                  {#if fill.why}<span class="fill-why">{L(fill.why)}</span>{/if}
                  {#if on && fill.note}<span class="fill-note">{L(fill.note)}</span>{/if}
                </span>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </details>
  {/each}
</section>

<style>
  .customize { display: grid; gap: 0.85rem; }
  .role { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 0.4rem 0.85rem; }
  .role-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; cursor: pointer; padding: 0.5rem 0; list-style: none; }
  .role-head::-webkit-details-marker { display: none; }
  .role-label { font-weight: 700; font-size: 0.95rem; }
  .role-meta { display: flex; align-items: center; gap: 0.6rem; }
  .card-hint { font-size: 0.72rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-soft); }
  .swap { font-size: 0.78rem; font-weight: 600; color: var(--accent); }
  .why { margin: 0 0 0.6rem; font-size: 0.85rem; color: var(--ink-soft); }
  .fills { list-style: none; margin: 0 0 0.4rem; padding: 0; display: grid; gap: 0.4rem; }
  .fill { display: flex; gap: 0.6rem; width: 100%; text-align: left; align-items: flex-start; padding: 0.55rem 0.7rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); cursor: pointer; font: inherit; color: var(--ink); }
  .fill.static { cursor: default; }
  .fill.on { border-color: var(--accent); background: var(--accent-soft); }
  .mark { flex: none; width: 1.3rem; height: 1.3rem; display: grid; place-items: center; border: 1px solid var(--line); background: var(--surface); font-size: 0.8rem; color: var(--accent); font-weight: 700; }
  .mark.radio { border-radius: 50%; }
  .mark.multi { border-radius: 5px; }
  .mark.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .fill-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
  .fill-main { display: flex; gap: 0.5rem; align-items: baseline; justify-content: space-between; }
  .fill-name { font-weight: 600; }
  .fill-amt { color: var(--ink-soft); font-variant-numeric: tabular-nums; flex: none; }
  .fill-why, .fill-note { font-size: 0.82rem; color: var(--ink-soft); }
  .fill-note { color: var(--accent); }

  /* Desktop: force every role expanded regardless of the <details> open state
     (overrides the UA `details:not([open]) > :not(summary){display:none}`), and
     drop the swap affordance — the alternatives are all visible anyway. */
  @media (min-width: 880px) {
    .role > summary { cursor: default; }
    .role > summary .swap { display: none; }
    .role > .why { display: block; }
    .role > .fills { display: grid; }
  }
</style>
