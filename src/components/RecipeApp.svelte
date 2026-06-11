<script lang="ts">
  // The single interactive island of a recipe page: the layout grid with
  // every stage control (scaler, tabs, the three stage panels, nutrition) as
  // plain child components and the method (the MDX body, server-rendered) as
  // its slot. One island ⇒ the ~34 KB bundle is serialized into the page
  // exactly once, instead of once per control island; the children receive it
  // as an ordinary prop, which costs nothing.
  //
  // SSR renders the whole tree at the default parameter point (readable
  // JS-off); each child keeps its own initRecipe/mounted handoff, so this
  // component adds no state of its own.
  import type { Snippet } from 'svelte';
  import ServingsScaler from './ServingsScaler.svelte';
  import TabBar from './TabBar.svelte';
  import Customize from './Customize.svelte';
  import Shop from './Shop.svelte';
  import Cook from './Cook.svelte';
  import NutritionPanel from './NutritionPanel.svelte';
  import MethodController from './MethodController.svelte';
  import { UI } from '../lib/i18n';
  import { LOCALES } from '../lib/types';
  import type { RecipeBundle } from '../lib/recipe/types';

  let { bundle, children }: { bundle: RecipeBundle; children?: Snippet } = $props();
</script>

<div class="layout">
  <div class="scaler-area">
    <ServingsScaler {bundle} />
  </div>

  <div class="main">
    <TabBar />

    <div class="stage-panel" data-stage-panel="customize">
      <Customize {bundle} />
    </div>
    <div class="stage-panel" data-stage-panel="shop">
      <Shop {bundle} />
    </div>
    <div class="stage-panel" data-stage-panel="cook">
      <Cook {bundle} />
    </div>

    <section class="method" aria-labelledby="method-heading">
      <h2 id="method-heading">
        {#each LOCALES as loc (loc)}<span class={`lang-${loc}`}>{UI.method[loc]}</span>{/each}
      </h2>
      <div class="method-body" id="method-body">{@render children?.()}</div>
      <MethodController />
    </section>
  </div>

  <aside class="nutrition-area">
    <div class="sticky">
      <NutritionPanel {bundle} />
    </div>
  </aside>
</div>

<style>
  .layout { display: grid; gap: 1.5rem; grid-template-areas: 'scaler' 'main' 'nutrition'; }
  .scaler-area { grid-area: scaler; }
  .main { grid-area: main; display: grid; gap: 1.5rem; align-content: start; }
  .nutrition-area { grid-area: nutrition; }

  /* Stage panels — CSS swaps them off <html data-stage>; customize is the
     default (shown pre-hydration / JS-off). */
  .stage-panel { display: none; }
  .stage-panel[data-stage-panel='customize'] { display: block; }
  :global([data-stage='shop']) .stage-panel[data-stage-panel='customize'] { display: none; }
  :global([data-stage='shop']) .stage-panel[data-stage-panel='shop'] { display: block; }
  :global([data-stage='cook']) .stage-panel[data-stage-panel='customize'] { display: none; }
  :global([data-stage='cook']) .stage-panel[data-stage-panel='cook'] { display: block; }

  @media (min-width: 880px) {
    .layout { grid-template-columns: 1fr 22rem; grid-template-rows: auto auto 1fr; grid-template-areas: 'main scaler' 'main nutrition' 'main .'; align-items: start; }
  }

  .method { border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; background: var(--surface); }
  .method h2 { margin: 0 0 0.75rem; font-size: 1.15rem; }
  .method-body :global(ol), .method-body :global(ul) { padding-left: 1.2rem; }
  .method-body :global(li) { margin-bottom: 0.5rem; }
  .method-body :global(h3) { margin: 1.2rem 0 0.4rem; font-size: 1rem; }
  .method-body :global(p) { margin: 0.5rem 0; }
  .method-body :global(ol.steps) { list-style: none; margin: 0; padding: 0; counter-reset: step; }
  /* Separator + top spacing key on "visible step preceded by a visible step",
     never :first-child/:last-child — a guard-hidden [hidden] li still matches
     structural pseudo-classes, which would misalign the first/last visible
     step. (Counters already skip display:none items.) */
  .method-body :global(ol.steps > li) { counter-increment: step; position: relative; margin: 0; padding: 0 0 1rem 2.9rem; }
  .method-body :global(ol.steps > li:not([hidden]) ~ li:not([hidden])) { border-top: 1px solid var(--line); padding-top: 1rem; }
  .method-body :global(ol.steps > li::before) { content: counter(step); position: absolute; left: 0; top: 0; width: 1.75rem; height: 1.75rem; border: 1px solid var(--line); border-radius: 50%; display: grid; place-items: center; font-size: 0.8rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .method-body :global(ol.steps > li:not([hidden]) ~ li:not([hidden])::before) { top: 1rem; }
  .method-body :global(ol.steps strong) { display: block; margin-bottom: 0.3rem; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--accent); }
  .method-body :global(ol.steps p) { margin: 0; color: var(--ink); }
  /* Live refs — the spans the MethodController re-fills as fills change. A
     quiet tint marks which words of the method are functions of your choices. */
  .method-body :global(.m-ref) { background: var(--accent-soft); border-radius: 4px; padding: 0 0.2em; box-decoration-break: clone; }
  .sticky { position: sticky; top: 1.5rem; }
</style>
