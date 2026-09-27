/**
 * Personalisation engine — recommendation rules.
 *
 * Each rule declares:
 *   id, category ('routine' | 'environment' | 'comfort' | 'winddown'),
 *   priority   base weight (0–100),
 *   goals      sleep goals this rule serves particularly well (bonus),
 *   when(ctx)  trigger condition — the rule is only eligible when true,
 *   boost(ctx) optional extra weight for severity,
 *   title / reason / action  copy generated from the actual answers,
 *   product    optional related product id (see data/products.js),
 *   note       optional safety note,
 *   excludes   rule ids that must not appear alongside this one.
 *
 * Selection: every eligible rule is scored (priority + boost + category bonus
 * for the customer's weakest categories + goal bonus), ranked, and the top
 * three are chosen with at most two per category and no conflicting pairs.
 *
 * Guard-rails baked into the conditions:
 *   - never suggest changing caffeine timing when they don't consume caffeine
 *   - never suggest cutting screens when screen use is already "almost none"
 *   - never suggest a topper on comfort grounds when the bed is 10/10 with no discomfort
 *   - "earlier bedtime" and "later bedtime" rules are mutually exclusive by condition
 */

import { addMinutes, formatTime, formatDurationProse } from './time.js';
import { recommendedCaffeineCutoff } from './schedule.js';
import {
  joinNatural, capitalize, describeDiscomfort, caffeinePhrase, screenPhrase,
  onsetPhrase, consistencyPhrase, temperaturePhrase,
} from './text.js';

const ONSET_ORDER = ['under_10', '10_20', '20_40', '40_60', 'over_60'];
const SCREEN_ORDER = ['almost_none', 'under_15', '15_30', '30_60', 'entire_hour'];
const onsetAtLeast = (v, min) => ONSET_ORDER.indexOf(v) >= ONSET_ORDER.indexOf(min);
const screenAtLeast = (v, min) => SCREEN_ORDER.indexOf(v) >= SCREEN_ORDER.indexOf(min);
const has = (list, v) => Array.isArray(list) && list.includes(v);

export const RULES = [
  /* ------------------------------ Routine ------------------------------ */
  {
    id: 'caffeine_forward',
    category: 'routine',
    priority: 70,
    goals: ['fall_asleep', 'stay_asleep', 'wake_refreshed'],
    when: ({ facts }) => facts.consumesCaffeine && facts.caffeineHoursBeforeBed != null && facts.caffeineHoursBeforeBed < 9,
    boost: ({ facts }) => (facts.caffeineHoursBeforeBed < 6 ? 20 : facts.caffeineHoursBeforeBed < 8 ? 10 : 0),
    title: () => 'Bring your caffeine cutoff forward',
    reason: ({ answers, facts }) =>
      `You currently have your last caffeinated drink ${caffeinePhrase(answers.caffeine_cutoff)}. Because you usually head to bed around ${formatTime(facts.bedtimeMinutes)}, that leaves roughly ${Math.round(facts.caffeineHoursBeforeBed)} hours for it to clear, so testing an earlier cutoff may be worthwhile.`,
    action: ({ answers, facts }) => {
      const cutoff = recommendedCaffeineCutoff(answers, facts);
      return `For the next seven days, have your final caffeinated drink before ${cutoff.label} and compare how easily you fall asleep.`;
    },
  },
  {
    id: 'anchor_wake_time',
    category: 'routine',
    priority: 74,
    goals: ['consistent_routine', 'wake_refreshed'],
    when: ({ answers }) => ['varies_1_2h', 'varies_2h_plus', 'constantly'].includes(answers.sleep_schedule_consistency),
    boost: ({ answers }) => (answers.sleep_schedule_consistency === 'constantly' ? 14 : answers.sleep_schedule_consistency === 'varies_2h_plus' ? 8 : 0),
    title: () => 'Anchor your wake time',
    reason: ({ answers }) =>
      `Your bedtime ${consistencyPhrase(answers.sleep_schedule_consistency)} across the week, which makes it harder for your body to predict when sleep should arrive.`,
    action: ({ facts }) =>
      `For the next seven days, get up at about ${formatTime(facts.wakeMinutes)} every day, including the weekend, and let your bedtime settle naturally around ${formatTime(facts.bedtimeMinutes)}. A fixed wake time is the easiest lever for a steadier routine.`,
  },
  {
    id: 'protect_window',
    category: 'routine',
    priority: 68,
    goals: ['wake_refreshed'],
    when: ({ facts }) => facts.sleepWindowMinutes != null && facts.sleepWindowMinutes < 7 * 60,
    boost: ({ facts }) => (facts.sleepWindowMinutes < 6.5 * 60 ? 12 : 0),
    title: () => 'Protect a longer sleep window',
    reason: ({ facts }) =>
      `Going to bed around ${formatTime(facts.bedtimeMinutes)} and waking around ${formatTime(facts.wakeMinutes)} gives you about ${formatDurationProse(facts.sleepWindowMinutes)} in bed, and your actual sleep will be a little less than that.`,
    action: ({ facts }) =>
      `Move lights-out 15 minutes earlier every second night this week (starting at ${formatTime(addMinutes(facts.bedtimeMinutes, -15))}) until you have a window of about seven and a half to eight hours. Small steps stick better than a sudden change.`,
  },
  {
    id: 'trim_window',
    category: 'routine',
    priority: 50,
    goals: ['fall_asleep', 'stay_asleep'],
    when: ({ answers, facts }) =>
      facts.sleepWindowMinutes != null && facts.sleepWindowMinutes > 9.5 * 60 &&
      (onsetAtLeast(answers.sleep_onset, '20_40') || ['twice', 'three_plus'].includes(answers.night_wakings) || (facts.refresh != null && facts.refresh <= 5)),
    title: () => 'Tighten your sleep window slightly',
    reason: ({ answers, facts }) => {
      const because = onsetAtLeast(answers.sleep_onset, '20_40')
        ? `it still takes you ${onsetPhrase(answers.sleep_onset)} to fall asleep`
        : ['twice', 'three_plus'].includes(answers.night_wakings)
          ? 'you still wake more than once a night'
          : `you rated how refreshed you feel on waking ${facts.refresh}/10`;
      return `You spend around ${formatDurationProse(facts.sleepWindowMinutes)} in bed, but ${because}. Long stretches of lying awake can weaken the link between bed and sleep.`;
    },
    action: ({ facts }) =>
      `Try heading to bed 30 minutes later than usual for a week (around ${formatTime(addMinutes(facts.bedtimeMinutes, 30))}) while keeping the same wake time, then reassess how quickly you drop off.`,
  },
  {
    id: 'morning_light',
    category: 'routine',
    priority: 40,
    goals: ['wake_refreshed', 'consistent_routine'],
    when: () => true, // universal, low priority: appears when little else qualifies or refresh is low
    boost: ({ answers, facts }) =>
      (facts.refresh != null && facts.refresh <= 5 ? 15 : 0) +
      (['varies_1_2h', 'varies_2h_plus', 'constantly'].includes(answers.sleep_schedule_consistency) ? 8 : 0),
    title: () => 'Anchor your morning with daylight',
    reason: ({ facts }) =>
      facts.refresh != null && facts.refresh <= 5
        ? `You rated how refreshed you feel on waking ${facts.refresh}/10. Morning light is the strongest signal you can send your body clock, and it costs nothing.`
        : 'Your morning is the strongest signal you can send your body clock, and it is the simplest habit to keep.',
    action: ({ facts }) =>
      `Within an hour of waking (by about ${formatTime(addMinutes(facts.wakeMinutes, 45))}), get ten minutes of outdoor light, without sunglasses if it is comfortable. It helps set the timing of tonight’s sleepiness.`,
  },

  /* ----------------------------- Wind-down ----------------------------- */
  {
    id: 'landing_zone',
    category: 'winddown',
    priority: 75,
    goals: ['fall_asleep'],
    when: ({ answers }) => screenAtLeast(answers.prebed_screen_time, '30_60'),
    boost: ({ answers }) => (answers.prebed_screen_time === 'entire_hour' ? 10 : 0) + (onsetAtLeast(answers.sleep_onset, '20_40') ? 10 : 0),
    title: () => 'Create a 30-minute landing zone',
    reason: ({ answers }) => {
      const onset = onsetAtLeast(answers.sleep_onset, '20_40') ? `, and falling asleep often takes ${onsetPhrase(answers.sleep_onset)}` : '';
      return `You spend ${screenPhrase(answers.prebed_screen_time)} of the final hour before bed on a screen${onset}. Creating a clearer transition between your day and bedtime is a practical place to start.`;
    },
    action: ({ facts }) =>
      `Thirty minutes before your usual bedtime (${formatTime(addMinutes(facts.bedtimeMinutes, -30))}), lower the lights and move your phone away from your bed. Swap the last stretch of screen time for something slower: a book, a shower or a few minutes of stretching.`,
    excludes: ['evening_runway'],
  },
  {
    id: 'evening_runway',
    category: 'winddown',
    priority: 65,
    goals: ['fall_asleep'],
    when: ({ answers }) => onsetAtLeast(answers.sleep_onset, '20_40') && !screenAtLeast(answers.prebed_screen_time, '30_60'),
    boost: ({ answers }) => (answers.sleep_onset === 'over_60' ? 15 : answers.sleep_onset === '40_60' ? 10 : 0),
    title: () => 'Give yourself a longer runway to sleep',
    reason: ({ answers }) =>
      `It usually takes you ${onsetPhrase(answers.sleep_onset)} to fall asleep, even though screens are not a big part of your evening. That suggests your body needs a clearer cue that sleep is next.`,
    action: ({ facts }) =>
      `Keep the same short sequence every night starting at ${formatTime(addMinutes(facts.bedtimeMinutes, -25))}: dim the lights, wash your face, read a few pages. A predictable order matters more than what is in it.`,
    excludes: ['landing_zone'],
  },
  {
    id: 'park_your_thoughts',
    category: 'winddown',
    priority: 72,
    goals: ['fall_asleep', 'stay_asleep'],
    when: ({ facts }) => facts.hasStress,
    boost: ({ answers }) => (onsetAtLeast(answers.sleep_onset, '20_40') ? 10 : 0) + (['twice', 'three_plus'].includes(answers.night_wakings) ? 8 : 0),
    title: () => 'Park tomorrow before you get into bed',
    reason: ({ answers }) => {
      const onset = onsetAtLeast(answers.sleep_onset, '20_40') ? `, and it usually takes you ${onsetPhrase(answers.sleep_onset)} to fall asleep` : '';
      return `You told us stress or racing thoughts tend to disturb your sleep${onset}. A busy mind rarely quietens on command, but it can be given a place to put things.`;
    },
    action: ({ facts }) =>
      `Around ${formatTime(addMinutes(facts.bedtimeMinutes, -60))}, spend five minutes writing tomorrow’s tasks and anything on your mind, then close the notebook. If your mind is still busy, a 15 to 20 minute lie-down on the floor or an acupressure mat with slow breathing can give the evening a clearer full stop.`,
    product: 'acupressure_mat',
  },
  {
    id: 'return_to_sleep',
    category: 'winddown',
    priority: 58,
    goals: ['stay_asleep'],
    when: ({ answers, facts }) => ['twice', 'three_plus'].includes(answers.night_wakings) && !facts.hasStress,
    boost: ({ answers }) => (answers.night_wakings === 'three_plus' ? 8 : 0),
    title: () => 'Make it easier to fall back asleep',
    reason: ({ answers }) =>
      `You ${answers.night_wakings === 'three_plus' ? 'wake three or more times a night' : 'usually wake twice a night'}. Brief wakings are normal; what matters is how quickly you get back to sleep.`,
    action: () =>
      'Keep the room dark, avoid checking the clock or your phone, and if you feel properly awake after what seems like 20 minutes, sit somewhere dim and quiet until you feel sleepy again rather than lying there frustrated.',
  },

  /* ---------------------------- Environment ---------------------------- */
  {
    id: 'temperature_experiment',
    category: 'environment',
    priority: 70,
    goals: ['sleep_cooler', 'stay_asleep'],
    when: ({ answers, facts }) =>
      ['too_hot', 'slightly_warm', 'changes'].includes(answers.sleep_temperature) || has(facts.disturbances, 'temperature'),
    boost: ({ answers, facts }) =>
      (answers.sleep_temperature === 'too_hot' ? 12 : 0) + (has(facts.disturbances, 'temperature') ? 8 : 0),
    title: () => 'Make temperature an experiment',
    reason: ({ answers, facts }) => {
      const base = capitalize(temperaturePhrase(answers.sleep_temperature) || 'temperature affects your night');
      const disturb = has(facts.disturbances, 'temperature') ? ', and temperature is one of the things that disturbs your sleep' : '';
      return `You told us ${base.charAt(0).toLowerCase()}${base.slice(1)}${disturb}. Temperature responds well to small, deliberate changes.`;
    },
    action: () =>
      'Keep your bedroom and bedding setup consistent for several nights, then test one temperature-related change at a time: a lighter duvet, breathable cotton layers, or setting the room a touch cooler an hour before bed. Judge each change over two or three nights before trying the next.',
    product: 'duvet',
  },
  {
    id: 'warm_the_bed',
    category: 'environment',
    priority: 60,
    goals: ['stay_asleep'],
    when: ({ answers }) => ['slightly_cold', 'too_cold'].includes(answers.sleep_temperature),
    boost: ({ answers }) => (answers.sleep_temperature === 'too_cold' ? 10 : 0),
    title: () => 'Warm the bed, not the room',
    reason: ({ answers }) => `You told us ${temperaturePhrase(answers.sleep_temperature)}. A cool room with a warm bed is usually easier to sleep in than a heated room.`,
    action: () =>
      'Warm the bed before you get in (a hot water bottle or ten minutes of an electric blanket, switched off at lights-out), add a soft layer over the duvet you can push off later, and keep socks by the bed.',
    product: 'alpine_blanket',
  },
  {
    id: 'darken_room',
    category: 'environment',
    priority: 62,
    goals: ['stay_asleep', 'fall_asleep'],
    when: ({ facts }) => has(facts.disturbances, 'light'),
    title: () => 'Darken the room',
    reason: () => 'Light is one of the things you told us disturbs your sleep, and it is one of the easiest to fix.',
    action: () =>
      'Tonight, check for light leaks once the room is dark: standby LEDs, gaps around blinds, a hallway light under the door. Cover or block what you can. If early morning light is the issue, a well-fitted sleep mask is an inexpensive test.',
  },
  {
    id: 'soften_sound',
    category: 'environment',
    priority: 62,
    goals: ['stay_asleep'],
    when: ({ facts }) => has(facts.disturbances, 'noise'),
    title: () => 'Soften the soundscape',
    reason: () => 'Noise is one of the things that wakes you. Sudden sounds are more disruptive than steady ones.',
    action: () =>
      'Try consistent, low background sound (a fan or a white-noise app) for a week; it masks sudden noises better than silence does. If the noise is unpredictable, foam earplugs for a few nights will quickly tell you whether it is the main issue.',
  },
  {
    id: 'partner_movement',
    category: 'environment',
    priority: 58,
    goals: ['stay_asleep'],
    when: ({ facts }) => has(facts.disturbances, 'partner'),
    title: () => 'Reduce what you feel from the other side of the bed',
    reason: () => 'Your partner’s movement is one of the things that disturbs your sleep.',
    action: () =>
      'Separate duvets remove a surprising amount of tugging and shared heat, and agreeing on a phone-free window before lights-out reduces late movement. If the mattress itself transfers a lot of motion, note it for when you next review your bed.',
  },
  {
    id: 'front_load_fluids',
    category: 'environment',
    priority: 55,
    goals: ['stay_asleep'],
    when: ({ facts }) => has(facts.disturbances, 'bathroom'),
    title: () => 'Front-load your fluids',
    reason: () => 'Bathroom trips are one of the things that interrupt your night.',
    action: () =>
      'Aim to have most of your fluids before early evening and keep the last hour before bed light. If you do wake, keep the lights low and avoid checking the time so it is easier to drift back off.',
    note: 'If night-time trips are frequent or new for you, it is worth mentioning to your GP.',
  },
  {
    id: 'plan_for_interruptions',
    category: 'environment',
    priority: 52,
    goals: ['stay_asleep'],
    when: ({ facts }) => has(facts.disturbances, 'children') || has(facts.disturbances, 'pets'),
    title: () => 'Plan for the interruptions you can’t remove',
    reason: ({ facts }) => {
      const who = joinNatural([has(facts.disturbances, 'children') ? 'children' : null, has(facts.disturbances, 'pets') ? 'pets' : null].filter(Boolean));
      return `You told us ${who} tend to disturb your sleep. Some interruptions are part of life; the goal is to make them cost less.`;
    },
    action: () =>
      'Keep a low, warm light for night-time wake-ups so you don’t fully switch on, agree in advance who responds on which nights if you share the load, and protect your own wind-down so you start the night with more in reserve.',
  },

  /* ------------------------------ Comfort ------------------------------ */
  {
    id: 'comfort_layer',
    category: 'comfort',
    priority: 66,
    goals: ['physical_comfort', 'wake_refreshed'],
    when: ({ facts }) =>
      (facts.bedComfort != null && facts.bedComfort <= 6) ||
      facts.discomfortAreas.some((a) => ['hips', 'shoulders', 'lower_back', 'upper_back'].includes(a)),
    boost: ({ facts }) =>
      (facts.bedComfort != null && facts.bedComfort <= 6 ? (7 - facts.bedComfort) * 4 : 0) +
      Math.min(12, facts.discomfortAreas.filter((a) => ['hips', 'shoulders', 'lower_back', 'upper_back'].includes(a)).length * 6),
    title: () => 'Improve the comfort layer of your bed',
    reason: ({ facts }) => {
      const areas = describeDiscomfort(facts.discomfortAreas.filter((a) => ['hips', 'shoulders', 'lower_back', 'upper_back'].includes(a)));
      if (facts.bedComfort != null && facts.bedComfort <= 6) {
        return `You rated your current bed comfort ${facts.bedComfort}/10${areas ? ` and identified ${areas}` : ''}, so the surface you sleep on is worth looking at before anything else.`;
      }
      return `Although you rated your bed ${facts.bedComfort}/10, you told us about ${areas}. Pressure points often show up on waking before a bed feels obviously uncomfortable.`;
    },
    action: () =>
      'For a week, notice whether the discomfort is worse at bedtime or on waking, and whether it eases once you are up. If the mattress feels too firm or worn, a plush topper is the simplest way to change the feel of the whole bed without replacing it.',
    product: 'topper',
    note: 'Persistent or worsening pain is worth discussing with a health professional.',
  },
  {
    id: 'pillow_fit',
    category: 'comfort',
    priority: 64,
    goals: ['physical_comfort'],
    when: ({ answers, facts }) =>
      has(facts.discomfortAreas, 'neck') || (has(facts.discomfortAreas, 'shoulders') && answers.sleep_position === 'side'),
    boost: ({ facts }) => (has(facts.discomfortAreas, 'neck') && has(facts.discomfortAreas, 'shoulders') ? 8 : 0),
    title: () => 'Check your pillow height',
    reason: ({ answers, facts }) => {
      const areas = describeDiscomfort(facts.discomfortAreas.filter((a) => ['neck', 'shoulders'].includes(a)));
      const position = answers.sleep_position === 'side' ? ', and you mostly sleep on your side' : answers.sleep_position === 'back' ? ', and you mostly sleep on your back' : '';
      return `You told us you notice ${areas}${position}. Pillow height is usually the first thing to check for that.`;
    },
    action: ({ answers }) =>
      `Lie in your usual position and have someone look at your neck line: it should sit roughly level with your spine. ${answers.sleep_position === 'side' ? 'Side sleepers usually need a higher, firmer pillow.' : answers.sleep_position === 'back' ? 'Back sleepers usually need a lower pillow.' : 'Side sleepers usually need more height, back sleepers less.'} An adjustable pillow lets you test heights without buying several.`,
    product: 'pillow',
  },
  {
    id: 'evening_mobility',
    category: 'comfort',
    priority: 56,
    goals: ['physical_comfort'],
    when: ({ facts }) => has(facts.discomfortAreas, 'general_stiffness') || has(facts.discomfortAreas, 'knees'),
    title: () => 'Add five minutes of floor time',
    reason: ({ facts }) => {
      const what = joinNatural([has(facts.discomfortAreas, 'general_stiffness') ? 'general stiffness' : null, has(facts.discomfortAreas, 'knees') ? 'knee discomfort' : null].filter(Boolean));
      return `You mentioned ${what} when you are trying to sleep or on waking. Gentle movement before bed often eases the settling-in period.`;
    },
    action: () =>
      'Fifteen minutes before bed, spend five minutes on the floor: easy hip and hamstring stretches, a slow spinal twist to each side, and a minute lying flat with your knees bent. Keep it gentle; this is about unwinding, not training.',
    product: 'relax_mat',
    note: 'If stiffness or pain is persistent or getting worse, speak with a health professional.',
  },

  /* ------------------ Maintenance (only when little else applies) ------------------ */
  {
    id: 'keep_screens_light',
    category: 'winddown',
    priority: 22,
    when: ({ answers }) => ['almost_none', 'under_15'].includes(answers.prebed_screen_time),
    title: () => 'Keep your evenings screen-light',
    reason: ({ answers }) => `You spend ${screenPhrase(answers.prebed_screen_time)} of the hour before bed on a screen, which is one of the strongest habits you can have.`,
    action: () => 'Protect it. On nights when the routine slips, the simplest reset is to charge your phone outside the bedroom.',
  },
  {
    id: 'keep_consistency',
    category: 'routine',
    priority: 22,
    when: ({ answers }) => answers.sleep_schedule_consistency === 'within_30',
    title: () => 'Protect your consistent bedtime',
    reason: () => 'Your bedtime stays within about 30 minutes across the week, which is exactly what a steady body clock needs.',
    action: () => 'Keep the weekend within an hour of your weekday times. If a late night happens, hold your usual wake time the next morning rather than sleeping in.',
  },
  {
    id: 'keep_environment',
    category: 'environment',
    priority: 20,
    when: ({ answers, facts }) => answers.sleep_temperature === 'comfortable' && facts.disturbancesAnswered && facts.environmentDisturbances.length === 0,
    title: () => 'Keep your bedroom as it is',
    reason: () => 'Your temperature feels comfortable and nothing in the room regularly disturbs you. That is a good environment.',
    action: () => 'Resist changing things for the sake of it. Review the setup when the seasons change, and keep the room for sleep rather than work.',
  },
];

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_BONUS = [25, 10, 0, 0]; // by position in scoring.lowest

export function buildRuleContext(answers, scoring) {
  return { answers, facts: scoring.facts, scoring, goal: answers.sleep_goal };
}

/** Evaluate every rule and return the eligible ones with their ranking score. */
export function evaluateRules(ctx, rules = RULES) {
  const eligible = [];
  for (const rule of rules) {
    let ok = false;
    try { ok = Boolean(rule.when(ctx)); } catch { ok = false; }
    if (!ok) continue;
    const lowestIndex = ctx.scoring.lowest.indexOf(rule.category);
    const categoryBonus = lowestIndex >= 0 ? CATEGORY_BONUS[lowestIndex] : 0;
    const goalBonus = rule.goals && rule.goals.includes(ctx.goal) ? 15 : 0;
    const boost = typeof rule.boost === 'function' ? rule.boost(ctx) : 0;
    eligible.push({ rule, weight: rule.priority + boost + categoryBonus + goalBonus });
  }
  return eligible.sort((a, b) => b.weight - a.weight || RULES.indexOf(a.rule) - RULES.indexOf(b.rule));
}

/**
 * Pick the top `count` recommendations with at most `perCategory` per category
 * and no conflicting pairs. Returns fully rendered recommendation objects.
 */
export function selectRecommendations(ctx, { count = 3, perCategory = 2, rules = RULES } = {}) {
  const ranked = evaluateRules(ctx, rules);
  const chosen = [];
  const pick = (cap) => {
    for (const item of ranked) {
      if (chosen.length >= count) break;
      if (chosen.some((c) => c.rule.id === item.rule.id)) continue;
      const conflict = chosen.some(
        (c) => (c.rule.excludes || []).includes(item.rule.id) || (item.rule.excludes || []).includes(c.rule.id),
      );
      if (conflict) continue;
      const sameCategory = chosen.filter((c) => c.rule.category === item.rule.category).length;
      if (sameCategory >= cap) continue;
      chosen.push(item);
    }
  };
  pick(perCategory);
  if (chosen.length < count) pick(Infinity); // relax the category cap if needed
  return chosen.map(({ rule, weight }, index) => renderRecommendation(rule, ctx, index + 1, weight));
}

export function renderRecommendation(rule, ctx, priorityNumber, weight) {
  return {
    id: rule.id,
    priority: priorityNumber,
    category: rule.category,
    weight,
    title: rule.title(ctx),
    reason: rule.reason(ctx),
    action: rule.action(ctx),
    product: rule.product || null,
    note: rule.note || null,
  };
}

/* ------------------------------------------------------------------ */
/* Biggest opportunity                                                 */
/* ------------------------------------------------------------------ */

const OPPORTUNITY_TITLES = {
  routine: 'Your sleep routine',
  environment: 'Your sleep environment',
  comfort: 'Your physical comfort',
  winddown: 'Your evening wind-down',
};

/**
 * Explain the lowest-scoring category using the customer's actual answers.
 * Returns { category, label, title, explanation, score }.
 */
export function buildOpportunity(ctx) {
  const { answers, facts, scoring } = ctx;
  const category = scoring.lowest[0];
  const parts = scoring.details[category].parts;
  const weakest = Object.entries(parts)
    .map(([key, p]) => ({ key, ...p, ratio: p.score / p.max }))
    .sort((a, b) => a.ratio - b.ratio);
  const clauses = [];

  if (category === 'winddown') {
    if (['30_60', 'entire_hour'].includes(answers.prebed_screen_time)) clauses.push(`screens occupy ${screenPhrase(answers.prebed_screen_time)} of the hour before bed`);
    if (onsetAtLeast(answers.sleep_onset, '20_40')) clauses.push(`falling asleep often takes ${onsetPhrase(answers.sleep_onset)}`);
    if (facts.hasStress) clauses.push('stress or racing thoughts tend to disturb your sleep');
    if (!clauses.length && ['varies_1_2h', 'varies_2h_plus', 'constantly'].includes(answers.sleep_schedule_consistency)) clauses.push(`your evenings ${consistencyPhrase(answers.sleep_schedule_consistency).replace('stays', 'stay')}`);
    return finish('Creating a clearer transition between your day and bedtime is a practical place to start.');
  }
  if (category === 'routine') {
    if (['varies_1_2h', 'varies_2h_plus', 'constantly'].includes(answers.sleep_schedule_consistency)) clauses.push(`your bedtime ${consistencyPhrase(answers.sleep_schedule_consistency)} across the week`);
    if (facts.sleepWindowMinutes != null && facts.sleepWindowMinutes < 7 * 60) clauses.push(`you have about ${formatDurationProse(facts.sleepWindowMinutes)} in bed between ${formatTime(facts.bedtimeMinutes)} and ${formatTime(facts.wakeMinutes)}`);
    if (facts.sleepWindowMinutes != null && facts.sleepWindowMinutes > 10 * 60) clauses.push(`you spend around ${formatDurationProse(facts.sleepWindowMinutes)} in bed`);
    if (facts.consumesCaffeine && facts.caffeineHoursBeforeBed != null && facts.caffeineHoursBeforeBed < 8) clauses.push(`your last caffeine is ${caffeinePhrase(answers.caffeine_cutoff)}, only about ${Math.round(facts.caffeineHoursBeforeBed)} hours before bed`);
    return finish('A steadier, better-sized sleep window gives everything else a chance to work.');
  }
  if (category === 'environment') {
    if (answers.sleep_temperature && answers.sleep_temperature !== 'comfortable') clauses.push(temperaturePhrase(answers.sleep_temperature));
    if (facts.environmentDisturbances.length) clauses.push(`${joinNatural(facts.environmentDisturbances.map(disturbanceNoun))} ${facts.environmentDisturbances.length === 1 ? 'tends' : 'tend'} to disturb your night`);
    if (['twice', 'three_plus'].includes(answers.night_wakings)) clauses.push(`you ${answers.night_wakings === 'three_plus' ? 'wake three or more times' : 'wake twice'} a night`);
    return finish('Small changes to the room are often the quickest wins because they work every night without effort.');
  }
  // comfort
  if (facts.bedComfort != null && facts.bedComfort <= 6) clauses.push(`you rated your bed comfort ${facts.bedComfort}/10`);
  if (facts.hasDiscomfort) clauses.push(`you regularly notice ${describeDiscomfort(facts.discomfortAreas)}`);
  if (['too_hot', 'too_cold'].includes(answers.sleep_temperature)) clauses.push(temperaturePhrase(answers.sleep_temperature));
  return finish('Getting the surface, support and temperature of your bed right removes friction from every night.');

  function finish(closing) {
    const score = scoring.categories[category];
    const label = OPPORTUNITY_TITLES[category];
    let explanation;
    if (score >= 85) {
      // Excellent sleeper: the "lowest" area is still strong, so say so plainly.
      const told = clauses.length ? ` You did mention that ${joinNatural(clauses)}, which is worth keeping an eye on.` : '';
      explanation = `All four of your areas score well, and ${label.toLowerCase()} is the lowest only by a small margin, mainly because of ${weakest[0].theme}.${told} Nothing here needs fixing; the plan below is about protecting what already works.`;
    } else {
      const told = clauses.length
        ? `You told us that ${joinNatural(clauses)}. `
        : `This is your lowest-scoring area, mainly because of ${weakest[0].theme}. `;
      explanation = `${told}${closing}`;
    }
    return { category, label, title: label, score, explanation };
  }
}

function disturbanceNoun(value) {
  return {
    temperature: 'temperature', noise: 'noise', light: 'light', partner: 'partner movement',
    children: 'children', pets: 'pets', bathroom: 'bathroom trips',
  }[value] || value;
}
