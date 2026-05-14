/**
 * UI string dictionary for runtime localization.
 *
 * Recipe content (titles, ingredient names, notes, warnings) is localized in
 * the data files; this module covers the chrome — panel headings, button
 * labels, nutrient names. Islands read these reactively off the `locale` store
 * so switching language re-renders every string instantly.
 */
import type { Locale, NutrientKey } from './types';

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
  amountPerServing: { en: 'Amount per serving', ja: '1食あたりの量' },
  calories: { en: 'Calories', ja: 'エネルギー' },
  dailyValue: { en: '% Daily Value*', ja: '1日の目安に対する割合*' },
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

  customizeTitle: { en: 'Customize your bowl', ja: 'ボウルをカスタマイズ' },
  customizeHint: {
    en: 'Toggle fruits and toppings — nutrition updates live.',
    ja: 'フルーツとトッピングを切り替え — 栄養成分はその場で更新されます。',
  },
  fruits: { en: 'Fruits', ja: 'フルーツ' },
  toppings: { en: 'Toppings', ja: 'トッピング' },
  selected: { en: 'selected', ja: '選択中' },

  ingredients: { en: 'Ingredients', ja: '材料' },
  base: { en: 'Base', ja: 'ベース' },
  optional: { en: 'Optional', ja: 'お好みで' },
  method: { en: 'Method', ja: '作り方' },
  alsoKnownAs: { en: 'Also known as', ja: '別名' },
  whereToBuy: { en: 'Where to buy', ja: '購入できる場所' },
  language: { en: 'Language', ja: '言語' },
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
