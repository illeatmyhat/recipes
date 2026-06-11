/**
 * Astro content collection for recipes.
 *
 * Recipes live in `src/content/recipes/*.mdx` so that MDX bodies, frontmatter,
 * and relative hero images all work natively. Ingredient data lives separately
 * under `/data/ingredients/*.yaml` and is merged in at build time by
 * `buildBundle` — see src/lib/recipe/bundle.ts.
 *
 * Frontmatter is the recipe-model shape (pattern/roles/fills, docs/recipe-model.md):
 * localizable fields hold the CANONICAL string; translations live in the
 * per-locale sidecar catalogs `<slug>.<locale>.yaml`, merged at build time
 * (src/lib/recipe/i18n.ts).
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LOCALES } from './lib/types';

const amount = z.object({
  value: z.number().positive(),
  unit: z.enum(['g', 'ml']),
});

const range = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().positive().optional(),
});

const provenance = z.enum(['source', 'editorial']);

const fill = z
  .object({
    id: z.string(),
    amount: amount.optional(),
    default: z.boolean().optional(),
    provenance: provenance.optional(),
    why: z.string().optional(),
    note: z.string().optional(),
    alias: z.string().optional(),
  })
  // The badge's "source point" is the default parameter point (Q11); that
  // equivalence only holds if nothing editorial is ever a default.
  .refine((f) => !(f.provenance === 'editorial' && f.default === true), {
    message: 'an editorial fill cannot be default: true — the default point IS the source point',
  });

const role = z
  .object({
    label: z.string(),
    why: z.string(),
    range,
    amount: amount.optional(),
    proportionalTo: z.string().optional(),
    fixed: z.boolean().optional(),
    scale: z.record(z.string(), z.number()).optional(),
    fills: z.array(fill).nonempty(),
  })
  // A zero-freedom role (min covers every fill) renders static, with no
  // toggles — so a non-default fill would be permanently unselectable:
  // absent from the default selection and from every surface, with only an
  // unrendered below-min notice to show for it. (Corollary: an editorial
  // fill, which can never be default, cannot sit in a zero-freedom role.)
  .refine((r) => r.range.min < r.fills.length || r.fills.every((f) => f.default === true), {
    message:
      'a role whose min covers every fill is zero-freedom — every fill must be default: true',
  });

const knob = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('enum'),
    label: z.string(),
    why: z.string().optional(),
    provenance: provenance.optional(),
    values: z.array(z.string()).nonempty(),
    default: z.string(),
    optionLabels: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    kind: z.literal('bool'),
    label: z.string(),
    why: z.string().optional(),
    provenance: provenance.optional(),
    default: z.boolean(),
  }),
  z.object({
    kind: z.literal('scalar'),
    label: z.string(),
    why: z.string().optional(),
    provenance: provenance.optional(),
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
    z.object({
      title: z.string(),
      slug: z.string(),
      hero_image: image(),
      customize_title: z.string().optional(),
      locales: z.array(z.enum(LOCALES)).nonempty(),
      pattern: z.string(),
      source: z.object({ name: z.string() }).optional(),
      servings,
      knobs: z.record(z.string(), knob).optional(),
      roles: z.record(z.string(), role),
      constraints: z.array(constraint).optional(),
    }),
});

export const collections = { recipes };
