/**
 * Report builder — turns raw answers into the complete, serialisable result
 * object used by the results screen, localStorage, the email report and the
 * Klaviyo sync. One function, one object, no UI concerns.
 *
 * Versioned so future retakes can be compared even if the scoring model is tuned.
 */

import { scoreAssessment, buildSummary, CATEGORIES } from './scoring.js';
import { buildRuleContext, selectRecommendations, buildOpportunity } from './rules.js';
import { selectProducts } from './productRules.js';
import { buildTonightPlan, recommendedCaffeineCutoff } from './schedule.js';
import { buildSevenDayReset } from './reset.js';
import { labelFor } from '../data/questions.js';
import { formatDuration, formatTime, toHHMM, parseTime } from './time.js';

export const REPORT_VERSION = '1.0.0';

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {object} answers            raw answers keyed by question id
 * @param {object} options
 * @param {string} options.email
 * @param {boolean} options.marketingConsent
 * @param {object} options.previous    a previous report (for comparison), optional
 * @param {object} options.products    live product overrides, optional
 * @param {Date}   options.now
 */
export function buildReport(answers, { email = '', marketingConsent = false, previous = null, now = new Date() } = {}) {
  const scoring = scoreAssessment(answers);
  const ctx = buildRuleContext(answers, scoring);
  const recommendations = selectRecommendations(ctx);
  const opportunity = buildOpportunity(ctx);
  const products = selectProducts(ctx, recommendations);
  const tonight = buildTonightPlan(answers, scoring.facts);
  const reset = buildSevenDayReset(ctx);
  const caffeine = recommendedCaffeineCutoff(answers, scoring.facts);
  const firstName = cleanName(answers.first_name);

  const report = {
    report_version: REPORT_VERSION,
    assessment_id: newId(),
    assessment_completed_at: now.toISOString(),

    // Identity
    first_name: firstName,
    email: (email || '').trim().toLowerCase(),
    marketing_consent: Boolean(marketingConsent),

    // Answers (human-readable labels — what a marketer wants to see in Klaviyo)
    sleep_goal: labelFor('sleep_goal', answers.sleep_goal),
    usual_bedtime: friendlyTime(answers.usual_bedtime),
    usual_wake_time: friendlyTime(answers.usual_wake_time),
    sleep_window: formatDuration(scoring.facts.sleepWindowMinutes),
    sleep_onset: labelFor('sleep_onset', answers.sleep_onset),
    night_wakings: labelFor('night_wakings', answers.night_wakings),
    morning_refresh_score: numberOrNull(answers.morning_refresh_score),
    sleep_temperature: labelFor('sleep_temperature', answers.sleep_temperature),
    sleep_position: labelFor('sleep_position', answers.sleep_position),
    bed_comfort_score: numberOrNull(answers.bed_comfort_score),
    sleep_discomfort_areas: labelFor('sleep_discomfort_areas', answers.sleep_discomfort_areas || []),
    caffeine_cutoff: labelFor('caffeine_cutoff', answers.caffeine_cutoff),
    prebed_screen_time: labelFor('prebed_screen_time', answers.prebed_screen_time),
    sleep_schedule_consistency: labelFor('sleep_schedule_consistency', answers.sleep_schedule_consistency),
    sleep_disturbances: labelFor('sleep_disturbances', answers.sleep_disturbances || []),

    // Scores
    routine_score: scoring.categories.routine,
    environment_score: scoring.categories.environment,
    comfort_score: scoring.categories.comfort,
    winddown_score: scoring.categories.winddown,
    overall_sleep_score: scoring.overall,
    score_band: scoring.band.label,
    summary: buildSummary(scoring, firstName),
    strengths: scoring.strengths,

    // Personalisation
    primary_opportunity: opportunity.label,
    primary_opportunity_category: opportunity.category,
    primary_opportunity_explanation: opportunity.explanation,
    recommendation_1: recommendations[0] ? recommendations[0].title : null,
    recommendation_2: recommendations[1] ? recommendations[1].title : null,
    recommendation_3: recommendations[2] ? recommendations[2].title : null,
    recommendations,
    recommended_products: products.map((p) => p.product),
    products,
    recommended_caffeine_cutoff: caffeine.applicable ? caffeine.label : null,
    tonight_plan: tonight,
    seven_day_reset: reset,

    // Comparison architecture: retakes carry the previous score forward.
    previous_assessment_id: previous ? previous.assessment_id : null,
    previous_overall_sleep_score: previous ? previous.overall_sleep_score : null,
    score_change: previous ? scoring.overall - previous.overall_sleep_score : null,
    previous_category_scores: previous
      ? { routine: previous.routine_score, environment: previous.environment_score, comfort: previous.comfort_score, winddown: previous.winddown_score }
      : null,

    // Machine-readable answers + breakdown for debugging / re-scoring later
    raw_answers: { ...answers, first_name: firstName },
    score_breakdown: Object.fromEntries(
      CATEGORIES.map((c) => [c.key, Object.fromEntries(Object.entries(scoring.details[c.key].parts).map(([k, p]) => [k, `${p.score}/${p.max}`]))]),
    ),
  };
  return report;
}

/**
 * Klaviyo custom profile properties. Kept as a separate mapping so the property
 * names can be changed in one place without touching the report shape.
 */
export function toKlaviyoProperties(report) {
  return {
    'Sleep Assessment Completed': true,
    'Sleep Score': report.overall_sleep_score,
    'Sleep Score Band': report.score_band,
    'Primary Sleep Goal': report.sleep_goal,
    'Primary Sleep Opportunity': report.primary_opportunity,
    'Sleep Temperature': report.sleep_temperature,
    'Sleep Position': report.sleep_position,
    'Bed Comfort Score': report.bed_comfort_score,
    'Morning Refresh Score': report.morning_refresh_score,
    'Sleep Schedule Consistency': report.sleep_schedule_consistency,
    'Sleep Discomfort Areas': report.sleep_discomfort_areas,
    'Sleep Disturbances': report.sleep_disturbances,
    'Usual Bedtime': report.usual_bedtime,
    'Usual Wake Time': report.usual_wake_time,
    'Caffeine Cutoff': report.caffeine_cutoff,
    'Pre-bed Screen Time': report.prebed_screen_time,
    'Routine Score': report.routine_score,
    'Environment Score': report.environment_score,
    'Comfort Score': report.comfort_score,
    'Wind-down Score': report.winddown_score,
    'Recommended Products': report.recommended_products,
    'Sleep Recommendation 1': report.recommendation_1,
    'Sleep Recommendation 2': report.recommendation_2,
    'Sleep Recommendation 3': report.recommendation_3,
    'Last Sleep Assessment Date': report.assessment_completed_at,
    'Sleep Assessment Count': report.previous_assessment_id ? 2 : 1, // server should increment the stored value instead
  };
}

/** Klaviyo event payload (metric "Sleep Assessment Completed"). */
export function toKlaviyoEvent(report) {
  return {
    metric: 'Sleep Assessment Completed',
    time: report.assessment_completed_at,
    unique_id: report.assessment_id,
    value: report.overall_sleep_score,
    properties: {
      $event_id: report.assessment_id,
      report_version: report.report_version,
      overall_sleep_score: report.overall_sleep_score,
      score_band: report.score_band,
      routine_score: report.routine_score,
      environment_score: report.environment_score,
      comfort_score: report.comfort_score,
      winddown_score: report.winddown_score,
      primary_opportunity: report.primary_opportunity,
      sleep_goal: report.sleep_goal,
      recommendations: [report.recommendation_1, report.recommendation_2, report.recommendation_3].filter(Boolean),
      recommended_products: report.recommended_products,
      score_change: report.score_change,
      // The email template can render the full plan from these:
      summary: report.summary,
      tonight_plan: report.tonight_plan.map((s) => ({ time: s.timeLabel, title: s.title, detail: s.detail })),
      seven_day_reset: report.seven_day_reset.map((d) => ({ day: d.day, title: d.title, body: d.body })),
      recommendation_details: report.recommendations.map((r) => ({ title: r.title, reason: r.reason, action: r.action })),
      product_details: report.products,
    },
  };
}

function cleanName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ').slice(0, 40).replace(/^./, (c) => c.toUpperCase());
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? n : null;
}

function friendlyTime(hhmm) {
  const m = parseTime(hhmm);
  return m == null ? null : `${formatTime(m, { padMinutes: true })} (${toHHMM(m)})`;
}
