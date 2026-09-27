/**
 * Sleep Assessment — deterministic scoring model.
 *
 * IMPORTANT: this is a wellness / educational score built from self-reported
 * habits. It is NOT a validated medical or clinical sleep score and must never
 * be described as one. The purpose is to help a customer see which parts of
 * their routine, environment, comfort and wind-down are worth attention.
 *
 * Design principles
 * - Pure functions: same answers → same scores, every time. No randomness.
 * - Every category is built from named "parts" with a max value so the logic
 *   is transparent and easy to tune. Parts also power the personalised summary
 *   copy ("your biggest opportunities are …") and the "What's working" strip.
 * - Whole numbers only, clamped to sensible bounds (no false precision and no
 *   "100/100" perfection claims).
 *
 * Category weights (overall score):
 *   Routine 30% · Environment 20% · Comfort 25% · Wind-down 25%
 */

import { parseTime, sleepWindowMinutes, minutesBetween } from './time.js';

export const CATEGORY_WEIGHTS = Object.freeze({
  routine: 0.30,
  environment: 0.20,
  comfort: 0.25,
  winddown: 0.25,
});

export const CATEGORIES = Object.freeze([
  { key: 'routine', label: 'Routine', description: 'How regular and well-sized your sleep window is.' },
  { key: 'environment', label: 'Environment', description: 'Temperature and the things that interrupt your night.' },
  { key: 'comfort', label: 'Comfort', description: 'How your bed, pillow and body feel through the night.' },
  { key: 'winddown', label: 'Wind-down', description: 'How clearly your evening transitions towards sleep.' },
]);

/** Scores never leave this range so the report never shows 0 or a "perfect" 100. */
export const SCORE_MIN = 10;
export const SCORE_MAX = 96;

/**
 * Representative clock time (minutes since midnight) for each caffeine answer.
 * Used to estimate the gap between the last caffeinated drink and bedtime.
 */
export const CAFFEINE_REFERENCE_MINUTES = Object.freeze({
  before_10am: 9 * 60,          // 9:00am
  '10am_12pm': 11 * 60,         // 11:00am
  '12pm_2pm': 13 * 60,          // 1:00pm
  '2pm_4pm': 15 * 60,           // 3:00pm
  after_4pm: 17 * 60 + 30,      // 5:30pm
  none: null,
});

/** Disturbances that count as "environment" (stress and physical discomfort score elsewhere). */
export const ENVIRONMENT_DISTURBANCES = Object.freeze([
  'temperature', 'noise', 'light', 'partner', 'children', 'pets', 'bathroom',
]);

export function clamp(value, min = SCORE_MIN, max = SCORE_MAX) {
  return Math.min(max, Math.max(min, value));
}

function toList(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Derived facts shared by scoring, rules and the schedule builder.
 * Everything downstream reads from this instead of re-parsing answers.
 */
export function deriveFacts(answers = {}) {
  const bedtime = parseTime(answers.usual_bedtime);
  const wake = parseTime(answers.usual_wake_time);
  const windowMinutes = sleepWindowMinutes(bedtime, wake);
  const caffeineRef = CAFFEINE_REFERENCE_MINUTES[answers.caffeine_cutoff] ?? null;
  const caffeineHoursBeforeBed =
    caffeineRef == null || bedtime == null ? null : minutesBetween(caffeineRef, bedtime) / 60;

  const discomfortAreas = toList(answers.sleep_discomfort_areas).filter((a) => a !== 'none');
  const disturbancesAnswered = Array.isArray(answers.sleep_disturbances) && answers.sleep_disturbances.length > 0;
  const disturbances = toList(answers.sleep_disturbances).filter((d) => d !== 'nothing');
  const environmentDisturbances = disturbances.filter((d) => ENVIRONMENT_DISTURBANCES.includes(d));

  return {
    bedtimeMinutes: bedtime,
    wakeMinutes: wake,
    sleepWindowMinutes: windowMinutes,
    sleepWindowHours: windowMinutes == null ? null : windowMinutes / 60,
    consumesCaffeine: answers.caffeine_cutoff != null && answers.caffeine_cutoff !== 'none',
    caffeineHoursBeforeBed,
    discomfortAreas,
    hasDiscomfort: discomfortAreas.length > 0,
    disturbancesAnswered,
    disturbances,
    environmentDisturbances,
    hasStress: disturbances.includes('stress'),
    refresh: Number(answers.morning_refresh_score) || null,
    bedComfort: Number(answers.bed_comfort_score) || null,
  };
}

/* ------------------------------------------------------------------ */
/* Routine (0–100): consistency 40 · sleep window 30 · caffeine timing 30 */
/* ------------------------------------------------------------------ */
export function scoreRoutine(answers, facts = deriveFacts(answers)) {
  // Bedtime consistency is the single strongest routine signal.
  const consistencyMap = { within_30: 40, within_60: 33, varies_1_2h: 20, varies_2h_plus: 10, constantly: 4 };
  const consistency = consistencyMap[answers.sleep_schedule_consistency] ?? 20;

  // Sleep opportunity (time in bed). ~7.5–9.25h scores best; very short or very
  // long windows both lose points (long windows often mean lying awake).
  const h = facts.sleepWindowHours;
  let window = 16;
  if (h != null) {
    if (h >= 7.5 && h <= 9.25) window = 30;
    else if ((h >= 7 && h < 7.5) || (h > 9.25 && h <= 10)) window = 24;
    else if ((h >= 6.5 && h < 7) || (h > 10 && h <= 11)) window = 16;
    else if ((h >= 6 && h < 6.5) || h > 11) window = 10;
    else window = 4;
  }

  // Caffeine timing relative to bedtime. No caffeine = full marks.
  let caffeine = 30;
  if (facts.consumesCaffeine) {
    const gap = facts.caffeineHoursBeforeBed ?? 8;
    if (gap >= 10) caffeine = 30;
    else if (gap >= 8) caffeine = 24;
    else if (gap >= 6) caffeine = 14;
    else if (gap >= 4) caffeine = 7;
    else caffeine = 3;
  }

  const parts = {
    consistency: { score: consistency, max: 40, theme: 'sleep consistency', strength: 'A consistent bedtime' },
    window: { score: window, max: 30, theme: 'the length of your sleep window', strength: 'A healthy sleep window' },
    caffeine: { score: caffeine, max: 30, theme: 'caffeine timing', strength: facts.consumesCaffeine ? 'An early caffeine cutoff' : 'A caffeine-free routine' },
  };
  return finalize(parts);
}

/* ---------------------------------------------------------------------- */
/* Environment (0–100): temperature 40 · interruptions 40 · night wakings 20 */
/* ---------------------------------------------------------------------- */
export function scoreEnvironment(answers, facts = deriveFacts(answers)) {
  const tempMap = { comfortable: 40, slightly_warm: 29, slightly_cold: 29, changes: 20, too_hot: 12, too_cold: 12 };
  const temperature = tempMap[answers.sleep_temperature] ?? 24;

  // Environmental interruptions. The question is optional: if it was skipped
  // we score it neutrally rather than assuming the best or the worst.
  let interruptions;
  if (!facts.disturbancesAnswered) interruptions = 30;
  else if (facts.environmentDisturbances.length === 0) interruptions = 40;
  else interruptions = Math.max(6, 40 - 11 * facts.environmentDisturbances.length);

  const wakingsMap = { rarely: 20, once: 15, twice: 9, varies: 8, three_plus: 4 };
  const wakings = wakingsMap[answers.night_wakings] ?? 10;

  const parts = {
    temperature: { score: temperature, max: 40, theme: 'temperature', strength: 'A comfortable sleeping temperature' },
    interruptions: { score: interruptions, max: 40, theme: 'night-time interruptions', strength: 'Few interruptions' },
    wakings: { score: wakings, max: 20, theme: 'staying asleep', strength: 'Sleeping through the night' },
  };
  return finalize(parts);
}

/* ------------------------------------------------------------------ */
/* Comfort (0–100): bed comfort 50 · physical discomfort 35 · thermal 15 */
/* ------------------------------------------------------------------ */
export function scoreComfort(answers, facts = deriveFacts(answers)) {
  const rating = facts.bedComfort ?? 6;
  const bed = Math.round((rating / 10) * 50);

  let discomfort;
  if (!facts.hasDiscomfort) {
    // No areas listed, but if they said physical discomfort disturbs their sleep
    // we don't award full marks.
    discomfort = facts.disturbances.includes('physical_discomfort') ? 26 : 35;
  } else {
    discomfort = Math.max(5, 35 - 9 * facts.discomfortAreas.length);
  }

  const thermalMap = { comfortable: 15, slightly_warm: 10, slightly_cold: 10, changes: 7, too_hot: 4, too_cold: 4 };
  const thermal = thermalMap[answers.sleep_temperature] ?? 9;

  const parts = {
    bed: { score: bed, max: 50, theme: 'the comfort of your bed', strength: 'A comfortable bed' },
    discomfort: { score: discomfort, max: 35, theme: 'physical comfort', strength: 'No regular aches on waking' },
    thermal: { score: thermal, max: 15, theme: 'temperature', strength: 'Bedding that suits your temperature' },
  };
  return finalize(parts);
}

/* ------------------------------------------------------------------------- */
/* Wind-down (0–100): screens 35 · sleep onset 35 · stress 20 · regularity 10 */
/* ------------------------------------------------------------------------- */
export function scoreWinddown(answers, facts = deriveFacts(answers)) {
  const screenMap = { almost_none: 35, under_15: 30, '15_30': 22, '30_60': 12, entire_hour: 4 };
  const screens = screenMap[answers.prebed_screen_time] ?? 18;

  // Both "under 10" and "10–20" are treated as healthy; we don't penalise fast onset.
  const onsetMap = { under_10: 35, '10_20': 35, '20_40': 23, '40_60': 12, over_60: 5 };
  const onset = onsetMap[answers.sleep_onset] ?? 20;

  let stress = 20;
  if (!facts.disturbancesAnswered) stress = 14;
  else if (facts.hasStress) stress = 4;

  const regularityMap = { within_30: 10, within_60: 8, varies_1_2h: 5, varies_2h_plus: 2, constantly: 2 };
  const regularity = regularityMap[answers.sleep_schedule_consistency] ?? 5;

  const parts = {
    screens: { score: screens, max: 35, theme: 'your evening wind-down', strength: 'Screen-light evenings' },
    onset: { score: onset, max: 35, theme: 'how long it takes to fall asleep', strength: 'Falling asleep easily' },
    stress: { score: stress, max: 20, theme: 'switching off at night', strength: 'A calm mind at bedtime' },
    regularity: { score: regularity, max: 10, theme: 'evening regularity', strength: 'A predictable evening' },
  };
  return finalize(parts);
}

function finalize(parts) {
  const raw = Object.values(parts).reduce((sum, p) => sum + p.score, 0);
  return { score: clamp(Math.round(raw)), raw, parts };
}

/* ------------------------------------------------------------ */
/* Overall                                                       */
/* ------------------------------------------------------------ */
export function scoreOverall(categoryScores) {
  const weighted =
    categoryScores.routine * CATEGORY_WEIGHTS.routine +
    categoryScores.environment * CATEGORY_WEIGHTS.environment +
    categoryScores.comfort * CATEGORY_WEIGHTS.comfort +
    categoryScores.winddown * CATEGORY_WEIGHTS.winddown;
  return clamp(Math.round(weighted));
}

export const SCORE_BANDS = Object.freeze([
  { min: 85, label: 'Strong foundation' },
  { min: 70, label: 'Good foundation' },
  { min: 55, label: 'Solid start' },
  { min: 40, label: 'Room to improve' },
  { min: 0, label: 'Time for a reset' },
]);

export function bandFor(score) {
  return SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

/**
 * Score everything. Returns:
 * {
 *   overall, band,
 *   categories: { routine, environment, comfort, winddown }  // integers
 *   details:    { routine: {score, raw, parts}, ... }
 *   lowest:     [ 'winddown', 'environment', ... ]            // ascending
 *   themes:     ['your evening wind-down', 'temperature', ...] // weakest parts, for copy
 *   strengths:  ['A consistent bedtime', ...]                   // strongest parts, for copy
 *   facts
 * }
 */
export function scoreAssessment(answers = {}) {
  const facts = deriveFacts(answers);
  const details = {
    routine: scoreRoutine(answers, facts),
    environment: scoreEnvironment(answers, facts),
    comfort: scoreComfort(answers, facts),
    winddown: scoreWinddown(answers, facts),
  };
  const categories = {
    routine: details.routine.score,
    environment: details.environment.score,
    comfort: details.comfort.score,
    winddown: details.winddown.score,
  };
  const overall = scoreOverall(categories);

  // Lowest categories first. Ties are broken by weight (a heavier category is
  // the more valuable place to start).
  const lowest = Object.keys(categories).sort(
    (a, b) => categories[a] - categories[b] || CATEGORY_WEIGHTS[b] - CATEGORY_WEIGHTS[a],
  );

  // Weakest / strongest individual parts across all categories.
  const allParts = [];
  for (const [category, detail] of Object.entries(details)) {
    for (const [key, part] of Object.entries(detail.parts)) {
      allParts.push({ category, key, ...part, ratio: part.score / part.max });
    }
  }
  const weakParts = allParts
    .filter((p) => p.ratio < 0.7)
    .sort((a, b) => a.ratio - b.ratio || b.max - a.max);
  // Lead with the weakest part of the lowest-scoring category so the summary
  // and the "biggest opportunity" always agree, then add the next weakest
  // themes from anywhere. Themes are de-duplicated by name.
  const leadTheme = weakParts.find((p) => p.category === lowest[0]);
  const themes = uniq([
    ...(leadTheme ? [leadTheme.theme] : []),
    ...weakParts.map((p) => p.theme),
  ]).slice(0, 3);
  const strengths = uniq(
    allParts
      .filter((p) => p.ratio >= 0.85 && p.max >= 15)
      .sort((a, b) => b.ratio - a.ratio || b.max - a.max)
      .map((p) => p.strength),
  ).slice(0, 4);

  return { overall, band: bandFor(overall), categories, details, lowest, themes, strengths, facts, allParts };
}

function uniq(list) {
  return [...new Set(list)];
}

/**
 * Personalised summary sentence under the score. Never random; driven by the
 * score band and the weakest themes so it always reflects the actual answers.
 */
export function buildSummary(result, firstName = '') {
  const themes = result.themes;
  const themeText = joinThemes(themes);
  const name = firstName ? firstName.trim() : '';
  switch (result.band.label) {
    case 'Strong foundation':
      return themes.length
        ? `${name ? `${name}, your` : 'Your'} answers point to a routine that is already working well. The most useful refinements are ${themeText}.`
        : `${name ? `${name}, your` : 'Your'} answers point to a routine that is already working well. The plan below is about protecting what you have.`;
    case 'Good foundation':
      return `You already have several strong sleep habits. Your answers suggest the biggest opportunities are ${themeText || 'small refinements to your evening'}.`;
    case 'Solid start':
      return `There is a solid base to work from. The areas most likely to make a difference are ${themeText || 'your evening routine'}.`;
    case 'Room to improve':
      return `A few things are working against your sleep at the moment, particularly ${themeText || 'your evening routine'}. Small, consistent changes here tend to add up quickly.`;
    default:
      return `Your answers suggest your sleep is under real pressure right now, especially ${themeText || 'your routine and wind-down'}. The plan below is designed to be gentle and achievable, one change at a time.`;
  }
}

function joinThemes(themes) {
  if (!themes.length) return '';
  if (themes.length === 1) return themes[0];
  if (themes.length === 2) return `${themes[0]} and ${themes[1]}`;
  return `${themes[0]}, ${themes[1]} and ${themes[2]}`;
}
