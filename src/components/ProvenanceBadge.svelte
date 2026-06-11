<script lang="ts">
  // The provenance badge (Q11) — sits under the title, OUTSIDE the RecipeApp
  // island, so it is its own (tiny) island: its one prop is the localized
  // attribution name, and it reaches the live params through the shared
  // `departs` store (a cross-island singleton chunk — same pattern as
  // MethodController). Before RecipeApp hydrates and seeds the bundle the
  // store is false, which is also the SSR truth: the default point is the
  // source point. Locale switching is CSS-only (`.lang-*` siblings under
  // <html data-locale>), so the badge stays correct with JS disabled.
  import { departs } from './RecipeStore';
  import { UI } from '../lib/i18n';
  import { LOCALES, type Localized } from '../lib/types';

  let { source }: { source: Localized } = $props();
</script>

<p class="badge" class:departed={$departs} aria-live="polite">
  {#each LOCALES as loc (loc)}
    <span class={`lang-${loc}`}>
      {($departs ? UI.yourVariation[loc] : UI.asTaughtBy[loc]).replace('{name}', source[loc])}
    </span>
  {/each}
</p>

<style>
  .badge {
    margin: 0 0 0.75rem;
    width: fit-content;
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  /* Departed: the page is no longer the cook's recipe — quiet accent, not alarm. */
  .badge.departed {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--ink);
  }
</style>
