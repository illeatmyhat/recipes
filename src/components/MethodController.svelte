<script lang="ts">
  // The live-method island (v3). Renders nothing itself: SSR already produced
  // the method at the default parameter point (Step.astro / Ref.astro). This
  // island subscribes to the shared `params` store and patches that DOM in
  // place as the user customizes — re-evaluating each step's `data-when` guard
  // (show/hide) and re-filling each role-scoped `data-ref` span's prose names.
  // Fill-scoped refs (`data-ref-fill`) name one fixed fill, so only their
  // step's visibility ever changes. Mirrors the data-theme/data-locale
  // pattern: annotated static HTML + one small controller.
  import { onMount } from 'svelte';
  import { params, initV3 } from './RecipeStoreV3';
  import { evalGuard } from '../lib/v3/guards';
  import { refText } from '../lib/v3/method';
  import type { Locale } from '../lib/types';
  import type { Params, RecipeBundle } from '../lib/v3/types';

  let { bundle }: { bundle: RecipeBundle } = $props();

  onMount(() => {
    initV3(bundle);
    const body = document.getElementById('method-body');
    if (!body) return;
    const steps = Array.from(body.querySelectorAll<HTMLElement>('[data-step]'));
    const refs = Array.from(body.querySelectorAll<HTMLElement>('[data-ref]'));

    return params.subscribe((p: Params) => {
      for (const el of steps) {
        const when = el.dataset.when;
        el.hidden = when !== undefined && !evalGuard(when, p);
      }
      for (const el of refs) {
        if (el.dataset.refFill !== undefined) continue;
        const role = el.dataset.ref;
        const loc = el.dataset.refLang as Locale | undefined;
        if (role === undefined || loc === undefined) continue;
        el.textContent = refText(bundle.recipe, bundle.ingredients, p.selection, role, undefined, loc);
      }
    });
  });
</script>
