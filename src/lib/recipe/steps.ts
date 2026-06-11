/**
 * Step metadata extraction — the structured channel from the MDX body to
 * the bundle.
 *
 * The method's `<Step>`/`<Ref>` markup only materializes as DOM when Astro
 * renders the page, but the Cook stage needs the step list (ids, titles,
 * guards, reads) as DATA at SSR time and in the browser. So the canonical
 * body is parsed here at build time — exactly the "MDX walking only to
 * extract step ids and refs" the design doc planned for the catalog lints —
 * and `buildBundle` merges in each step's catalog-template reads
 * (`templateReads`) so the read set covers both surfaces. Step.astro
 * cross-checks its rendered reads against this extraction, so a parser gap
 * cannot silently desync the Cook stage from the method.
 *
 * Pure string parsing; the filesystem read lives in bundle.ts.
 */
import type { StepMetaT, StepRead } from './types';

// The attribute span must not stop at a `>` INSIDE a quoted value — guards
// like when="count(toppings) > 0" are legal — so it consumes quoted strings
// whole and only ends on a bare `>`.
const STEP = /<Step\b((?:"[^"]*"|[^>"])*)>([\s\S]*?)<\/Step>/g;
const ATTR = /([A-Za-z][\w-]*)="([^"]*)"/g;
const REF = /<Ref\b((?:"[^"]*"|[^>"])*?)\/?>/g;

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(ATTR)) out[m[1] as string] = m[2] as string;
  return out;
}

/** Dedupe key for a read. */
export function readKey(read: StepRead): string {
  return read.fill === undefined ? read.role : `${read.role}:${read.fill}`;
}

/** An extracted step: the metadata plus the raw canonical body (staleness-lint source). */
export interface ExtractedStep extends StepMetaT<string> {
  body: string;
}

/**
 * Parse every `<Step id when? title?>` block (and the `<Ref of fill?/>`s
 * inside it) out of a canonical MDX body. Throws on a missing or duplicate
 * step id — both would corrupt catalog keys and the by-step projection.
 */
export function extractSteps(body: string): ExtractedStep[] {
  const steps: ExtractedStep[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(STEP)) {
    const attrs = parseAttrs(m[1] as string);
    const inner = m[2] as string;
    const id = attrs.id;
    if (id === undefined || id === '') {
      throw new Error(`recipe steps: a <Step> is missing its id (near "${inner.slice(0, 40).trim()}…").`);
    }
    if (seen.has(id)) {
      throw new Error(`recipe steps: duplicate step id "${id}".`);
    }
    seen.add(id);

    const reads: StepRead[] = [];
    const keys = new Set<string>();
    for (const r of inner.matchAll(REF)) {
      const ra = parseAttrs(r[1] as string);
      const role = ra.of;
      if (role === undefined || role === '') {
        throw new Error(`recipe steps: step "${id}" has a <Ref> with no of="role".`);
      }
      const read: StepRead = ra.fill === undefined ? { role } : { role, fill: ra.fill };
      if (!keys.has(readKey(read))) {
        keys.add(readKey(read));
        reads.push(read);
      }
    }

    steps.push({ id, when: attrs.when, title: attrs.title, reads, body: inner.trim() });
  }
  return steps;
}
