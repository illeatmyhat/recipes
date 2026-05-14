<script lang="ts">
  // The two-tab navigation for the main column: "Recipe" (ingredients + method)
  // and "Customize" (the fruit/topping toggles).
  //
  // Tab state is local — no other island needs it. The active tab is reflected
  // onto <html data-tab>, and the CSS in RecipePage shows/hides the matching
  // .tab-panel. With no data-tab set (no JS, or pre-hydration) the CSS defaults
  // to the Recipe tab, which is also this component's initial state.
  //
  // No initStore() call here: TabBar depends on none of the seeded recipe
  // stores. It only reads `locale` for its labels, which the always-visible
  // islands in the default tab initialise.
  import { onMount } from 'svelte';
  import { locale } from './RecipeStore';
  import { t } from '../lib/i18n';

  type Tab = 'recipe' | 'customize';

  const TABS: ReadonlyArray<{ id: Tab; labelKey: 'recipeTab' | 'customizeTab' }> = [
    { id: 'recipe', labelKey: 'recipeTab' },
    { id: 'customize', labelKey: 'customizeTab' },
  ];

  let active = $state<Tab>('recipe');

  function select(tab: Tab): void {
    active = tab;
    // 'recipe' is the CSS default, so clear the attribute rather than set it.
    if (tab === 'recipe') delete document.documentElement.dataset.tab;
    else document.documentElement.dataset.tab = tab;
  }

  onMount(() => {
    // Mirror whatever the (JS-less) default resolved to — always 'recipe'.
    const current = document.documentElement.dataset.tab;
    active = current === 'customize' ? 'customize' : 'recipe';
  });

  // Left/Right arrows move between tabs, per the WAI-ARIA tablist pattern.
  function onKeydown(event: KeyboardEvent): void {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (dir === 0) return;
    event.preventDefault();
    const i = TABS.findIndex((tb) => tb.id === active);
    const next = TABS[(i + dir + TABS.length) % TABS.length];
    if (next) {
      select(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    }
  }
</script>

<div class="tabs" role="tablist" aria-label={t('tabs', $locale)} onkeydown={onKeydown}>
  {#each TABS as tab (tab.id)}
    {@const selected = active === tab.id}
    <button
      type="button"
      class="tab"
      role="tab"
      id={`tab-${tab.id}`}
      aria-selected={selected}
      aria-controls={`panel-${tab.id}`}
      tabindex={selected ? 0 : -1}
      onclick={() => select(tab.id)}
    >
      {t(tab.labelKey, $locale)}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--line);
  }
  .tab {
    border: none;
    background: transparent;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--ink-soft);
    padding: 0.6rem 0.9rem;
    cursor: pointer;
    /* Sit the active underline on top of the container's bottom border. */
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .tab:hover {
    color: var(--ink);
  }
  .tab[aria-selected='true'] {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
</style>
