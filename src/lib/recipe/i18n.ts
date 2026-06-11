/**
 * Recipe catalog localization (build time).
 *
 * A recipe's MDX frontmatter holds the **canonical** text; each catalog
 * locale's strings live in a per-locale sidecar catalog
 * `src/content/recipes/<slug>.<locale>.yaml`, a flat map keyed by dotted paths
 * (e.g. `roles.protein.why`, `roles.protein.fills.tofu.alias`). `hydrateRecipe`
 * merges canonical + catalog into the `Localized` shape the engine consumes.
 *
 * Completeness is a build ERROR (decided 2026-06-10): a recipe declaring a
 * locale must translate every key — an untranslated string blocks deploy
 * rather than silently shipping the canonical text. (Staleness stays a
 * warning; it needs human review.) Touches the filesystem — build time only.
 *
 * Scope note: this localizes the **frontmatter** content. The method *body*
 * is canonical prose + catalog step templates (the `<Step id>` components);
 * the ingredient DB carries its own per-locale files (db.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { CATALOG_LOCALES, type Locale, type Localized } from '../types';
import { localizeAll } from './names';
import type {
  CanonicalRecipeFrontmatter,
  ConstraintT,
  FillT,
  KnobT,
  RecipeFrontmatter,
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
  } catch (err) {
    // Only a MISSING catalog degrades to the canonical text; a present-but-broken one (YAML
    // syntax error) must fail the build — silently dropping a whole locale is
    // worse than a red build.
    if ((err as { code?: string }).code !== 'ENOENT') throw err;
    console.warn(`recipe i18n: recipe "${slug}" has no ${slug}.${locale}.yaml — all ${locale} text falls back to the canonical text.`);
    result = {};
  }
  catalogCache.set(key, result);
  return result;
}

/**
 * The raw flat catalog for one recipe+locale. Used by the method `<Step>`
 * components, whose step-template surfaces (`steps.<id>`) live in the catalog
 * but outside the frontmatter that {@link hydrateRecipe} covers.
 */
export function recipeCatalog(slug: string, locale: Locale): Record<string, string> {
  return loadCatalog(slug, locale);
}

/**
 * A recipe's {@link Localized} title: the canonical string from the
 * frontmatter plus each catalog locale's translation (canonical fallback).
 * Used by the index.
 */
export function recipeTitle(data: { slug: string; title: string }): Localized {
  const out = localizeAll(data.title);
  for (const locale of CATALOG_LOCALES) {
    const title = loadCatalog(data.slug, locale).title;
    if (title !== undefined) out[locale] = title;
  }
  return out;
}

/** One catalog locale's state during a hydration pass. */
interface CatalogSlot {
  locale: Locale;
  cat: Record<string, string>;
  /** The recipe declares this locale, so a missing key is a build error. */
  required: boolean;
  missing: string[];
}

/** A single hydration pass over one recipe: per-locale catalogs + missing keys. */
interface Ctx {
  cats: CatalogSlot[];
  /** When present, every visited path's canonical text is recorded here (staleness lint). */
  sources?: Record<string, string>;
}

/** Build a Localized from the canonical string + each catalog's entry at `path`. */
function loc(canonical: string, path: string, ctx: Ctx): Localized {
  if (ctx.sources) ctx.sources[path] = canonical;
  const out = localizeAll(canonical);
  for (const c of ctx.cats) {
    const value = c.cat[path];
    if (value === undefined) c.missing.push(path);
    else out[c.locale] = value;
  }
  return out;
}

/** Localize an optional field only when the canonical value is present. */
function locOpt(canonical: string | undefined, path: string, ctx: Ctx): Localized | undefined {
  return canonical === undefined ? undefined : loc(canonical, path, ctx);
}

function hydrateFill(fill: FillT<string>, roleId: string, ctx: Ctx): FillT<Localized> {
  const base = `roles.${roleId}.fills.${fill.id}`;
  return {
    id: fill.id,
    amount: fill.amount,
    default: fill.default,
    provenance: fill.provenance,
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
    provenance: knob.provenance,
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
 * Merge a canonical frontmatter with its per-locale catalogs into the
 * `Localized` frontmatter the resolver consumes — one catalog per
 * `CATALOG_LOCALES` entry, each falling back to the canonical text when a
 * key is absent (an error when the recipe declares that locale).
 * Pass `sources` to also collect every visited path's canonical string
 * (feeds the staleness lint — see staleness.ts).
 */
export function hydrateRecipe(
  fm: CanonicalRecipeFrontmatter,
  sources?: Record<string, string>,
): RecipeFrontmatter {
  const ctx: Ctx = {
    cats: CATALOG_LOCALES.map((locale) => ({
      locale,
      cat: loadCatalog(fm.slug, locale),
      required: fm.locales.includes(locale),
      missing: [],
    })),
    sources,
  };

  const knobs: Record<string, KnobT<Localized>> = {};
  for (const [id, knob] of Object.entries(fm.knobs ?? {})) {
    knobs[id] = hydrateKnob(id, knob, ctx);
  }
  const roles: Record<string, RoleT<Localized>> = {};
  for (const [id, role] of Object.entries(fm.roles)) {
    roles[id] = hydrateRole(id, role, ctx);
  }

  const hydrated: RecipeFrontmatter = {
    title: loc(fm.title, 'title', ctx),
    slug: fm.slug,
    pattern: loc(fm.pattern, 'pattern', ctx),
    locales: fm.locales,
    source: fm.source ? { name: loc(fm.source.name, 'source.name', ctx) } : undefined,
    servings: fm.servings,
    knobs: fm.knobs ? knobs : undefined,
    roles,
    constraints: fm.constraints?.map((c, i) => hydrateConstraint(c, i, ctx)),
    customize_title: locOpt(fm.customize_title, 'customize_title', ctx),
  };

  // Completeness gate: only recipes that declare a locale owe it a full
  // catalog (a canonical-only recipe is legitimate and skips this entirely).
  for (const c of ctx.cats) {
    if (c.required && c.missing.length > 0) {
      throw new Error(
        `recipe i18n: recipe "${fm.slug}" declares ${c.locale} but is missing ${c.missing.length} ` +
          `catalog key(s) in ${fm.slug}.${c.locale}.yaml: ${c.missing.join(', ')}`,
      );
    }
  }
  return hydrated;
}
