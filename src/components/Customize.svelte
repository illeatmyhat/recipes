<script lang="ts">
  // The Customize stage — the by-role projection and the core teaching
  // interaction. Each role is a card: its job (`why`), current fill(s) with live
  // grams, and the alternatives. Collapsed on mobile / expanded on desktop via
  // native <details> force-opened by CSS. The island owns selection + knobs.
  //
  // Validation maps the model's min=structural / max=advisory split onto the
  // controls (#9): min resists (the floor pick can't be removed), max shows a
  // quiet advisory note, constraint `warn`s render inline at the top, and
  // constraint `error`s become FUNCTIONAL DISABLE — an option is disabled iff
  // applying it to the current Params would resolve to `blocked`, which keeps
  // Params never-blocked inductively from the valid default. The nutrition
  // pane is never the error channel.
  import { onMount } from 'svelte';
  import { locale } from './LocaleStore';
  import { params, resolved, resolveBundle, initRecipe, setFill, toggleFill, setKnob } from './RecipeStore';
  import { t, UI } from '../lib/i18n';
  import { proseName } from '../lib/recipe/names';
  import type { FillT, Knob, KnobValue, Params, RecipeBundle, RoleT } from '../lib/recipe/types';
  import type { Localized } from '../lib/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initRecipe(bundle);
    mounted = true;
  });

  const currentP = $derived<Params>(mounted ? $params : bundle.defaults);
  const sel = $derived(currentP.selection);
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

  const knobEntries = $derived(Object.entries(bundle.recipe.knobs ?? {}) as [string, Knob][]);
  const knobValue = (id: string, knob: Knob): KnobValue => currentP.knobs[id] ?? knob.default;

  // Scoped to the role: roles may share a fill id (marinade salt vs seasoning
  // salt), and this card shows the DECLARATION's grams — the merged-by-
  // ingredient total belongs to the shopping list, not here.
  const gramsOf = (roleId: string, id: string): number =>
    current.rows
      .filter((r) => r.role === roleId && r.id === id)
      .reduce((s, r) => s + r.grams, 0);

  function kindOf(role: RoleT<Localized>): 'base' | 'radio' | 'multi' {
    if (role.range.min >= 1 && role.fills.length === 1) return 'base'; // skeleton
    if (role.range.min === 0) return 'multi'; // add-on: toggle on/off
    return (role.range.max ?? Infinity) === 1 ? 'radio' : 'multi'; // pick-one vs pick-many
  }

  function picked(roleId: string, fillId: string): boolean {
    return (sel[roleId] ?? []).includes(fillId);
  }

  /** The Params that clicking this option would produce. */
  function withClick(p: Params, roleId: string, fillId: string, kind: 'radio' | 'multi'): Params {
    const cur = p.selection[roleId] ?? [];
    const next =
      kind === 'radio'
        ? [fillId]
        : cur.includes(fillId)
          ? cur.filter((id) => id !== fillId)
          : [...cur, fillId];
    return { ...p, selection: { ...p.selection, [roleId]: next } };
  }

  /**
   * Functional disable: the constraint-error text this click would trigger,
   * or null when the click is fine. `resolve` is cheap (a few small loops),
   * so re-checking every option per param change is fine at recipe scale.
   */
  function blockReason(roleId: string, fillId: string, kind: 'radio' | 'multi'): Localized | null {
    if (kind === 'radio' && picked(roleId, fillId)) return null; // re-pick is a no-op
    const result = resolveBundle(bundle, withClick(currentP, roleId, fillId, kind));
    if (!result.blocked) return null;
    const notice = result.notices.find((n) => n.kind === 'constraint-error');
    return notice && 'text' in notice ? notice.text : UI.optionBlocked;
  }

  // A fill's control label: its recipe alias, else the prose-normalized DB
  // name in the viewer's locale — the same resolution the method's refs use
  // (a raw id would be unlocalized prose in every locale).
  function fillName(fill: FillT<Localized>): string {
    const names = bundle.ingredients[fill.id]?.data.names;
    return names
      ? proseName(fill, names, $locale)
      : (fill.alias ? L(fill.alias) : fill.id.replace(/_/g, ' '));
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

  // Advisory max: the soft notice for a role currently over its suggested max.
  const overMax = (roleId: string): number | null => {
    const n = current.notices.find((x) => x.kind === 'above-max' && x.role === roleId);
    return n && 'max' in n ? n.max : null;
  };

  // Constraint notices (author text) — warns expected in normal use; an error
  // here would mean a blocked state leaked past functional disable.
  const constraintNotices = $derived(
    current.notices.flatMap((n) =>
      n.kind === 'constraint-warn' || n.kind === 'constraint-error'
        ? [{ error: n.kind === 'constraint-error', text: n.text }]
        : [],
    ),
  );
</script>

<section class="customize" aria-label={t('customizeStage', $locale)}>
  {#if constraintNotices.length > 0}
    <div class="notices">
      {#each constraintNotices as n, i (i)}
        <p class="notice" class:error={n.error} role={n.error ? 'alert' : 'status'}>{L(n.text)}</p>
      {/each}
    </div>
  {/if}

  {#if knobEntries.length > 0}
    <section class="knobs" aria-label={t('adjust', $locale)}>
      <p class="knobs-head">{t('adjust', $locale)}</p>
      {#each knobEntries as [id, knob] (id)}
        {@const val = knobValue(id, knob)}
        <div class="knob">
          <div class="knob-head">
            <span class="knob-label">{L(knob.label)}</span>
            {#if knob.kind === 'bool'}
              <button
                type="button"
                class="switch"
                class:on={val === true}
                role="switch"
                aria-checked={val === true}
                aria-label={L(knob.label)}
                onclick={() => setKnob(id, !(val === true))}
              >
                <span class="switch-thumb" aria-hidden="true"></span>
              </button>
            {:else if knob.kind === 'scalar'}
              <span class="knob-value">×{val}</span>
            {/if}
          </div>
          {#if knob.kind === 'scalar'}
            <input
              class="slider"
              type="range"
              min={knob.min}
              max={knob.max}
              step={knob.step ?? 1}
              value={Number(val)}
              aria-label={L(knob.label)}
              oninput={(e) => setKnob(id, Number(e.currentTarget.value))}
            />
          {:else if knob.kind === 'enum'}
            <div class="segments" role="radiogroup" aria-label={L(knob.label)}>
              {#each knob.values as option (option)}
                <button
                  type="button"
                  class="segment"
                  class:active={val === option}
                  role="radio"
                  aria-checked={val === option}
                  onclick={() => setKnob(id, option)}
                >
                  {knob.optionLabels?.[option] ? L(knob.optionLabels[option]) : option}
                </button>
              {/each}
            </div>
          {/if}
          {#if knob.why}<p class="knob-why">{L(knob.why)}</p>{/if}
        </div>
      {/each}
    </section>
  {/if}

  {#each ordered as { id, role } (id)}
    {@const kind = kindOf(role)}
    {@const over = overMax(id)}
    <details class="role" open={kind === 'base'}>
      <summary class="role-head">
        <span class="role-label">{L(role.label)}</span>
        <span class="role-meta">
          {#if cardinalityHint(role)}<span class="card-hint">{cardinalityHint(role)}</span>{/if}
          {#if kind !== 'base'}<span class="swap" aria-hidden="true">{t('swap', $locale)}</span>{/if}
        </span>
      </summary>
      <p class="why">{L(role.why)}</p>
      {#if over !== null}
        <p class="advisory">{t('aboveMax', $locale).replace('{n}', String(over))}</p>
      {/if}

      <ul class="fills" class:base={kind === 'base'}>
        {#each role.fills as fill (fill.id)}
          {@const on = picked(id, fill.id)}
          <li>
            {#if kind === 'base'}
              <div class="fill static">
                <span class="fill-main">
                  <span class="fill-name">{fill.alias ? L(fill.alias) : L(role.label)}</span>
                  {#if on}<span class="fill-amt">{Math.round(gramsOf(id, fill.id))} g</span>{/if}
                </span>
                {#if fill.note}<span class="fill-note">{L(fill.note)}</span>{/if}
              </div>
            {:else}
              {@const blocked = blockReason(id, fill.id, kind === 'radio' ? 'radio' : 'multi')}
              <button
                type="button"
                class="fill"
                class:on
                disabled={blocked !== null}
                role={kind === 'radio' ? 'radio' : 'checkbox'}
                aria-checked={on}
                onclick={() => (kind === 'radio' ? setFill(id, fill.id) : onMulti(id, fill.id, role.range.min))}
              >
                <span class="mark {kind}" class:on aria-hidden="true">{on ? (kind === 'radio' ? '●' : '✓') : ''}</span>
                <span class="fill-body">
                  <span class="fill-main">
                    <span class="fill-name">{fillName(fill)}</span>
                    {#if on}<span class="fill-amt">{Math.round(gramsOf(id, fill.id))} g</span>{/if}
                  </span>
                  {#if fill.why}<span class="fill-why">{L(fill.why)}</span>{/if}
                  {#if on && fill.note}<span class="fill-note">{L(fill.note)}</span>{/if}
                  {#if blocked !== null}<span class="fill-block">{L(blocked)}</span>{/if}
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

  .notices { display: grid; gap: 0.4rem; }
  .notice { margin: 0; padding: 0.55rem 0.8rem; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent-soft); font-size: 0.85rem; }
  .notice.error { border-color: #c0392b; background: color-mix(in srgb, #c0392b 12%, var(--bg)); }

  .knobs { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 0.75rem 0.85rem; display: grid; gap: 0.75rem; }
  .knobs-head { margin: 0; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
  .knob { display: grid; gap: 0.3rem; }
  .knob-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
  .knob-label { font-weight: 600; font-size: 0.92rem; }
  .knob-value { color: var(--ink-soft); font-variant-numeric: tabular-nums; font-size: 0.9rem; }
  .knob-why { margin: 0; font-size: 0.82rem; color: var(--ink-soft); }

  .switch { position: relative; width: 2.6rem; height: 1.45rem; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); cursor: pointer; padding: 0; flex: none; }
  .switch-thumb { position: absolute; top: 0.14rem; left: 0.14rem; width: 1.05rem; height: 1.05rem; border-radius: 50%; background: var(--ink-soft); transition: transform 0.15s ease, background 0.15s ease; }
  .switch.on { background: var(--accent); border-color: var(--accent); }
  .switch.on .switch-thumb { transform: translateX(1.15rem); background: var(--on-accent); }

  .slider { width: 100%; accent-color: var(--accent); }

  .segments { display: flex; gap: 0.25rem; border: 1px solid var(--line); border-radius: 999px; padding: 0.2rem; background: var(--bg); width: fit-content; }
  .segment { border: none; background: transparent; font: inherit; font-size: 0.82rem; font-weight: 600; padding: 0.3rem 0.7rem; border-radius: 999px; color: var(--ink-soft); cursor: pointer; }
  .segment.active { background: var(--accent); color: var(--on-accent); }

  .advisory { margin: -0.3rem 0 0.6rem; font-size: 0.82rem; color: var(--accent); }

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
  .fill:disabled { opacity: 0.55; cursor: not-allowed; }
  .fill-block { font-size: 0.82rem; color: #c0392b; }
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
