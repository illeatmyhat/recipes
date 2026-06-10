<script lang="ts">
  // The live-method island (v3). Renders nothing itself: SSR already produced
  // the method at the default parameter point (Step.astro / Ref.astro). This
  // island subscribes to the shared `params` store and patches that DOM in
  // place as the user customizes — re-evaluating each step's `data-when` guard
  // (show/hide) and re-filling each role-scoped `data-ref` span's prose names.
  // Fill-scoped refs (`data-ref-fill`) name one fixed fill, so they are
  // excluded from the query; only their step's visibility ever changes.
  //
  // Deliberately prop-less: the page already embeds the bundle in every
  // control island's serialized props, so this one reads it back from the
  // shared store (getBundle) instead of shipping a further ~34 KB copy.
  // Until a bundle-holding island hydrates and seeds the store, params cannot
  // have left the SSR defaults, so skipping the patch is exact.
  import { onMount } from 'svelte';
  import { params, getBundle } from './RecipeStoreV3';
  import { evalGuard } from '../lib/v3/guards';
  import { refText } from '../lib/v3/method';
  import type { Locale } from '../lib/types';
  import type { Params } from '../lib/v3/types';

  onMount(() => {
    const body = document.getElementById('method-body');
    if (!body) return;
    const steps = Array.from(body.querySelectorAll<HTMLElement>('[data-step]'));
    const refs = Array.from(
      body.querySelectorAll<HTMLElement>('[data-ref]:not([data-ref-fill])'),
    ).flatMap((el) => {
      const role = el.dataset.ref;
      const loc = el.dataset.refLang as Locale | undefined;
      return role !== undefined && loc !== undefined ? [{ el, role, loc }] : [];
    });

    // Selection is carried by object identity (setServings/setKnob spread
    // Params but keep `selection`), so a reference check skips the ref loop
    // on changes that cannot rename anything.
    let lastSelection: Params['selection'] | null = null;

    return params.subscribe((p: Params) => {
      const bundle = getBundle();
      if (!bundle) return;
      for (const el of steps) {
        const when = el.dataset.when;
        const hidden = when !== undefined && !evalGuard(when, p);
        if (el.hidden !== hidden) el.hidden = hidden;
      }
      if (p.selection === lastSelection) return;
      lastSelection = p.selection;
      for (const { el, role, loc } of refs) {
        const text = refText(bundle.recipe, bundle.ingredients, p.selection, role, undefined, loc);
        if (el.textContent !== text) el.textContent = text;
      }
    });
  });
</script>
