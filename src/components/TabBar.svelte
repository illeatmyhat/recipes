<script lang="ts">
  // The two-tab navigation for the main column: "Recipe" (ingredients + method)
  // and "Customize" (the fruit/topping toggles).
  //
  // Tab state lives in the shared `activeTab` store so the NextTab buttons at
  // the bottom of each panel can drive it too. initTabs reflects it onto
  // <html data-tab>, and the CSS in RecipePage shows the matching .tab-panel.
  // With no data-tab set (no JS, or pre-hydration) the CSS defaults to the
  // Recipe tab, which is also the store's initial value.
  import { onMount } from 'svelte';
  import { locale, activeTab, initTabs, TABS } from './RecipeStore';
  import { t } from '../lib/i18n';

  onMount(() => initTabs());

  // Left/Right arrows move between tabs, per the WAI-ARIA tablist pattern.
  function onKeydown(event: KeyboardEvent): void {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (dir === 0) return;
    event.preventDefault();
    const i = TABS.indexOf($activeTab);
    const next = TABS[(i + dir + TABS.length) % TABS.length];
    if (next) {
      activeTab.set(next);
      document.getElementById(`tab-${next}`)?.focus();
    }
  }
</script>

<div class="tabs" role="tablist" aria-label={t('tabs', $locale)} onkeydown={onKeydown}>
  {#each TABS as tab (tab)}
    {@const selected = $activeTab === tab}
    <button
      type="button"
      class="tab"
      role="tab"
      id={`tab-${tab}`}
      aria-selected={selected}
      aria-controls={`panel-${tab}`}
      tabindex={selected ? 0 : -1}
      onclick={() => activeTab.set(tab)}
    >
      {t(`${tab}Tab`, $locale)}
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
