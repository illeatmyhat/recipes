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
import { defaultParams } from './resolve';
import { extractSteps, readKey } from './steps';
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
  const recipe = hydrateRecipe(fm);

  const ids = new Set<string>();
  for (const role of Object.values(recipe.roles)) {
    for (const fill of role.fills) ids.add(fill.id);
  }

  const ingredients: Record<string, ReturnType<typeof loadIngredient>> = {};
  for (const id of ids) ingredients[id] = loadIngredient(id);

  // Step metadata: EN reads from the body, union'd with the JA catalog
  // template's placeholders; titles localized from `steps.<id>.title`.
  const catalog = recipeCatalog(fm.slug, 'ja');
  const steps: StepMeta[] = extractSteps(recipeBody(fm.slug)).map((s) => {
    const reads: StepRead[] = [...s.reads];
    const keys = new Set(reads.map(readKey));
    const template = catalog[`steps.${s.id}`];
    if (template !== undefined) {
      for (const read of templateReads(template)) {
        if (!keys.has(readKey(read))) {
          keys.add(readKey(read));
          reads.push(read);
        }
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
    return {
      id: s.id,
      when: s.when,
      title:
        s.title === undefined
          ? undefined
          : { en: s.title, ja: catalog[`steps.${s.id}.title`] ?? s.title },
      reads,
    };
  });

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
