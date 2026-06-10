/**
 * Astro content collection for recipes.
 *
 * Recipes live in `src/content/recipes/*.mdx` so that MDX bodies, frontmatter,
 * and relative hero images all work natively. Ingredient data lives separately
 * under `/data/ingredients/*.yaml` and is merged in at build time by
 * `resolveRecipe` — see src/lib/resolveRecipe.ts.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const localized = z.object({
  en: z.string(),
  ja: z.string(),
});

const warning = z.object({
  type: z.enum(['avoid', 'good']),
  en: z.string(),
  ja: z.string(),
});

const ingredientRef = z.object({
  id: z.string(),
  amount: z.number().positive(),
  unit: z.enum(['g', 'ml']),
  notes: localized,
  warnings: z.array(warning).default([]),
  // Optional sub-group heading for a base ingredient (e.g. "Protein"). Omit it
  // and the base list renders under the single generic "Base" heading.
  group: localized.optional(),
});

const optionalIngredientRef = ingredientRef.extend({
  default: z.boolean().default(false),
});

// An optional-ingredient category is whatever the recipe author defines — its
// id, a localized label, and the ingredients in it. No category set is baked in.
const optionalCategory = z.object({
  id: z.string(),
  label: localized,
  ingredients: z.array(optionalIngredientRef).nonempty(),
});

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/recipes' }),
  schema: ({ image }) =>
    z.object({
      title: localized,
      slug: z.string(),
      hero_image: image(),
      // Optional per-recipe heading for the Customize tab. When omitted the UI
      // falls back to the generic `customizeTitle` string in i18n.ts — set this
      // when a recipe-specific phrasing ("Customize your bowl") reads better.
      customize_title: localized.optional(),
      locales: z.array(z.enum(['en', 'ja'])).nonempty(),
      servings_default: z.number().int().positive(),
      base_ingredients: z.array(ingredientRef).nonempty(),
      optional_ingredients: z.array(optionalCategory),
    }),
});

export const collections = { recipes };
