# recipes

A small, static recipe site built with **Astro + MDX + Svelte**, deployed to
GitHub Pages. Each recipe is pre-rendered to plain HTML at build time and stays
fully readable with JavaScript disabled; three Svelte islands hydrate on scroll
to add interactivity.

## How it works

- **`data/ingredients/*.yaml`** — one file per ingredient, with USDA FoodData
  Central per-100g nutrition (so a recipe scales to any amount).
- **`src/content/recipes/*.mdx`** — recipe frontmatter (ingredient references,
  amounts, notes, warnings) plus the method body.
- **`src/lib/resolveRecipe.ts`** — at build time, merges the ingredient DB with
  a recipe's frontmatter, scales nutrition to the recipe amount, and converts
  `ml` ingredients to weight via density. Returns a fully typed `ResolvedRecipe`.
- **Svelte islands** (`src/components/*.svelte`) — `ServingsScaler`,
  `CustomizePanel`, and `NutritionPanel` share state through the writable
  stores in `RecipeStore.ts`, so servings and selections stay in sync with no
  prop drilling. `LocaleSwitcher` toggles 🇺🇸 / 🇯🇵.

## Scripts

| Command          | Action                                  |
| ---------------- | --------------------------------------- |
| `npm run dev`    | Start the dev server                    |
| `npm run build`  | Build the static site to `dist/`        |
| `npm run check`  | `astro check` — type-check the project  |
| `npm run preview`| Preview the production build            |

## Deployment

`.github/workflows/deploy.yml` builds with `withastro/action` and deploys to
GitHub Pages on every push to `main`.

## Credits

Hero image: ["A bowl of oatmeal with fruit and nuts"](https://unsplash.com/photos/a-bowl-of-oatmeal-with-fruit-and-nuts-s8GfYrV88vo)
by Alex Bayev on Unsplash, used under the free Unsplash License. It was cropped
to 16:9 with `scripts/process-hero.mjs`.

Hero image: ["A bowl of soup with a spoon"](https://unsplash.com/photos/OPeL-54iYOU)
by Alex Bayev on Unsplash, used under the free Unsplash License. It was cropped
to 16:9 with `scripts/process-hero.mjs`.

Hero image: ["Spaghetti carbonara served in a white bowl on a table"](https://unsplash.com/photos/spaghetti-carbonara-served-in-a-white-bowl-on-a-table-t3B9LxHcybc)
by Stötzer Balázs on Unsplash, used under the free Unsplash License. It was
cropped to 16:9 with `scripts/process-hero.mjs`.
