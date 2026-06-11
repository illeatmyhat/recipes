/**
 * Names in prose.
 *
 * The catalog/DB name is a *canonical* name, not a *sentence* name: USDA names
 * are Title-Cased and some carry commas/parentheticals ("Salt, table";
 * "Kiwifruit (kiwi), green, peeled, raw"). For step prose, a fill's name is
 * resolved separately:
 *
 *   1. the fill's recipe-specific `alias` (a bare noun phrase), else
 *   2. a prose-normalized DB name (parenthetical + trailing clause stripped,
 *      lower-cased).
 *
 * Surrounding grammar (articles, connectives) belongs to the step template and
 * the list-join, never the name.
 */
import { t } from '../i18n';
import { perLocale, type Locale, type Localized } from '../types';
import type { Fill } from './types';

/** The same string in every locale — the fallback shape for unlocalized values. */
export function localizeAll(value: string): Localized {
  return perLocale(() => value);
}

/**
 * Humanize an ingredient id for fallback display: `smoked_paprika` →
 * `Smoked paprika`. The single source for every missing-ingredient name
 * (db.ts, RecipeStore.ts, method.ts) — prose contexts run
 * the result through {@link normalizeProse}, so display stays capitalized and
 * prose stays lower-case from one definition.
 */
export function humanizeId(id: string): string {
  const words = id.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Defensive names for an ingredient id missing from the DB or bundle. */
export function fallbackNames(id: string): Localized {
  return localizeAll(humanizeId(id));
}

/** Strip a parenthetical, a trailing comma-clause, and case from a canonical name. */
export function normalizeProse(raw: string): string {
  return raw
    .replace(/\s*[（(][^（）()]*[）)]/g, '') // "(kiwi)" / "（生）"
    .replace(/[,、].*$/, '') // ", green, peeled, raw" / ", table"
    .trim()
    .toLowerCase();
}

/** The prose name for a fill in one locale: alias if present, else normalized DB name. */
export function proseName(fill: Fill | undefined, dbNames: Localized, loc: Locale): string {
  const alias = fill?.alias;
  if (alias) return alias[loc];
  return normalizeProse(dbNames[loc]);
}

/**
 * Localized list-join. The separators are catalog data
 * (`ui.listSeparator` / `ui.listFinalSeparator` / `ui.listPairSeparator`),
 * so the shape is one rule for every locale: A<sep>B<sep>…<finalSep>Z, with
 * exactly two items joined by pairSep (English wants "A and B" with no
 * comma, but ", and" before the last of three or more).
 * Defends against an empty list (returns '') so a caller's surrounding
 * connective can collapse rather than dangle ("…and ." / "…と").
 */
export function joinNames(xs: string[], loc: Locale): string {
  if (xs.length === 0) return '';
  if (xs.length === 1) return xs[0] as string;
  if (xs.length === 2) return `${xs[0]}${t('listPairSeparator', loc)}${xs[1]}`;
  return (
    xs.slice(0, -1).join(t('listSeparator', loc)) +
    t('listFinalSeparator', loc) +
    xs[xs.length - 1]
  );
}
