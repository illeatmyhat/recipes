/**
 * Per-render context for the method MDX components.
 *
 * `<Step>`/`<Ref>` render inside a recipe's MDX body, which Astro renders as a
 * slot — there is no way to hand them per-recipe props from the page. Instead
 * `RecipePage.astro` registers the current recipe's bundle + per-locale
 * catalogs on `Astro.locals`, and the components read it back from their own
 * `Astro.locals` while the slot renders.
 *
 * `Astro.locals` is one object per page render, shared by the page and every
 * component (slot content included) in that render — so the context cannot go
 * stale across pages or cross-contaminate interleaved renders (dev-server
 * concurrency, `build.concurrency` > 1), with no module-level state and
 * nothing to clear. A `<Step>`/`<Ref>` rendered outside a recipe page
 * still fails loudly via {@link getMethodContext}.
 */
import type { Locale } from '../types';
import type { RecipeBundle } from './types';

export interface MethodContext {
  bundle: RecipeBundle;
  /** The recipe's flat catalogs, one per non-canonical locale (step templates live at `steps.<id>`). */
  catalogs: ReadonlyArray<{ locale: Locale; cat: Record<string, string> }>;
}

/** The slice of `Astro.locals` this module owns (see src/env.d.ts). */
export interface MethodContextLocals {
  methodContext?: MethodContext;
}

/** Register the recipe whose MDX body is about to render (call with `Astro.locals`). */
export function setMethodContext(locals: MethodContextLocals, ctx: MethodContext): void {
  locals.methodContext = ctx;
}

/** The render's context; throws if no page set one (Step/Ref outside a recipe page). */
export function getMethodContext(locals: MethodContextLocals): MethodContext {
  const ctx = locals.methodContext;
  if (!ctx) {
    throw new Error(
      'recipe method: <Step>/<Ref> rendered with no method context — they only work in the MDX body of a recipe.',
    );
  }
  return ctx;
}
