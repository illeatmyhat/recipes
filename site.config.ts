/**
 * Site instance configuration — the one file an adopting site edits.
 *
 * This project is on its way to being an open-source recipe SSG: everything
 * under `src/` is engine, while this file plus the content trees
 * (`src/locales/*.yaml`, `src/content/recipes/`, `data/ingredients/`) are the
 * instance. Engine code never hardcodes a locale; it imports these constants
 * via `src/lib/types.ts`. See docs/ssg-template.md for the full split.
 *
 * `as const` matters: the locale tags become a TypeScript union (`Locale`),
 * which is what makes `Localized` records and the catalog completeness gates
 * exhaustive at compile time. Keep this file TypeScript, not YAML/JSON — the
 * type-level guarantees are the point.
 */
export const siteConfig = {
  /**
   * Every locale the site renders, as BCP-47 tags (the form `html lang`,
   * `navigator.language`, and the Intl APIs speak). Region-qualified on
   * purpose: a locale covers language AND market (store geography, aisles).
   *
   * Adding one: add the tag here, a site catalog `src/locales/<tag>.yaml`,
   * an ingredient overlay folder `data/ingredients/<tag>/`, and per-recipe
   * sidecar catalogs for each recipe that declares it. Every gap fails the
   * build with a named key — the gates are the checklist.
   */
  locales: ['en-US', 'ja-JP', 'zh-CN'],

  /**
   * The canonical authoring language: recipe MDX bodies and frontmatter, and
   * the ingredient DB's inline names. Must be one of `locales` (type-checked).
   */
  canonicalLocale: 'en-US',
} as const;
