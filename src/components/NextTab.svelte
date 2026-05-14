<script lang="ts">
  // A "next tab" button for the bottom of a tab panel — a small carousel
  // control. It advances to the next tab in TABS order (wrapping around) and
  // is labelled with that tab's name, so the customizability is discoverable
  // from inside the Recipe tab.
  import { onMount } from 'svelte';
  import { activeTab, initTabs, locale, TABS, type Tab } from './RecipeStore';
  import { t } from '../lib/i18n';

  // Which tab this button lives in; the destination is whatever follows it.
  let { from }: { from: Tab } = $props();

  // `from` is a static prop; deriving keeps Svelte from warning that a plain
  // `const` would not track it.
  const next: Tab = $derived(
    TABS[(TABS.indexOf(from) + 1) % TABS.length] ?? from,
  );

  onMount(() => initTabs());

  // Switching tabs makes this button's own panel `display:none`, which would
  // drop focus to <body>. Move focus onto the destination tab button instead,
  // so keyboard users land somewhere sensible — the same target TabBar's
  // arrow-key handler uses.
  function go(): void {
    activeTab.set(next);
    document.getElementById(`tab-${next}`)?.focus();
  }
</script>

<div class="next-tab">
  <button
    type="button"
    class="next-btn"
    aria-controls={`panel-${next}`}
    onclick={go}
  >
    {t(`${next}Tab`, $locale)}
    <span class="arrow" aria-hidden="true">→</span>
  </button>
</div>

<style>
  .next-tab {
    display: flex;
    justify-content: flex-end;
    margin-top: 1.25rem;
  }
  .next-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--accent);
    border-radius: 999px;
    background: var(--surface);
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    padding: 0.45rem 0.95rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .next-btn:hover {
    background: var(--bg);
  }
  .arrow {
    transition: transform 0.15s ease;
  }
  .next-btn:hover .arrow {
    transform: translateX(2px);
  }
</style>
