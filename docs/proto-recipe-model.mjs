/**
 * PROTOTYPE — throwaway. Delete me once the v3 recipe model is validated.
 *
 * Question it answers: does the pattern/role/fill model in docs/recipe-model.md
 * actually compute when it meets a runtime — substitutive partition, additive
 * roles, servings scaling, ml->g, the nutrition fold, derived Base, the
 * guard-polarity boundness check, and the localized multi-fill list-join?
 *
 * Run:  node docs/proto-recipe-model.mjs
 * Then type commands (`help`). Loads the REAL ingredient YAML from
 * data/ingredients so the nutrition is the honest SR-Legacy data.
 *
 * This is NOT production code: math is re-inlined, no types, no tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { load } from 'js-yaml';

// ── real nutrition math (mirrors src/lib/nutrition.ts, 12 nutrients) ─────────
const KEYS = [
  'calories', 'fat', 'saturated_fat', 'trans_fat', 'cholesterol', 'sodium',
  'carbohydrates', 'fiber', 'sugars', 'protein', 'calcium', 'iron',
];
const UNITS = {
  calories: 'kcal', fat: 'g', saturated_fat: 'g', trans_fat: 'g',
  cholesterol: 'mg', sodium: 'mg', carbohydrates: 'g', fiber: 'g',
  sugars: 'g', protein: 'g', calcium: 'mg', iron: 'mg',
};
const empty = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const scale = (f, m) => Object.fromEntries(KEYS.map((k) => [k, (f[k] ?? 0) * m]));
const sum = (rows) => rows.reduce((a, r) => {
  for (const k of KEYS) a[k] += r.nutrition[k];
  return a;
}, empty());

// ── ingredient DB: load the real YAML, zero-placeholder on miss ──────────────
const DIR = join(process.cwd(), 'data', 'ingredients');
const dbCache = new Map();
function db(id) {
  if (dbCache.has(id)) return dbCache.get(id);
  let data;
  try {
    data = load(readFileSync(join(DIR, `${id}.yaml`), 'utf8'));
  } catch {
    const name = id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    data = { id, names: { en: name, ja: name }, nutrition: { per_100g: empty() },
             density_g_per_ml: 1, _placeholder: true };
  }
  dbCache.set(id, data);
  return data;
}
function grams(amount, id) {
  if (amount.unit === 'g') return amount.value;
  const d = db(id).density_g_per_ml;
  if (d == null) throw new Error(`${id}: ml used but density is null`);
  return amount.value * d;
}

// ── the stew, in the v3 shape (abridged) ─────────────────────────────────────
const stew = {
  pattern: 'High volume, high fiber, enough protein, low calorie density.',
  servings: { min: 1, max: 8, default: 4 },
  roles: {
    added_fat: {
      why: 'Whole-pot fat budget; skippable (water-saute works).',
      range: { min: 0, max: 1 },
      fills: [{ id: 'olive_oil', amount: { value: 15, unit: 'ml' }, default: true,
                alias: { en: 'olive oil', ja: 'オリーブオイル' } }],
    },
    aromatics: {
      why: 'Flavor base from near-zero-calorie vegetables.',
      range: { min: 1 },                         // additive
      fills: [
        { id: 'onion', amount: { value: 200, unit: 'g' }, default: true,
          alias: { en: 'onion', ja: '玉ねぎ' } },
        { id: 'garlic', amount: { value: 12, unit: 'g' }, default: true,
          alias: { en: 'garlic', ja: 'にんにく' } },
      ],
    },
    lentils: {
      why: 'Protein, fiber, iron, and thickens the broth.',
      range: { min: 1, max: 1 },
      fills: [{ id: 'lentils', amount: { value: 96, unit: 'g' }, default: true,
                alias: { en: 'lentils', ja: 'レンズ豆' } }],
    },
    protein: {
      why: 'Lean protein for satiety per calorie.',
      range: { min: 1, max: 2 },
      amount: { value: 396, unit: 'g' },         // substitutive: fills partition this
      fills: [
        { id: 'tofu', default: true, alias: { en: 'tofu', ja: '豆腐' } },          // uses role full-equiv 396
        { id: 'chicken_breast', amount: { value: 250, unit: 'g' },                 // own full-equiv
          alias: { en: 'chicken', ja: '鶏むね肉' } },
      ],
    },
    potato: {
      why: 'The satiety star: dense, cheap volume.',
      range: { min: 1, max: 1 },
      fills: [{ id: 'potato', amount: { value: 550, unit: 'g' }, default: true,
                alias: { en: 'potatoes', ja: 'じゃがいも' } }],
    },
    greens: {
      why: 'Volume + micronutrients at almost no calories.',
      range: { min: 1, max: 2 },
      amount: { value: 60, unit: 'g' },          // substitutive
      fills: [
        { id: 'spinach', default: true, alias: { en: 'spinach', ja: 'ほうれん草' } },
        { id: 'kale', alias: { en: 'kale', ja: 'ケール' } },
      ],
    },
    seasonings: {
      why: 'Umami and warmth at near-zero calories.',
      range: { min: 2, max: 6 },                 // additive; max advisory
      fills: [
        { id: 'soy_sauce', amount: { value: 30, unit: 'ml' }, default: true,
          alias: { en: 'soy sauce', ja: 'しょうゆ' } },
        { id: 'cumin', amount: { value: 2, unit: 'g' }, default: true,
          alias: { en: 'cumin', ja: 'クミン' } },
        { id: 'salt', amount: { value: 2, unit: 'g' }, default: true,
          alias: { en: 'salt', ja: '塩' } },     // vs canonical "Salt, table"
      ],
    },
  },
  // canonical-EN body, steps carry id + optional guard; `reads` would be DERIVED
  // from <Ref> in the real build — here I list it explicitly to drive the checker.
  steps: [
    { id: 'prep_aromatics', reads: ['aromatics'],
      en: 'Chop the {aromatics} into big pieces.', ja: '{aromatics}を大きめに刻む。' },
    { id: 'start_base', when: "has(added_fat,'olive_oil')", reads: ['added_fat'],
      en: 'Heat the {added_fat} and soften the aromatics.', ja: '{added_fat}を熱し香味野菜を炒める。' },
    { id: 'add_core', reads: ['lentils', 'protein'],
      en: 'Stir in the {lentils} and {protein}.', ja: '{lentils}と{protein}を加える。' },
    { id: 'hold_chicken', when: "has(protein,'chicken_breast')", reads: ['protein'],
      // fill-scoped ref {role:fill} names ONLY that fill, not the whole role
      en: 'Hold the {protein:chicken_breast} back — add at the 20-minute mark.',
      ja: '{protein:chicken_breast}は後入れ。20分経過時に加える。' },
    { id: 'season', reads: ['seasonings'],
      en: 'Add the {seasonings} and cook a few minutes.', ja: '{seasonings}を加えて数分煮る。' },
    { id: 'add_veg', reads: ['potato'],
      en: 'Add the {potato} and just cover with water.', ja: '{potato}を加え、水をかぶるまで注ぐ。' },
    { id: 'finish', reads: ['greens'],
      en: 'Stir in the {greens} and let wilt.', ja: '{greens}を加えてしんなりさせる。' },
  ],
};

// deliberately BROKEN steps, fed only to the boundness checker to prove it bites
const badSteps = [
  { id: 'BAD_unguarded', reads: ['added_fat'],
    en: 'Drizzle the {added_fat}.', note: 'reads min:0 role with NO guard' },
  { id: 'BAD_negated', when: "!has(added_fat,'olive_oil')", reads: ['added_fat'],
    en: 'Skip the {added_fat}.', note: 'guard proves the OPPOSITE (negated)' },
  { id: 'BAD_disjunct', when: "has(added_fat,'olive_oil') || servings > 4", reads: ['added_fat'],
    en: 'Maybe {added_fat}.', note: 'has() under || does not guarantee bound' },
];

// ── localized list-join (open question #8) ───────────────────────────────────
// Defends against empty lists (finding #3): no items => '' (caller collapses).
const joiners = {
  en: (xs) => xs.length === 0 ? '' : xs.length === 1 ? xs[0]
    : xs.length === 2 ? `${xs[0]} and ${xs[1]}`
    : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`,
  ja: (xs) => xs.join('と'),
};

// Prose name for a fill (finding #2): recipe alias first, else a prose-normalized
// DB name (lower-cased, comma-stripped) — never the raw Title-Cased catalog name.
function proseName(fillObj, id, loc) {
  if (fillObj?.alias) return fillObj.alias[loc];
  const raw = db(id).names[loc] ?? id;
  return raw.replace(/,.*/, '').toLowerCase();
}

// ── boundness / guard-polarity checker ───────────────────────────────────────
// A read of a min:0 role X is "proven bound" iff the guard has a positive
// has(X,...) as a top-level && conjunct (not negated, not under ||).
function provenBound(when) {
  if (!when) return new Set();
  if (when.includes('||')) return new Set();          // any || => no guarantee
  const out = new Set();
  for (const conj of when.split('&&').map((s) => s.trim())) {
    const m = /^has\(\s*([a-z_]+)\s*,/.exec(conj);     // positive has(role,...)
    if (m) out.add(m[1]);
  }
  return out;
}
function checkBoundness(recipe, steps) {
  const min0 = new Set(Object.entries(recipe.roles)
    .filter(([, r]) => (r.range.min ?? 0) === 0).map(([id]) => id));
  const problems = [];
  for (const s of steps) {
    const bound = provenBound(s.when);
    for (const r of s.reads) {
      if (min0.has(r) && !bound.has(r)) {
        problems.push(`  ✗ ${s.id}: reads min:0 role '${r}' without a positive has(${r},…) guard`
          + (s.note ? `  (${s.note})` : ''));
      }
    }
  }
  return problems;
}

// ── resolve(recipe, db, Params) ──────────────────────────────────────────────
function resolve(recipe, P) {
  const sFactor = P.servings / recipe.servings.default;
  const rows = [];
  const warnings = [];

  for (const [roleId, role] of Object.entries(recipe.roles)) {
    const picked = P.selection[roleId] ?? [];
    const min = role.range.min ?? 0;
    const max = role.range.max ?? Infinity;
    if (picked.length < min)
      warnings.push(`role '${roleId}': ${picked.length} < min ${min} (dish breaks)`);
    if (picked.length > max)
      warnings.push(`role '${roleId}': ${picked.length} > max ${max} (advisory)`);
    if (picked.length === 0) continue;

    const substitutive = role.amount != null;
    const k = picked.length;
    for (const fillId of picked) {
      const fill = role.fills.find((f) => f.id === fillId);
      if (!fill) { warnings.push(`role '${roleId}': unknown fill '${fillId}'`); continue; }
      // base grams BEFORE servings:
      let baseAmount;
      if (substitutive) {
        const fullEquiv = fill.amount ?? role.amount;   // fill overrides role full-equiv
        baseAmount = { value: fullEquiv.value / k, unit: fullEquiv.unit }; // fraction-space split
      } else {
        baseAmount = fill.amount;                        // additive: own amount
      }
      const g = grams(baseAmount, fillId) * sFactor;
      rows.push({
        role: roleId, id: fillId, grams: g,
        names: db(fillId).names,
        placeholder: db(fillId)._placeholder === true,
        nutrition: scale(db(fillId).nutrition.per_100g, g / 100),
      });
    }
  }
  return { rows, totals: sum(rows), warnings };
}

// derived Base tier: min>=1 AND exactly one fill
const isBase = (role) => (role.range.min ?? 0) >= 1 && role.fills.length === 1;

// ── rendering ────────────────────────────────────────────────────────────────
let locale = 'en';
let P = {
  servings: stew.servings.default,
  selection: Object.fromEntries(Object.entries(stew.roles)
    .map(([id, r]) => [id, r.fills.filter((f) => f.default).map((f) => f.id)])),
};

function render() {
  const { rows, totals, warnings } = resolve(stew, P);
  const L = (n) => n[locale];
  console.log('\n' + '═'.repeat(64));
  console.log(`PATTERN: ${stew.pattern}`);
  console.log(`servings=${P.servings}  locale=${locale}`);
  console.log('─'.repeat(64));

  // ingredients grouped by role, base tier flagged
  console.log('INGREDIENTS (by role):');
  for (const [roleId, role] of Object.entries(stew.roles)) {
    const picked = rows.filter((r) => r.role === roleId);
    if (picked.length === 0) continue;
    const tag = isBase(role) ? ' [BASE]' : role.amount != null ? ' [substitutive]' : ' [additive]';
    console.log(`  ${roleId}${tag}`);
    for (const r of picked) {
      console.log(`      ${L(r.names)}  ${r.grams.toFixed(1)} g${r.placeholder ? '  (⚠ placeholder: 0 nutrition)' : ''}`);
    }
  }

  // nutrition fold (a readable subset)
  console.log('NUTRITION (whole pot):');
  for (const k of ['calories', 'protein', 'fiber', 'fat', 'sodium', 'carbohydrates']) {
    console.log(`      ${k.padEnd(14)} ${totals[k].toFixed(1)} ${UNITS[k]}`);
  }
  const totalG = rows.reduce((a, r) => a + r.grams, 0);
  console.log(`      ${'total weight'.padEnd(14)} ${totalG.toFixed(0)} g  → ${(totals.calories / totalG).toFixed(2)} kcal/g`);

  // visible steps with refs filled via list-join
  console.log('METHOD (visible steps, refs resolved):');
  for (const s of stew.steps) {
    if (s.when && !guardHolds(s.when, P)) continue;
    // {role:fill} -> just that fill's prose name; {role} -> join of all chosen fills
    const text = s[locale].replace(/\{([a-z_]+)(?::([a-z_]+))?\}/g, (_, role, fill) => {
      const chosen = P.selection[role] ?? [];
      const ids = fill ? (chosen.includes(fill) ? [fill] : []) : chosen;
      const names = ids.map((id) =>
        proseName(stew.roles[role]?.fills.find((f) => f.id === id), id, locale));
      return joiners[locale](names);
    });
    console.log(`      • ${text}`);
  }

  if (warnings.length) {
    console.log('WARNINGS:');
    for (const w of warnings) console.log(`      ⚠ ${w}`);
  }
  console.log('═'.repeat(64));
}

// tiny guard evaluator (has + == + ! + && + ||, > for the bad-disjunct demo)
function guardHolds(expr, P) {
  // extremely small recursive-descent-ish eval, good enough for the prototype
  const orParts = expr.split('||');
  return orParts.some((or) =>
    or.split('&&').every((and) => atom(and.trim(), P)));
}
function atom(a, P) {
  let neg = false;
  while (a.startsWith('!')) { neg = !neg; a = a.slice(1).trim(); }
  let v;
  let m;
  if ((m = /^has\(\s*([a-z_]+)\s*,\s*'([^']+)'\s*\)$/.exec(a))) {
    v = (P.selection[m[1]] ?? []).includes(m[2]);
  } else if ((m = /^([a-z_]+)\s*>\s*(\d+)$/.exec(a))) {
    v = (P[m[1]] ?? 0) > Number(m[2]);
  } else if ((m = /^([a-z_]+)\s*==\s*'?([a-z_]+)'?$/.exec(a))) {
    v = (P.selection[m[1]] ?? []).includes(m[2]);
  } else {
    v = false;
  }
  return neg ? !v : v;
}

// ── boot: run the static checks once, then go interactive ────────────────────
console.log('PROTOTYPE: v3 recipe model — stew. Type `help`.');
console.log('\nBOUNDNESS CHECK (good steps — should be clean):');
const good = checkBoundness(stew, stew.steps);
console.log(good.length ? good.join('\n') : '  ✓ all good steps pass');
console.log('\nBOUNDNESS CHECK (deliberately broken steps — should all be caught):');
console.log(checkBoundness(stew, badSteps).join('\n'));
render();

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
rl.prompt();
rl.on('line', (line) => {
  const [cmd, ...args] = line.trim().split(/\s+/);
  try {
    if (cmd === 'help') {
      console.log(`commands:
  servings N            set servings
  toggle ROLE FILL      add/remove a fill from a role's selection
  set ROLE FILL...      set a role's selection explicitly
  locale en|ja          switch language
  roles                 list roles + fills
  show                  re-render
  quit`);
    } else if (cmd === 'servings') {
      P.servings = Math.max(1, Number(args[0]) || 1);
      render();
    } else if (cmd === 'toggle') {
      const [role, fill] = args;
      const cur = new Set(P.selection[role] ?? []);
      cur.has(fill) ? cur.delete(fill) : cur.add(fill);
      P.selection[role] = [...cur];
      render();
    } else if (cmd === 'set') {
      const [role, ...fills] = args;
      P.selection[role] = fills;
      render();
    } else if (cmd === 'locale') {
      locale = args[0] === 'ja' ? 'ja' : 'en';
      render();
    } else if (cmd === 'roles') {
      for (const [id, r] of Object.entries(stew.roles))
        console.log(`  ${id} (min ${r.range.min ?? 0}, max ${r.range.max ?? '∞'}): ${r.fills.map((f) => f.id).join(', ')}`);
    } else if (cmd === 'show' || cmd === '') {
      render();
    } else if (cmd === 'quit' || cmd === 'exit') {
      rl.close(); return;
    } else {
      console.log('unknown — type `help`');
    }
  } catch (e) {
    console.log('error:', e.message);
  }
  rl.prompt();
});
rl.on('close', () => { console.log('bye'); process.exit(0); });
