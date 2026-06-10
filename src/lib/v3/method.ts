/**
 * Method rendering (v3) — pure helpers shared by SSR and the client island.
 *
 * A step's prose reads roles through refs: `<Ref of="role" fill?/>` in the
 * canonical EN MDX body, and `{role}` / `{role:fill}` placeholders in the
 * per-locale catalog templates (`steps.<id>`). Both surfaces render to
 * `<span data-ref …>` markers: SSR fills them at the default parameter point
 * (Step.astro / Ref.astro), and the MethodController island re-fills the
 * role-scoped ones as the selection changes. A fill-scoped ref names one fixed
 * fill, so its text never changes — only its step's `when` guard varies.
 *
 * No I/O and no DOM — safe in the browser and at build time alike.
 */
import type { Locale, Localized } from '../types';
import { joinNames, proseName } from './names';
import type { LoadedIngredient, RecipeV3 } from './types';

/** Defensive names for an ingredient id missing from the bundle (should not happen). */
function fallbackNames(id: string): Localized {
  const name = id.replace(/_/g, ' ');
  return { en: name, ja: name };
}

/**
 * The prose text of a ref at a selection point. Role-scoped (`fillId`
 * undefined): the currently-chosen fills of `roleId`, in the role's declared
 * fill order, as a localized list join (empty selection collapses to '').
 * Fill-scoped: just that fill's prose name, selection-independent.
 * Unknown role/fill ids throw — at build time this fails loudly on a typo.
 */
export function refText(
  recipe: RecipeV3,
  ingredients: Record<string, LoadedIngredient>,
  selection: Record<string, string[]>,
  roleId: string,
  fillId: string | undefined,
  loc: Locale,
): string {
  const role = recipe.roles[roleId];
  if (!role) {
    throw new Error(`v3 method: ref reads unknown role "${roleId}".`);
  }
  const nameOf = (id: string): string => {
    const fill = role.fills.find((f) => f.id === id);
    const names = ingredients[id]?.data.names ?? fallbackNames(id);
    return proseName(fill, names, loc);
  };
  if (fillId !== undefined) {
    if (!role.fills.some((f) => f.id === fillId)) {
      throw new Error(`v3 method: ref reads unknown fill "${roleId}:${fillId}".`);
    }
    return nameOf(fillId);
  }
  const picked = selection[roleId] ?? [];
  const ordered = role.fills.filter((f) => picked.includes(f.id)).map((f) => f.id);
  return joinNames[loc](ordered.map(nameOf));
}

// ── catalog step templates ({role} / {role:fill} placeholders) ────────────────

const TOKEN = /\{([A-Za-z0-9_]+)(?::([A-Za-z0-9_]+))?\}/g;

/** One placeholder read in a catalog step template. */
export interface RefRead {
  role: string;
  fill?: string;
}

/** Every `{role}` / `{role:fill}` placeholder in a template, in order. */
export function templateReads(template: string): RefRead[] {
  const reads: RefRead[] = [];
  for (const m of template.matchAll(TOKEN)) {
    const role = m[1] as string;
    reads.push(m[2] === undefined ? { role } : { role, fill: m[2] });
  }
  return reads;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The `<span data-ref …>` marker both ref surfaces render to. */
function refSpan(roleId: string, fillId: string | undefined, loc: Locale, text: string): string {
  const fillAttr = fillId === undefined ? '' : ` data-ref-fill="${escapeHtml(fillId)}"`;
  return (
    `<span class="m-ref" data-ref="${escapeHtml(roleId)}"${fillAttr} ` +
    `data-ref-lang="${loc}">${escapeHtml(text)}</span>`
  );
}

/**
 * Render a catalog step template to HTML at a selection point: placeholders
 * become `data-ref` spans (patchable by the island), everything else is
 * escaped author text.
 */
export function renderStepTemplate(
  template: string,
  recipe: RecipeV3,
  ingredients: Record<string, LoadedIngredient>,
  selection: Record<string, string[]>,
  loc: Locale,
): string {
  let out = '';
  let last = 0;
  for (const m of template.matchAll(TOKEN)) {
    const role = m[1] as string;
    const fill = m[2];
    out += escapeHtml(template.slice(last, m.index));
    out += refSpan(role, fill, loc, refText(recipe, ingredients, selection, role, fill, loc));
    last = m.index + m[0].length;
  }
  return out + escapeHtml(template.slice(last));
}

/**
 * The roles read by an already-rendered ref surface (SSR HTML from the EN MDX
 * body) — extracted from its `data-ref` markers for the boundness lint and the
 * step's `data-reads` projection.
 */
export function htmlRefReads(html: string): string[] {
  const roles: string[] = [];
  for (const m of html.matchAll(/data-ref="([^"]+)"/g)) {
    roles.push(m[1] as string);
  }
  return roles;
}
