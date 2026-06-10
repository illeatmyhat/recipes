<script lang="ts">
  // Servings stepper for v3 — drives params.servings; the resolved store (and
  // so the whole page) rescales live.
  import { onMount } from 'svelte';
  import { locale } from './RecipeStore';
  import { params, initV3, setServings } from './RecipeStoreV3';
  import { t } from '../lib/i18n';
  import type { RecipeBundle } from '../lib/v3/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  let mounted = $state(false);
  onMount(() => {
    initV3(bundle);
    mounted = true;
  });

  const spec = bundle.recipe.servings;
  const count = $derived(mounted ? $params.servings : bundle.defaults.servings);
</script>

<div class="scaler">
  <span class="label">{t('servings', $locale)}</span>
  <div class="stepper" role="group" aria-label={t('servings', $locale)}>
    <button type="button" aria-label={t('decrease', $locale)} disabled={count <= spec.min} onclick={() => setServings(count - 1)}>−</button>
    <span class="count" aria-live="polite">{count}</span>
    <button type="button" aria-label={t('increase', $locale)} disabled={count >= spec.max} onclick={() => setServings(count + 1)}>+</button>
  </div>
</div>

<style>
  .scaler { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 1.1rem; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
  .label { font-weight: 700; }
  .stepper { display: flex; align-items: center; gap: 0.5rem; }
  .stepper button { width: 2.2rem; height: 2.2rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); font-size: 1.2rem; font-weight: 700; color: var(--ink); cursor: pointer; }
  .stepper button:hover:not(:disabled) { border-color: var(--accent); }
  .stepper button:disabled { opacity: 0.4; cursor: not-allowed; }
  .count { min-width: 2ch; text-align: center; font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
