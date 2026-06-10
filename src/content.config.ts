/**
 * Astro content collection for recipes.
 *
 * Recipes live in `src/content/recipes/*.mdx` so that MDX bodies, frontmatter,
 * and relative hero images all work natively. Ingredient data lives separately
 * under `/data/ingredients/*.yaml` and is merged in at build time by
 * `resolveRecipe` — see src/lib/resolveRecipe.ts.
 *
 * Two frontmatter shapes are accepted during the v3 migration, discriminated by
 * a required field: **v1** (`base_ingredients` — flat list + optional
 * categories) and **v3** (`roles` — pattern/roles/fills, see
 * docs/recipe-model.md). A recipe is one or the other; the resolver branches on
 * which is present.
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

// ── v1 (flat base + optional categories) ─────────────────────────────────────
const ingredientRef = z.object({
  id: z.string(),
  amount: z.number().positive(),
  unit: z.enum(['g', 'ml']),
  notes: localized,
  warnings: z.array(warning).default([]),
  group: localized.optional(),
});

const optionalIngredientRef = ingredientRef.extend({
  default: z.boolean().default(false),
});

const optionalCategory = z.object({
  id: z.string(),
  label: localized,
  ingredients: z.array(optionalIngredientRef).nonempty(),
});

// ── v3 (pattern / roles / fills) ─────────────────────────────────────────────
// Localizable fields hold the CANONICAL (EN) string; JA lives in the per-locale
// sidecar catalog `<slug>.ja.yaml` and is merged at build time (src/lib/v3/i18n.ts).
const amount = z.object({
  value: z.number().positive(),
  unit: z.enum(['g', 'ml']),
});

const range = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().positive().optional(),
});

const fill = z.object({
  id: z.string(),
  amount: amount.optional(),
  default: z.boolean().optional(),
  why: z.string().optional(),
  note: z.string().optional(),
  alias: z.string().optional(),
});

const role = z.object({
  label: z.string(),
  why: z.string(),
  range,
  amount: amount.optional(),
  proportionalTo: z.string().optional(),
  fixed: z.boolean().optional(),
  scale: z.record(z.string(), z.number()).optional(),
  fills: z.array(fill).nonempty(),
});

const knob = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('enum'),
    label: z.string(),
    why: z.string().optional(),
    values: z.array(z.string()).nonempty(),
    default: z.string(),
    optionLabels: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    kind: z.literal('bool'),
    label: z.string(),
    why: z.string().optional(),
    default: z.boolean(),
  }),
  z.object({
    kind: z.literal('scalar'),
    label: z.string(),
    why: z.string().optional(),
    min: z.number(),
    max: z.number(),
    step: z.number().optional(),
    default: z.number(),
  }),
]);

const constraint = z.object({
  when: z.string(),
  warn: z.string().optional(),
  error: z.string().optional(),
});

const servings = z.object({
  min: z.number().int().positive(),
  max: z.number().int().positive(),
  default: z.number().int().positive(),
});

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/recipes' }),
  schema: ({ image }) =>
    z.union([
      // v1 — required discriminant: base_ingredients
      z.object({
        title: localized,
        slug: z.string(),
        hero_image: image(),
        customize_title: localized.optional(),
        locales: z.array(z.enum(['en', 'ja'])).nonempty(),
        servings_default: z.number().int().positive(),
        base_ingredients: z.array(ingredientRef).nonempty(),
        optional_ingredients: z.array(optionalCategory),
      }),
      // v3 — required discriminant: roles + pattern + servings.
      // Localizable text is canonical EN; JA in the sidecar catalog.
      z.object({
        title: z.string(),
        slug: z.string(),
        hero_image: image(),
        customize_title: z.string().optional(),
        locales: z.array(z.enum(['en', 'ja'])).nonempty(),
        pattern: z.string(),
        servings,
        knobs: z.record(z.string(), knob).optional(),
        roles: z.record(z.string(), role),
        constraints: z.array(constraint).optional(),
      }),
    ]),
});

export const collections = { recipes };
