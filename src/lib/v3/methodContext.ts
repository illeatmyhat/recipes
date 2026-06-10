/**
 * Build-time context for the method MDX components (v3).
 *
 * `<Step>`/`<Ref>` render inside a recipe's MDX body, which Astro renders as a
 * slot — there is no way to hand them per-recipe props from the page. Instead
 * `RecipePageV3.astro` registers the current recipe's bundle + JA catalog in
 * its frontmatter, and the components read it back while the slot renders.
 *
 * A module-level singleton is sound here because Astro builds pages serially
 * (`build.concurrency` defaults to 1) and the slot renders within the same
 * page render that set the context. If concurrency is ever raised, v3 pages
 * could interleave and this needs to become keyed/async-local — the unknown-
 * role errors in Step/Ref would surface the mixup immediately.
 */
import type { RecipeBundle } from './types';

export interface MethodContext {
  bundle: RecipeBundle;
  /** The recipe's flat JA catalog (step templates live at `steps.<id>`). */
  catalog: Record<string, string>;
}

let current: MethodContext | null = null;

/** Register the recipe whose MDX body is about to render. */
export function setMethodContext(ctx: MethodContext): void {
  current = ctx;
}

/** The registered context; throws if no v3 page set one (Step/Ref outside a v3 recipe). */
export function getMethodContext(): MethodContext {
  if (!current) {
    throw new Error(
      'v3 method: <Step>/<Ref> rendered with no method context — they only work in the MDX body of a v3 recipe.',
    );
  }
  return current;
}
