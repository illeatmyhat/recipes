/**
 * v3 catalog localization (build time).
 *
 * A v3 recipe's MDX frontmatter holds the **canonical** (EN) text; the JA (and
 * any future locale) strings live in a per-locale sidecar catalog
 * `src/content/recipes/<slug>.<locale>.yaml`, a flat map keyed by dotted paths
 * (e.g. `roles.protein.why`, `roles.protein.fills.tofu.alias`). `hydrateRecipe`
 * merges canonical + catalog into the `Localized` shape the engine consumes.
 *
 * Missing keys fall back to the canonical EN and are reported (completeness
 * lint — a loud warning for now; the eventual gate is an error). Touches the
 * filesystem — build time only.
 *
 * Scope note: this localizes the v3 **frontmatter** content. The method *body*
 * moves to canonical-EN + catalog with the `<Step id>` components (#3); the
 * ingredient DB stays inline bilingual reference data for now.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import type { Locale, Localized } from '../types';
import type {
  CanonicalRecipeFrontmatterV3,
  ConstraintT,
  FillT,
  KnobT,
  RecipeFrontmatterV3,
  RoleT,
} from './types';

const RECIPE_DIR = join(process.cwd(), 'src', 'content', 'recipes');

const catalogCache = new Map<string, Record<string, string>>();

/** Load a flat dotted-key catalog for one locale, or `{}` if the file is absent. */
function loadCatalog(slug: string, locale: Locale): Record<string, string> {
  const key = `${slug}.${locale}`;
  const cached = catalogCache.get(key);
  if (cached) return cached;
  const file = join(RECIPE_DIR, `${slug}.${locale}.yaml`);
  let result: Record<string, string>;
  try {
    result = (load(readFileSync(file, 'utf8')) ?? {}) as Record<string, string>;
  } catch {
    console.warn(`v3 i18n: recipe "${slug}" has no ${slug}.${locale}.yaml — all ${locale} text falls back to EN.`);
    result = {};
  }
  catalogCache.set(key, result);
  return result;
}

/**
 * The raw flat catalog for one recipe+locale. Used by the method `<Step>`
 * components, whose JA surface (`steps.<id>` templates) lives in the catalog
 * but outside the frontmatter that {@link hydrateRecipe} covers.
 */
export function recipeCatalog(slug: string, locale: Locale): Record<string, string> {
  return loadCatalog(slug, locale);
}

/**
 * Normalize a recipe's title to {@link Localized} regardless of shape: v1 holds
 * an inline `{ en, ja }`; v3 holds a canonical EN string with the JA in its
 * catalog. Used by the index, which lists both kinds.
 */
export function recipeTitle(data: { slug: string; title: string | Localized }): Localized {
  if (typeof data.title !== 'string') return data.title;
  const ja = loadCatalog(data.slug, 'ja').title;
  return { en: data.title, ja: ja ?? data.title };
}

/** A single hydration pass over one recipe: catalog + a running list of missing keys. */
interface Ctx {
  cat: Record<string, string>;
  missing: string[];
}

/** Build a Localized from canonical EN + the catalog entry at `path`. */
function loc(en: string, path: string, ctx: Ctx): Localized {
  const ja = ctx.cat[path];
  if (ja === undefined) {
    ctx.missing.push(path);
    return { en, ja: en };
  }
  return { en, ja };
}

/** Localize an optional field only when the canonical value is present. */
function locOpt(en: string | undefined, path: string, ctx: Ctx): Localized | undefined {
  return en === undefined ? undefined : loc(en, path, ctx);
}

function hydrateFill(fill: FillT<string>, roleId: string, ctx: Ctx): FillT<Localized> {
  const base = `roles.${roleId}.fills.${fill.id}`;
  return {
    id: fill.id,
    amount: fill.amount,
    default: fill.default,
    why: locOpt(fill.why, `${base}.why`, ctx),
    note: locOpt(fill.note, `${base}.note`, ctx),
    alias: locOpt(fill.alias, `${base}.alias`, ctx),
  };
}

function hydrateRole(roleId: string, role: RoleT<string>, ctx: Ctx): RoleT<Localized> {
  return {
    label: loc(role.label, `roles.${roleId}.label`, ctx),
    why: loc(role.why, `roles.${roleId}.why`, ctx),
    range: role.range,
    amount: role.amount,
    proportionalTo: role.proportionalTo,
    fixed: role.fixed,
    scale: role.scale,
    fills: role.fills.map((f) => hydrateFill(f, roleId, ctx)),
  };
}

function hydrateKnob(knobId: string, knob: KnobT<string>, ctx: Ctx): KnobT<Localized> {
  const base = `knobs.${knobId}`;
  const common = {
    label: loc(knob.label, `${base}.label`, ctx),
    why: locOpt(knob.why, `${base}.why`, ctx),
  };
  if (knob.kind === 'enum') {
    const optionLabels: Record<string, Localized> = {};
    for (const [opt, lbl] of Object.entries(knob.optionLabels ?? {})) {
      optionLabels[opt] = loc(lbl, `${base}.optionLabels.${opt}`, ctx);
    }
    return {
      kind: 'enum',
      ...common,
      values: knob.values,
      default: knob.default,
      optionLabels: knob.optionLabels ? optionLabels : undefined,
    };
  }
  if (knob.kind === 'bool') {
    return { kind: 'bool', ...common, default: knob.default };
  }
  return {
    kind: 'scalar',
    ...common,
    min: knob.min,
    max: knob.max,
    step: knob.step,
    default: knob.default,
  };
}

function hydrateConstraint(c: ConstraintT<string>, i: number, ctx: Ctx): ConstraintT<Localized> {
  return {
    when: c.when,
    warn: locOpt(c.warn, `constraints.${i}.warn`, ctx),
    error: locOpt(c.error, `constraints.${i}.error`, ctx),
  };
}

/**
 * Merge a canonical (EN) v3 frontmatter with its per-locale catalog(s) into the
 * `Localized` frontmatter the resolver consumes. Currently localizes to JA; the
 * `Localized` shape is `{ en, ja }` (extend when a third locale lands).
 */
export function hydrateRecipe(fm: CanonicalRecipeFrontmatterV3): RecipeFrontmatterV3 {
  const ctx: Ctx = { cat: loadCatalog(fm.slug, 'ja'), missing: [] };

  const knobs: Record<string, KnobT<Localized>> = {};
  for (const [id, knob] of Object.entries(fm.knobs ?? {})) {
    knobs[id] = hydrateKnob(id, knob, ctx);
  }
  const roles: Record<string, RoleT<Localized>> = {};
  for (const [id, role] of Object.entries(fm.roles)) {
    roles[id] = hydrateRole(id, role, ctx);
  }

  const hydrated: RecipeFrontmatterV3 = {
    title: loc(fm.title, 'title', ctx),
    slug: fm.slug,
    pattern: loc(fm.pattern, 'pattern', ctx),
    locales: fm.locales,
    servings: fm.servings,
    knobs: fm.knobs ? knobs : undefined,
    roles,
    constraints: fm.constraints?.map((c, i) => hydrateConstraint(c, i, ctx)),
    customize_title: locOpt(fm.customize_title, 'customize_title', ctx),
  };

  if (ctx.missing.length > 0) {
    console.warn(
      `v3 i18n: recipe "${fm.slug}" is missing ${ctx.missing.length} ja catalog ` +
        `key(s) (fell back to EN): ${ctx.missing.join(', ')}`,
    );
  }
  return hydrated;
}
