/**
 * Product recommendation rules ("Your comfort recommendations").
 *
 * Products are secondary to the advice. A product only appears when the
 * customer's answers make it logically relevant, each card carries a single
 * sentence explaining why, and no treatment claims are made. At most three
 * products are shown; when nothing applies the UI shows a short honest note.
 */

import { describeDiscomfort } from './text.js';

const has = (list, v) => Array.isArray(list) && list.includes(v);

export const PRODUCT_RULES = [
  {
    product: 'topper',
    priority: 90,
    when: ({ facts }) =>
      // Never on comfort grounds when the bed is 10/10 with no discomfort.
      !(facts.bedComfort === 10 && !facts.hasDiscomfort) &&
      ((facts.bedComfort != null && facts.bedComfort <= 6) ||
        facts.discomfortAreas.some((a) => ['hips', 'shoulders', 'lower_back', 'upper_back'].includes(a))),
    boost: ({ facts }) => (facts.bedComfort != null && facts.bedComfort <= 6 ? (7 - facts.bedComfort) * 3 : 0),
    why: ({ facts }) => {
      const areas = describeDiscomfort(facts.discomfortAreas.filter((a) => ['hips', 'shoulders', 'lower_back', 'upper_back'].includes(a)));
      if (facts.bedComfort != null && facts.bedComfort <= 6) {
        return `You rated your current bed comfort ${facts.bedComfort}/10${areas ? ` and identified ${areas}` : ''}, so improving the comfort layer of your sleep setup may be worth considering.`;
      }
      return `You told us about ${areas} on waking, so the surface you sleep on may be worth reviewing.`;
    },
  },
  {
    product: 'pillow',
    priority: 85,
    when: ({ answers, facts }) =>
      has(facts.discomfortAreas, 'neck') || (has(facts.discomfortAreas, 'shoulders') && answers.sleep_position === 'side'),
    why: ({ answers, facts }) => {
      const areas = describeDiscomfort(facts.discomfortAreas.filter((a) => ['neck', 'shoulders'].includes(a)));
      const position = answers.sleep_position === 'side' ? ' and you mostly sleep on your side' : answers.sleep_position === 'back' ? ' and you mostly sleep on your back' : '';
      return `You mentioned ${areas}${position}, so a pillow you can adjust to your height and position may be relevant.`;
    },
  },
  {
    product: 'duvet',
    priority: 70,
    when: ({ answers }) => ['too_hot', 'slightly_warm', 'changes'].includes(answers.sleep_temperature),
    boost: ({ answers, facts }) => (answers.sleep_temperature === 'too_hot' ? 10 : 0) + (has(facts.disturbances, 'temperature') ? 6 : 0) + (answers.sleep_goal === 'sleep_cooler' ? 8 : 0),
    why: ({ answers }) =>
      answers.sleep_temperature === 'changes'
        ? 'Your temperature changes through the night, so an all-season weight may be easier to live with than swapping duvets.'
        : `You told us you ${answers.sleep_temperature === 'too_hot' ? 'often feel too hot' : 'tend to run warm'} overnight, so a lighter, breathable duvet may suit you better than a heavy one.`,
  },
  {
    product: 'sheets',
    priority: 60,
    when: ({ answers }) => ['too_hot', 'slightly_warm'].includes(answers.sleep_temperature),
    boost: ({ answers }) => (answers.sleep_goal === 'sleep_cooler' ? 6 : 0),
    why: () => 'You run warm at night, so breathable cotton layers next to the skin may be worth considering as part of your temperature experiment.',
  },
  {
    product: 'acupressure_mat',
    priority: 65,
    when: ({ answers, facts }) => facts.hasStress || ['40_60', 'over_60'].includes(answers.sleep_onset),
    boost: ({ facts }) => (facts.hasStress ? 8 : 0),
    why: ({ answers, facts }) =>
      facts.hasStress
        ? 'You told us stress or racing thoughts disturb your sleep, so a 20-minute lie-down as part of your evening routine may help mark the end of the day.'
        : `Falling asleep usually takes you ${answers.sleep_onset === 'over_60' ? 'more than an hour' : '40 to 60 minutes'}, so a fixed 20-minute wind-down ritual may give the evening a clearer full stop.`,
  },
  {
    product: 'relax_mat',
    priority: 50,
    when: ({ facts }) => has(facts.discomfortAreas, 'general_stiffness') || has(facts.discomfortAreas, 'knees'),
    why: () => 'You mentioned stiffness or knee discomfort, so a soft 35mm foam surface for a few minutes of floor stretching each evening may be relevant.',
  },
  {
    product: 'alpine_blanket',
    priority: 45,
    when: ({ answers }) => ['slightly_cold', 'too_cold'].includes(answers.sleep_temperature),
    boost: ({ answers }) => (answers.sleep_temperature === 'too_cold' ? 8 : 0),
    why: () => 'You often feel cold overnight, so a soft extra layer you can add or push off during the night may be relevant.',
  },
];

/**
 * Select up to `max` products. Returns [{ product (id), why, priority }].
 * Recommendations that reference a product nudge that product up slightly so
 * the cards and the advice stay consistent.
 */
export function selectProducts(ctx, recommendations = [], { max = 3, rules = PRODUCT_RULES } = {}) {
  const referenced = new Set(recommendations.map((r) => r.product).filter(Boolean));
  const eligible = [];
  for (const rule of rules) {
    let ok = false;
    try { ok = Boolean(rule.when(ctx)); } catch { ok = false; }
    if (!ok) continue;
    const boost = typeof rule.boost === 'function' ? rule.boost(ctx) : 0;
    const weight = rule.priority + boost + (referenced.has(rule.product) ? 12 : 0);
    eligible.push({ product: rule.product, why: rule.why(ctx), weight });
  }
  return eligible
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .map((p, i) => ({ ...p, priority: i + 1 }));
}
