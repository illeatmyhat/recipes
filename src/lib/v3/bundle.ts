/**
 * Build-time recipe bundle (v3).
 *
 * Packages everything a client island needs to re-resolve a recipe as the user
 * changes parameters: the hydrated recipe, every referenced ingredient's data
 * (so the pure `resolve` runs without filesystem access), the default
 * parameter point, and the method's step metadata (extracted from the MDX
 * body — steps.ts — with each step's catalog-template reads merged in, so the
 * Cook stage can bucket ingredients by step). The result is plain,
 * serializable data handed to the islands as a prop. Touches the filesystem —
 * build only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hydrateRecipe, recipeCatalog } from './i18n';
import { loadIngredient } from './db';
import { templateReads } from './method';
import { localizeAll } from './names';
import { defaultParams } from './resolve';
import { lintCatalogStaleness } from './staleness';
import { extractSteps, readKey } from './steps';
import { CATALOG_LOCALES } from '../types';
import type { CanonicalRecipeFrontmatterV3, RecipeBundle, StepMeta, StepRead } from './types';

const RECIPE_DIR = join(process.cwd(), 'src', 'content', 'recipes');

/** The MDX body (everything after the closing frontmatter fence). */
function recipeBody(slug: string): string {
  const raw = readFileSync(join(RECIPE_DIR, `${slug}.mdx`), 'utf8');
  const fence = raw.indexOf('\n---', raw.indexOf('---') + 3);
  return fence < 0 ? raw : raw.slice(fence + 4);
}

/** Build the serializable bundle for one v3 recipe from its canonical frontmatter. */
export function buildBundle(fm: CanonicalRecipeFrontmatterV3): RecipeBundle {
  // Canonical EN source per catalog path — fed by hydration (frontmatter) and
  // step extraction (method body) below, then handed to the staleness lint.
  const sources: Record<string, string> = {};
  const recipe = hydrateRecipe(fm, sources);

  const ids = new Set<string>();
  for (const role of Object.values(recipe.roles)) {
    for (const fill of role.fills) ids.add(fill.id);
  }

  const ingredients: Record<string, ReturnType<typeof loadIngredient>> = {};
  for (const id of ids) ingredients[id] = loadIngredient(id);

  // Step metadata: canonical reads from the body, union'd with every catalog
  // locale's template placeholders; titles localized from `steps.<id>.title`.
  const catalogs = CATALOG_LOCALES.map((locale) => ({
    locale,
    cat: recipeCatalog(fm.slug, locale),
  }));
  const steps: StepMeta[] = extractSteps(recipeBody(fm.slug)).map((s) => {
    sources[`steps.${s.id}`] = s.body;
    if (s.title !== undefined) sources[`steps.${s.id}.title`] = s.title;
    const reads: StepRead[] = [...s.reads];
    const keys = new Set(reads.map(readKey));
    const canonicalKeys = new Set(s.reads.map(readKey));
    for (const { locale, cat } of catalogs) {
      const template = cat[`steps.${s.id}`];
      if (template === undefined) continue;
      const locReads = templateReads(template);
      const locKeys = new Set(locReads.map(readKey));
      for (const read of locReads) {
        if (!keys.has(readKey(read))) {
          keys.add(readKey(read));
          reads.push(read);
        }
      }
      // Read-set parity lint (#4): a warning, never an error — a locale
      // legitimately drops arguments the canonical sentence carries.
      const canonicalOnly = [...canonicalKeys].filter((k) => !locKeys.has(k));
      const locOnly = [...locKeys].filter((k) => !canonicalKeys.has(k));
      if (canonicalOnly.length > 0 || locOnly.length > 0) {
        const parts = [
          canonicalOnly.length > 0 ? `canonical-only: ${canonicalOnly.join(', ')}` : '',
          locOnly.length > 0 ? `${locale}-only: ${locOnly.join(', ')}` : '',
        ].filter(Boolean);
        console.warn(
          `v3 bundle: recipe "${fm.slug}" step "${s.id}" reads differ between canonical and ${locale} (${parts.join('; ')}) — fine if intentional.`,
        );
      }
    }
    for (const read of reads) {
      const role = recipe.roles[read.role];
      if (!role) {
        throw new Error(`v3 bundle: step "${s.id}" reads unknown role "${read.role}".`);
      }
      if (read.fill !== undefined && !role.fills.some((f) => f.id === read.fill)) {
        throw new Error(`v3 bundle: step "${s.id}" reads unknown fill "${read.role}:${read.fill}".`);
      }
    }
    let title;
    if (s.title !== undefined) {
      title = localizeAll(s.title);
      for (const { locale, cat } of catalogs) {
        const value = cat[`steps.${s.id}.title`];
        if (value !== undefined) title[locale] = value;
      }
    }
    return { id: s.id, when: s.when, title, reads };
  });

  for (const { locale, cat } of catalogs) {
    lintCatalogStaleness(fm.slug, locale, sources, cat);
  }

  // A role no step reads never appears in the Cook stage — almost certainly
  // an authoring gap (the ingredient would be bought but never reached for).
  const readRoles = new Set(steps.flatMap((s) => s.reads.map((r) => r.role)));
  for (const roleId of Object.keys(recipe.roles)) {
    if (!readRoles.has(roleId)) {
      console.warn(`v3 bundle: recipe "${fm.slug}" role "${roleId}" is read by no step — it will be missing from the Cook stage.`);
    }
  }

  return { recipe, ingredients, defaults: defaultParams(recipe), steps };
}
