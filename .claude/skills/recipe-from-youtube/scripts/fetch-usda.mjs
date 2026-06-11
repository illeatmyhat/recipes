/**
 * Fetch per-100g nutrition for an ingredient from USDA FoodData Central,
 * restricted to the SR Legacy dataset — a HARD RULE of this project. The
 * script refuses any fdcId that is not SR Legacy, so it cannot accidentally
 * pull Foundation / FNDDS / Branded numbers.
 *
 * Modes:
 *   node fetch-usda.mjs --search "rolled oats"   # list SR Legacy candidates
 *   node fetch-usda.mjs <fdcId>                  # print a ready-to-paste block
 *   node fetch-usda.mjs <fdcId> --write <id> [--density <g_per_ml>]
 *                                                # write data/ingredients/<id>.yaml
 *
 * Output of the <fdcId> mode is the `fdc_id:` + `nutrition.per_100g:` lines
 * for data/ingredients/<id>.yaml — paste them into the template. The --write
 * mode skips the paste step and writes the locale-neutral core file itself
 * (run it from the project root; it refuses to overwrite an existing file).
 * --density is required up front for any ingredient a recipe will use with
 * `ml`; omit it for solids (writes `null`). The per-locale companion files
 * (names/aliases/aisle/availability) are judgment calls — author those by
 * hand, per the template.
 *
 * Set FDC_API_KEY for a personal key (free, instant:
 * https://fdc.nal.usda.gov/api-key-signup.html). Falls back to DEMO_KEY,
 * which works but is rate-limited to ~30 requests/hour.
 */
const API = 'https://api.nal.usda.gov/fdc/v1';
const KEY = process.env.FDC_API_KEY || 'DEMO_KEY';

// USDA nutrient number -> our NutritionFacts key (src/lib/types.ts).
// Nutrients absent from a food default to 0, matching the existing YAMLs.
const MAP = {
  '208': 'calories',       // Energy (kcal)
  '204': 'fat',            // Total lipid (fat)
  '606': 'saturated_fat',  // Fatty acids, total saturated
  '605': 'trans_fat',      // Fatty acids, total trans
  '601': 'cholesterol',    // Cholesterol
  '307': 'sodium',         // Sodium, Na
  '205': 'carbohydrates',  // Carbohydrate, by difference
  '291': 'fiber',          // Fiber, total dietary
  '269': 'sugars',         // Sugars, total
  '203': 'protein',        // Protein
  '301': 'calcium',        // Calcium, Ca
  '303': 'iron',           // Iron, Fe
};
const ORDER = [
  'calories', 'fat', 'saturated_fat', 'trans_fat', 'cholesterol', 'sodium',
  'carbohydrates', 'fiber', 'sugars', 'protein', 'calcium', 'iron',
];

function warnKey() {
  if (KEY === 'DEMO_KEY') {
    console.error('# note: using DEMO_KEY (rate-limited). Set FDC_API_KEY for a personal key.');
  }
}

async function search(query) {
  warnKey();
  const url = `${API}/foods/search?api_key=${KEY}&dataType=SR%20Legacy&pageSize=15&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FDC search ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.foods?.length) {
    console.log(`No SR Legacy matches for ${JSON.stringify(query)}.`);
    return;
  }
  console.log('# fdcId\tdescription  (pick one, then: node fetch-usda.mjs <fdcId>)');
  for (const f of data.foods) console.log(`${f.fdcId}\t${f.description}`);
}

async function fetchFood(fdcId) {
  warnKey();
  const res = await fetch(`${API}/food/${fdcId}?api_key=${KEY}`);
  if (!res.ok) throw new Error(`FDC food ${res.status}: ${await res.text()}`);
  const food = await res.json();
  if (food.dataType !== 'SR Legacy') {
    console.error(
      `REFUSED: fdcId ${fdcId} is dataType "${food.dataType}", not "SR Legacy". ` +
        `This project allows SR Legacy data only — pick a different entry ` +
        `(use --search, which already filters to SR Legacy).`,
    );
    process.exit(1);
  }
  const vals = Object.fromEntries(ORDER.map((k) => [k, 0]));
  for (const n of food.foodNutrients ?? []) {
    const key = MAP[n.nutrient?.number];
    if (key) vals[key] = n.amount ?? 0;
  }
  return { description: food.description, vals };
}

function coreYaml(id, fdcId, { vals }, density) {
  const lines = [`id: ${id}`, `fdc_id: ${fdcId}`, 'nutrition:', '  per_100g:'];
  for (const k of ORDER) lines.push(`    ${k}: ${vals[k]}`);
  lines.push(`density_g_per_ml: ${density ?? 'null'}`);
  return lines.join('\n') + '\n';
}

async function printFood(fdcId) {
  const food = await fetchFood(fdcId);
  console.log(`# ${food.description}  (SR Legacy)`);
  process.stdout.write(coreYaml('<id>', fdcId, food, null).split('\n').slice(1).join('\n'));
  console.log('# density_g_per_ml: null is for solids — replace it if used in `ml`.');
}

async function writeFood(fdcId, id, density) {
  if (!/^[a-z0-9_]+$/.test(id)) {
    console.error(`bad ingredient id ${JSON.stringify(id)} — lower_snake_case only.`);
    process.exit(1);
  }
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const path = `data/ingredients/${id}.yaml`;
  if (existsSync(path)) {
    console.error(`REFUSED: ${path} already exists — reuse it, or delete it first if re-sourcing.`);
    process.exit(1);
  }
  if (!existsSync('data/ingredients')) {
    console.error('data/ingredients not found — run from the project root.');
    process.exit(1);
  }
  const food = await fetchFood(fdcId);
  await mkdir('data/ingredients', { recursive: true });
  await writeFile(path, coreYaml(id, fdcId, food, density), 'utf8');
  console.log(`wrote ${path}  (${food.description}, SR Legacy ${fdcId})`);
  console.log(`still needed: data/ingredients/<locale>/${id}.yaml for every supported locale.`);
}

const args = process.argv.slice(2);
const writeAt = args.indexOf('--write');
const densityAt = args.indexOf('--density');
if (args[0] === '--search') {
  await search(args.slice(1).join(' '));
} else if (/^\d+$/.test(args[0] ?? '') && writeAt > 0) {
  const density = densityAt > 0 ? Number(args[densityAt + 1]) : null;
  if (densityAt > 0 && !(density > 0)) {
    console.error('--density needs a positive number (g per ml).');
    process.exit(1);
  }
  await writeFood(args[0], args[writeAt + 1] ?? '', density);
} else if (/^\d+$/.test(args[0] ?? '')) {
  await printFood(args[0]);
} else {
  console.error(
    'usage:\n  node fetch-usda.mjs --search "ingredient name"\n  node fetch-usda.mjs <fdcId>\n  node fetch-usda.mjs <fdcId> --write <id> [--density <g_per_ml>]',
  );
  process.exit(1);
}
