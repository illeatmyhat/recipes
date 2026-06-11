/**
 * Site-level UI localization — a typed facade over the per-locale catalogs in
 * `src/locales/<locale>.yaml` (flat dotted keys: `ui.*`, `nutrients.*`,
 * `sections.*`). Recipe content is localized separately, per recipe.
 *
 * The catalogs are DATA (one YAML per supported locale, imported at build via
 * @rollup/plugin-yaml); this module owns the typed key space and the
 * completeness gate: every locale must carry exactly the canonical key set,
 * and every key this module knows must exist — any drift throws at module
 * init, which fails the build. Adding a locale = adding one YAML file and the
 * `site.config.ts` entry; no code edits here (catalogs are discovered by
 * filename via import.meta.glob).
 */
import {
  isLocale,
  LOCALES,
  perLocale,
  type Locale,
  type Localized,
  type NutrientKey,
  type StoreSection,
} from './types';
import { NUTRIENT_KEYS } from './nutrition';

// Discover the catalogs from the folder, keyed by filename, so the file set —
// not this module — tracks the configured locale set. Both directions of
// drift are an error: a configured locale with no catalog file, and a stray
// catalog file for an unconfigured locale.
const catalogFiles = import.meta.glob<Record<string, string>>('../locales/*.yaml', {
  eager: true,
  import: 'default',
});
const CATALOGS = {} as Record<Locale, Record<string, string>>;
for (const [path, catalog] of Object.entries(catalogFiles)) {
  const tag = path.slice(path.lastIndexOf('/') + 1).replace(/\.yaml$/, '');
  if (!isLocale(tag)) {
    throw new Error(
      `i18n: stray site catalog src/locales/${tag}.yaml — "${tag}" is not in site.config.ts locales.`,
    );
  }
  CATALOGS[tag] = catalog;
}
for (const locale of LOCALES) {
  if (CATALOGS[locale] === undefined) {
    throw new Error(`i18n: missing site catalog src/locales/${locale}.yaml.`);
  }
}

/** Every UI-chrome key (the `ui.` namespace of the catalogs). */
const UI_KEYS = [
  'siteTitle',
  'siteTagline',
  'siteDescription',
  'languageLabel',
  'recipeKicker',
  'servings',
  'serving',
  'servingsPlural',
  'perServing',
  'wholeRecipe',
  'totalWord',
  'scaleToggle',
  'decrease',
  'increase',
  'nutritionFacts',
  'calories',
  'dailyValue',
  'dvShort',
  'dvFootnote',
  'dataDisclaimer',
  'breakdownHint',
  'highlights',
  'method',
  'language',
  'theme',
  'light',
  'dark',
  'themeToggle',
  'customizeStage',
  'shopStage',
  'cookStage',
  'stages',
  'adjust',
  'aboveMax',
  'optionBlocked',
  'miseEnPlace',
  'miseHint',
  'shopHint',
  'swap',
  'required',
  'pickUpTo',
  'listSeparator',
  'listFinalSeparator',
  'listPairSeparator',
  'pageTitle',
] as const;

/** Key of a known UI phrase. */
export type UIKey = (typeof UI_KEYS)[number];

/** Store-walk order of the shopping-list sections (labels live in the catalogs). */
const SECTION_ORDER: readonly StoreSection[] = [
  'produce',
  'meat_seafood',
  'tofu_soy',
  'dairy_eggs',
  'dry_goods',
  'canned',
  'condiments',
  'spices',
  'oils',
  'international',
  'other',
];

// ── completeness gate ─────────────────────────────────────────────────────────
// The catalogs are hand-edited YAML; this module is the schema. Key-set drift
// (between locales, or between a catalog and the typed key space) throws here,
// at module init — i.e. the build fails.
{
  const expected = [
    ...UI_KEYS.map((k) => `ui.${k}`),
    ...NUTRIENT_KEYS.map((k) => `nutrients.${k}`),
    ...SECTION_ORDER.map((k) => `sections.${k}`),
  ].sort();
  for (const locale of LOCALES) {
    const actual = Object.keys(CATALOGS[locale]).sort();
    const missing = expected.filter((k) => !actual.includes(k));
    const unknown = actual.filter((k) => !expected.includes(k));
    if (missing.length > 0 || unknown.length > 0) {
      const parts = [
        missing.length > 0 ? `missing: ${missing.join(', ')}` : '',
        unknown.length > 0 ? `unknown: ${unknown.join(', ')}` : '',
      ].filter(Boolean);
      throw new Error(`i18n: site catalog ${locale}.yaml key set is wrong — ${parts.join('; ')}`);
    }
  }
}

/** The catalog entry at `path`, in every locale (validated above, so total). */
function phraseAt(path: string): Localized {
  return perLocale((l) => CATALOGS[l][path] as string);
}

/** Every UI phrase, localized — for surfaces that render all locales at once. */
export const UI: Record<UIKey, Localized> = Object.fromEntries(
  UI_KEYS.map((k) => [k, phraseAt(`ui.${k}`)]),
) as Record<UIKey, Localized>;

/** Resolve a UI phrase for a locale. */
export function t(key: UIKey, locale: Locale): string {
  return CATALOGS[locale][`ui.${key}`] as string;
}

/** FDA-style nutrient labels, localized. */
export const NUTRIENT_LABELS: Record<NutrientKey, Localized> = Object.fromEntries(
  NUTRIENT_KEYS.map((k) => [k, phraseAt(`nutrients.${k}`)]),
) as Record<NutrientKey, Localized>;

/**
 * Supermarket section labels in store-walk order — the shopping list renders
 * its groups in this sequence. One shared id space; which section a food sits
 * in is per-locale data on the ingredient (`aisle`, see src/lib/types.ts).
 */
export const STORE_SECTIONS: ReadonlyArray<{ id: StoreSection; label: Localized }> =
  SECTION_ORDER.map((id) => ({ id, label: phraseAt(`sections.${id}`) }));
