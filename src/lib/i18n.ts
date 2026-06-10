/**
 * UI string dictionary for runtime localization.
 *
 * Recipe content (titles, ingredient names, notes, warnings) is localized in
 * the data files; this module covers the chrome — panel headings, button
 * labels, nutrient names. Islands read these reactively off the `locale` store
 * so switching language re-renders every string instantly.
 */
import type { Locale, NutrientKey, StoreSection } from './types';

/** A phrase in every supported locale. */
export type Phrase = Record<Locale, string>;

export const UI = {
  servings: { en: 'Servings', ja: '食数' },
  serving: { en: 'serving', ja: '食' },
  servingsPlural: { en: 'servings', ja: '食' },
  perServing: { en: 'Per serving', ja: '1食あたり' },
  wholeRecipe: { en: 'Whole recipe', ja: '全量' },
  totalWord: { en: 'total', ja: '合計' },
  scaleToggle: {
    en: 'Toggle between per-serving and whole-recipe nutrition',
    ja: '1食あたりと合計の表示を切り替え',
  },
  decrease: { en: 'Decrease servings', ja: '食数を減らす' },
  increase: { en: 'Increase servings', ja: '食数を増やす' },

  nutritionFacts: { en: 'Nutrition Facts', ja: '栄養成分表示' },
  calories: { en: 'Calories', ja: 'エネルギー' },
  dailyValue: { en: '% Daily Value*', ja: '1日の目安に対する割合*' },
  /** Trailing label for a bare "%DV" figure, e.g. "59% of Daily Value". */
  dvShort: { en: 'of Daily Value', ja: '1日の目安' },
  dvFootnote: {
    en: '* The % Daily Value tells you how much a nutrient in a serving contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.',
    ja: '* ％1日の摂取目安量は、1食分の栄養素が1日の食事に占める割合を示します。一般的な栄養アドバイスには1日2,000kcalが用いられます。',
  },
  dataDisclaimer: {
    en: 'Nutritional values are estimates based on the unprocessed form of each ingredient and are provided for informational purposes only; they do not constitute medical or dietary advice. Individuals with specific health conditions should consult a qualified healthcare professional.',
    ja: '栄養成分値は各材料の未加工の状態に基づく参考目的の推定値であり、医療または栄養指導の代わりになるものではありません。特定の健康状態をお持ちの方は、専門の医療機関にご相談ください。',
  },
  breakdownHint: {
    en: 'Tap any nutrient to see how each ingredient contributes.',
    ja: '栄養素をタップすると、材料ごとの内訳が表示されます。',
  },
  highlights: { en: 'Highlights', ja: '栄養ハイライト' },

  method: { en: 'Method', ja: '作り方' },
  language: { en: 'Language', ja: '言語' },

  theme: { en: 'Theme', ja: 'テーマ' },
  light: { en: 'Light', ja: 'ライト' },
  dark: { en: 'Dark', ja: 'ダーク' },
  themeToggle: {
    en: 'Switch between light and dark theme',
    ja: 'ライト・ダークテーマを切り替え',
  },

  // v3 stages (Customize | Shop | Cook) and the role-card UI.
  customizeStage: { en: 'Customize', ja: 'カスタマイズ' },
  shopStage: { en: 'Shop', ja: '買い物' },
  cookStage: { en: 'Cook', ja: '作る' },
  stages: { en: 'Recipe stages', ja: 'レシピの段階' },
  adjust: { en: 'Adjust', ja: '調整' },
  aboveMax: {
    en: 'Over the suggested maximum of {n} — it still works, but each pick matters less.',
    ja: '目安の上限（{n}）を超えています。作れますが、1つあたりの存在感は薄くなります。',
  },
  optionBlocked: { en: 'Not possible with the current choices.', ja: '現在の選択では選べません。' },
  miseEnPlace: { en: 'Mise en place', ja: '下ごしらえ' },
  miseHint: {
    en: 'What to have ready for each step — the method is below.',
    ja: '各ステップに用意するもの。作り方は下にあります。',
  },
  shopHint: {
    en: 'One line per item — tick them off as you go.',
    ja: '材料ごとに1行 — 買い物しながらチェック。',
  },
  swap: { en: 'Swap', ja: '変更' },
  required: { en: 'Required', ja: '必須' },
  pickUpTo: { en: 'up to', ja: '最大' },
} as const satisfies Record<string, Phrase>;

/** Key of a known UI phrase. */
export type UIKey = keyof typeof UI;

/** Resolve a UI phrase for a locale. */
export function t(key: UIKey, locale: Locale): string {
  return UI[key][locale];
}

/** FDA-style nutrient labels, localized. */
export const NUTRIENT_LABELS: Record<NutrientKey, Phrase> = {
  calories: { en: 'Calories', ja: 'エネルギー' },
  fat: { en: 'Total Fat', ja: '脂質' },
  saturated_fat: { en: 'Saturated Fat', ja: '飽和脂肪酸' },
  trans_fat: { en: 'Trans Fat', ja: 'トランス脂肪酸' },
  cholesterol: { en: 'Cholesterol', ja: 'コレステロール' },
  sodium: { en: 'Sodium', ja: 'ナトリウム' },
  carbohydrates: { en: 'Total Carbohydrate', ja: '炭水化物' },
  fiber: { en: 'Dietary Fiber', ja: '食物繊維' },
  sugars: { en: 'Total Sugars', ja: '糖類' },
  protein: { en: 'Protein', ja: 'たんぱく質' },
  calcium: { en: 'Calcium', ja: 'カルシウム' },
  iron: { en: 'Iron', ja: '鉄分' },
};

/**
 * Supermarket section labels in store-walk order — the shopping list renders
 * its groups in this sequence. One shared id space; which section a food sits
 * in is per-locale data on the ingredient (`aisle`, see src/lib/types.ts).
 */
export const STORE_SECTIONS: ReadonlyArray<{ id: StoreSection; label: Phrase }> = [
  { id: 'produce', label: { en: 'Produce', ja: '青果' } },
  { id: 'meat_seafood', label: { en: 'Meat & seafood', ja: '精肉・鮮魚' } },
  { id: 'tofu_soy', label: { en: 'Tofu & soy', ja: '豆腐・大豆製品' } },
  { id: 'dairy_eggs', label: { en: 'Dairy & eggs', ja: '乳製品・卵' } },
  { id: 'dry_goods', label: { en: 'Dry goods', ja: '乾物・豆・シリアル' } },
  { id: 'canned', label: { en: 'Canned goods', ja: '缶詰' } },
  { id: 'condiments', label: { en: 'Condiments & sauces', ja: '調味料' } },
  { id: 'spices', label: { en: 'Spices', ja: 'スパイス' } },
  { id: 'oils', label: { en: 'Oils & vinegars', ja: '油・酢' } },
  { id: 'international', label: { en: 'International', ja: '輸入食品' } },
  { id: 'other', label: { en: 'Other', ja: 'その他' } },
];
