// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';

// GitHub Pages: project site served at https://<owner>.github.io/<repo>/
// Repo owner is the authenticated gh account `illeatmyhat`.
export default defineConfig({
  site: 'https://illeatmyhat.github.io',
  base: '/recipes',
  trailingSlash: 'ignore',
  integrations: [mdx(), svelte()],
  // Built-in `astro:assets` uses sharp for WebP conversion + responsive srcset.
  image: {
    responsiveStyles: true,
  },
});
