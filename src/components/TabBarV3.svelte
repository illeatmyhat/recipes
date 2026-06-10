<script lang="ts">
  // The stage tabs: Customize | Shop | Cook. Sets the shared activeTabV3, which
  // reflects onto <html data-stage> so RecipePageV3's CSS swaps panels.
  import { onMount } from 'svelte';
  import { locale } from './RecipeStore';
  import { activeTabV3, initV3Tabs, TABS_V3, type TabV3 } from './RecipeStoreV3';
  import { t, type UIKey } from '../lib/i18n';

  let mounted = $state(false);
  onMount(() => {
    initV3Tabs();
    mounted = true;
  });

  const active = $derived(mounted ? $activeTabV3 : 'customize');
  const labelKey: Record<TabV3, UIKey> = { customize: 'customizeStage', shop: 'shopStage', cook: 'cookStage' };
</script>

<div class="tabbar" role="tablist" aria-label={t('stages', $locale)}>
  {#each TABS_V3 as tab (tab)}
    <button
      type="button"
      role="tab"
      class="tab"
      class:active={active === tab}
      aria-selected={active === tab}
      onclick={() => activeTabV3.set(tab)}
    >
      {t(labelKey[tab], $locale)}
    </button>
  {/each}
</div>

<style>
  .tabbar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3rem; padding: 0.3rem; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
  .tab { padding: 0.55rem 0.5rem; border: none; border-radius: 7px; background: transparent; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--ink-soft); cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
  .tab:hover { color: var(--ink); }
  .tab.active { background: var(--accent); color: var(--on-accent); }
</style>
