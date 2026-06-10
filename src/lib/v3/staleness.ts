/**
 * Catalog staleness lint (v3, #4) — the gettext "fuzzy" mechanism.
 *
 * A catalog is keyed by stable IDs, so when the canonical EN text changes the
 * old translation keeps matching its key and ships silently. To catch that,
 * a machine-written sidecar `<slug>.<locale>.hashes.yaml` stores, per
 * translated key, a short hash of the EN source it was translated from. At
 * build time the current EN is re-hashed and compared: mismatch ⇒ the English
 * moved underneath the translation ⇒ "stale" warning. The hash is a change
 * detector only — it cannot judge translation quality.
 *
 * Refresh the sidecar after updating translations:
 *   bash:        REFRESH_CATALOG_HASHES=1 npm run build
 *   PowerShell:  $env:REFRESH_CATALOG_HASHES='1'; npm run build
 *
 * Warnings only (never a build error): staleness needs human review by
 * design. Touches the filesystem — build time only.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import type { Locale } from '../types';

const RECIPE_DIR = join(process.cwd(), 'src', 'content', 'recipes');

/** Short content hash of a source string (whitespace-normalized so MDX rewrapping doesn't churn it). */
export function hashSource(s: string): string {
  return createHash('sha256')
    .update(s.replace(/\s+/g, ' ').trim(), 'utf8')
    .digest('hex')
    .slice(0, 8);
}

/**
 * Compare each translated key's stored source hash against the current EN
 * source; warn on stale/unhashed/orphaned entries. With REFRESH_CATALOG_HASHES
 * set, rewrite the sidecar from the current sources instead.
 *
 * `sources` maps catalog paths to their canonical EN strings (collected during
 * hydration + step extraction); `catalog` is the locale's flat sidecar.
 */
export function lintCatalogStaleness(
  slug: string,
  locale: Locale,
  sources: Record<string, string>,
  catalog: Record<string, string>,
): void {
  const file = join(RECIPE_DIR, `${slug}.${locale}.hashes.yaml`);
  const keys = Object.keys(catalog)
    .filter((k) => sources[k] !== undefined)
    .sort();

  // A catalog key matching no EN source is a typo'd path (or text that no
  // longer exists) — it can never render.
  const orphans = Object.keys(catalog).filter((k) => sources[k] === undefined);
  if (orphans.length > 0) {
    console.warn(
      `v3 i18n: recipe "${slug}" ${locale} catalog key(s) match no canonical source ` +
        `(typo'd path, or the EN text was removed): ${orphans.join(', ')}`,
    );
  }

  if (process.env.REFRESH_CATALOG_HASHES) {
    const lines = [
      `# Machine-written — do not edit. Refresh: REFRESH_CATALOG_HASHES=1 npm run build`,
      `# Per translated key in ${slug}.${locale}.yaml: sha-256[0:8] of the EN source it`,
      `# was translated from. The build warns when the EN changes underneath (staleness).`,
      // Quoted: a hex hash can look like a YAML number ("7815e754" parses as
      // a float in scientific notation → Infinity) — quoting keeps it a string.
      ...keys.map((k) => `${k}: "${hashSource(sources[k] as string)}"`),
    ];
    writeFileSync(file, lines.join('\n') + '\n');
    console.warn(`v3 i18n: refreshed ${keys.length} source hashes → ${slug}.${locale}.hashes.yaml`);
    return;
  }

  if (!existsSync(file)) {
    console.warn(
      `v3 i18n: recipe "${slug}" has no ${slug}.${locale}.hashes.yaml — translation staleness ` +
        `cannot be checked. Generate it: REFRESH_CATALOG_HASHES=1 npm run build`,
    );
    return;
  }

  const stored = (load(readFileSync(file, 'utf8')) ?? {}) as Record<string, string>;
  const stale = keys.filter(
    (k) => stored[k] !== undefined && stored[k] !== hashSource(sources[k] as string),
  );
  const unhashed = keys.filter((k) => stored[k] === undefined);
  if (stale.length > 0) {
    console.warn(
      `v3 i18n: recipe "${slug}" ${locale} translation(s) STALE — the EN source changed ` +
        `underneath: ${stale.join(', ')}. Re-review the ${locale} text, then refresh the hashes.`,
    );
  }
  if (unhashed.length > 0) {
    console.warn(
      `v3 i18n: recipe "${slug}" ${locale} translation(s) have no source hash yet: ` +
        `${unhashed.join(', ')}. Refresh: REFRESH_CATALOG_HASHES=1 npm run build`,
    );
  }
}
