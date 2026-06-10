/**
 * Names in prose (v3).
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
import type { Locale, Localized } from '../types';
import type { Fill } from './types';

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
 * Localized list-join. Defends against an empty list (returns '') so a caller's
 * surrounding connective can collapse rather than dangle ("…and ." / "…と").
 */
export const joinNames: Record<Locale, (xs: string[]) => string> = {
  en: (xs) => {
    if (xs.length === 0) return '';
    if (xs.length === 1) return xs[0] as string;
    if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
    return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
  },
  ja: (xs) => xs.join('と'),
};
