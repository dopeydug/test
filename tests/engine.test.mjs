import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseTime, addMinutes, minutesBetween, sleepWindowMinutes, formatTime, roundToStep } from '../sleep-assessment/assets/js/engine/time.js';
import { scoreAssessment, buildSummary, CATEGORY_WEIGHTS, SCORE_MIN, SCORE_MAX } from '../sleep-assessment/assets/js/engine/scoring.js';
import { buildReport, toKlaviyoProperties } from '../sleep-assessment/assets/js/engine/report.js';
import { buildTonightPlan, recommendedCaffeineCutoff } from '../sleep-assessment/assets/js/engine/schedule.js';
import { RULES } from '../sleep-assessment/assets/js/engine/rules.js';
import { QUESTIONS } from '../sleep-assessment/assets/js/data/questions.js';

const GOOD = {
  first_name: 'sam',
  sleep_goal: 'curious',
  usual_bedtime: '22:30',
  usual_wake_time: '06:30',
  sleep_onset: '10_20',
  night_wakings: 'rarely',
  morning_refresh_score: 8,
  sleep_temperature: 'comfortable',
  sleep_position: 'side',
  bed_comfort_score: 9,
  sleep_discomfort_areas: ['none'],
  caffeine_cutoff: 'before_10am',
  prebed_screen_time: 'almost_none',
  sleep_schedule_consistency: 'within_30',
  sleep_disturbances: ['nothing'],
};

const POOR = {
  first_name: 'alex',
  sleep_goal: 'fall_asleep',
  usual_bedtime: '00:30',
  usual_wake_time: '06:00',
  sleep_onset: 'over_60',
  night_wakings: 'three_plus',
  morning_refresh_score: 2,
  sleep_temperature: 'too_hot',
  sleep_position: 'side',
  bed_comfort_score: 3,
  sleep_discomfort_areas: ['neck', 'hips', 'lower_back'],
  caffeine_cutoff: 'after_4pm',
  prebed_screen_time: 'entire_hour',
  sleep_schedule_consistency: 'constantly',
  sleep_disturbances: ['temperature', 'light', 'stress', 'noise'],
};

const EXAMPLE = {
  // The brief's worked example: 10:30pm bedtime, caffeine 2–4pm, screens most of the hour, too hot.
  first_name: 'Jess',
  sleep_goal: 'fall_asleep',
  usual_bedtime: '22:30',
  usual_wake_time: '06:30',
  sleep_onset: '20_40',
  night_wakings: 'once',
  morning_refresh_score: 6,
  sleep_temperature: 'too_hot',
  sleep_position: 'combination',
  bed_comfort_score: 7,
  sleep_discomfort_areas: ['none'],
  caffeine_cutoff: '2pm_4pm',
  prebed_screen_time: '30_60',
  sleep_schedule_consistency: 'within_60',
  sleep_disturbances: ['nothing'],
};

test('time arithmetic wraps past midnight', () => {
  assert.equal(parseTime('22:30'), 1350);
  assert.equal(parseTime('00:30'), 30);
  assert.equal(parseTime('25:00'), null);
  assert.equal(sleepWindowMinutes(parseTime('22:30'), parseTime('06:30')), 480);
  assert.equal(sleepWindowMinutes(parseTime('00:30'), parseTime('06:00')), 330);
  assert.equal(addMinutes(30, -60), 1410); // 12:30am − 1h = 11:30pm
  assert.equal(minutesBetween(15 * 60, 30), 570); // 3pm → 12:30am = 9.5h
  assert.equal(formatTime(1350), '10:30pm');
  assert.equal(formatTime(0), '12am');
  assert.equal(formatTime(6 * 60, { padMinutes: true }), '6:00am');
  assert.equal(roundToStep(13 * 60 + 5, 30, 'down'), 13 * 60);
});

test('scoring is deterministic and bounded', () => {
  const a = scoreAssessment(GOOD);
  const b = scoreAssessment(GOOD);
  assert.deepEqual(a.categories, b.categories);
  assert.equal(a.overall, b.overall);
  for (const s of [a.overall, ...Object.values(a.categories)]) {
    assert.ok(Number.isInteger(s), 'whole numbers only');
    assert.ok(s >= SCORE_MIN && s <= SCORE_MAX, `bounded: ${s}`);
  }
  assert.ok(Math.abs(Object.values(CATEGORY_WEIGHTS).reduce((x, y) => x + y, 0) - 1) < 1e-9);
});

test('good sleeper scores high, poor sleeper scores low', () => {
  const good = scoreAssessment(GOOD);
  const poor = scoreAssessment(POOR);
  assert.ok(good.overall >= 85, `good overall ${good.overall}`);
  assert.ok(poor.overall <= 35, `poor overall ${poor.overall}`);
  assert.equal(good.band.label, 'Strong foundation');
  assert.ok(good.strengths.length >= 3);
  assert.ok(poor.themes.length === 3);
});

test('worked example: wind-down is the biggest opportunity and copy references answers', () => {
  const report = buildReport(EXAMPLE, { email: 'Jess@Example.com' });
  assert.equal(report.first_name, 'Jess');
  assert.equal(report.email, 'jess@example.com');
  assert.equal(report.primary_opportunity_category, 'winddown');
  assert.match(report.primary_opportunity_explanation, /screens occupy most of the hour before bed/);
  assert.match(report.primary_opportunity_explanation, /20 to 40 minutes/);
  const titles = report.recommendations.map((r) => r.title);
  assert.ok(titles.includes('Bring your caffeine cutoff forward'), titles.join(' | '));
  assert.ok(titles.includes('Create a 30-minute landing zone'), titles.join(' | '));
  assert.ok(titles.includes('Make temperature an experiment'), titles.join(' | '));
  const caffeine = report.recommendations.find((r) => r.id === 'caffeine_forward');
  assert.match(caffeine.reason, /between 2pm and 4pm/);
  assert.match(caffeine.reason, /10:30pm/);
  assert.match(caffeine.action, /before 1pm/);
  assert.equal(report.recommended_caffeine_cutoff, '1pm');
  // Products: too hot → duvet + sheets; comfort 7 & no discomfort → no topper.
  assert.ok(report.recommended_products.includes('duvet'));
  assert.ok(!report.recommended_products.includes('topper'));
});

test('tonight plan uses real time arithmetic including after midnight', () => {
  const plan = buildTonightPlan(EXAMPLE);
  const byKey = Object.fromEntries(plan.map((s) => [s.key, s.timeLabel]));
  assert.equal(byKey.caffeine, '1:00pm');
  assert.equal(byKey.reduce, '9:30pm');
  assert.equal(byKey.phone, '10:00pm');
  assert.equal(byKey.winddown, '10:05pm');
  assert.equal(byKey.prepare, '10:15pm');
  assert.equal(byKey.bed, '10:30pm');
  assert.equal(byKey.wake, '6:30am');

  const late = buildTonightPlan({ ...EXAMPLE, usual_bedtime: '00:30', usual_wake_time: '07:30' });
  const lateByKey = Object.fromEntries(late.map((s) => [s.key, s.timeLabel]));
  assert.equal(lateByKey.caffeine, '3:00pm');
  assert.equal(lateByKey.reduce, '11:30pm');
  assert.equal(lateByKey.phone, '12:00am');
  assert.equal(lateByKey.bed, '12:30am');
});

test('caffeine cutoff never moves later than the current habit', () => {
  const early = recommendedCaffeineCutoff({ ...EXAMPLE, caffeine_cutoff: 'before_10am' });
  assert.equal(early.isCurrentHabit, true);
  assert.equal(early.label, '9am');
  const none = recommendedCaffeineCutoff({ ...EXAMPLE, caffeine_cutoff: 'none' });
  assert.equal(none.applicable, false);
});

test('rules never contradict the answers', () => {
  const noCaffeine = buildReport({ ...POOR, caffeine_cutoff: 'none' });
  assert.ok(!noCaffeine.recommendations.some((r) => r.id === 'caffeine_forward'));
  assert.ok(!noCaffeine.tonight_plan.some((s) => s.key === 'caffeine'));
  assert.equal(noCaffeine.recommended_caffeine_cutoff, null);

  const noScreens = buildReport({ ...POOR, prebed_screen_time: 'almost_none' });
  assert.ok(!noScreens.recommendations.some((r) => r.id === 'landing_zone'));

  const perfectBed = buildReport({ ...POOR, bed_comfort_score: 10, sleep_discomfort_areas: ['none'] });
  assert.ok(!perfectBed.recommended_products.includes('topper'));
  assert.ok(!perfectBed.recommendations.some((r) => r.id === 'comfort_layer'));

  // Earlier-bedtime and later-bedtime advice can never both appear.
  for (const answers of [GOOD, POOR, EXAMPLE]) {
    const ids = buildReport(answers).recommendations.map((r) => r.id);
    assert.ok(!(ids.includes('protect_window') && ids.includes('trim_window')));
    assert.ok(!(ids.includes('landing_zone') && ids.includes('evening_runway')));
  }
});

test('always returns exactly three recommendations, even for excellent sleepers', () => {
  const report = buildReport(GOOD);
  assert.equal(report.recommendations.length, 3);
  assert.equal(new Set(report.recommendations.map((r) => r.id)).size, 3);
  assert.equal(report.products.length, 0, 'no products when nothing applies');
  const poor = buildReport(POOR);
  assert.equal(poor.recommendations.length, 3);
  assert.ok(poor.products.length <= 3);
  assert.ok(poor.recommended_products.includes('topper'));
  assert.ok(poor.recommended_products.includes('pillow'));
});

test('optional disturbances question can be skipped without breaking scoring', () => {
  const { sleep_disturbances, ...withoutQ15 } = EXAMPLE;
  const report = buildReport(withoutQ15);
  assert.ok(report.overall_sleep_score > 0);
  assert.deepEqual(report.sleep_disturbances, []);
  assert.equal(report.recommendations.length, 3);
});

test('retake comparison is carried in the report', () => {
  const first = buildReport(POOR);
  const second = buildReport(GOOD, { previous: first });
  assert.equal(second.previous_assessment_id, first.assessment_id);
  assert.equal(second.score_change, second.overall_sleep_score - first.overall_sleep_score);
  assert.ok(second.score_change > 0);
});

test('Klaviyo property mapping covers the required properties', () => {
  const props = toKlaviyoProperties(buildReport(EXAMPLE, { email: 'a@b.co' }));
  for (const key of [
    'Sleep Assessment Completed', 'Sleep Score', 'Primary Sleep Goal', 'Primary Sleep Opportunity',
    'Sleep Temperature', 'Sleep Position', 'Bed Comfort Score', 'Morning Refresh Score',
    'Sleep Schedule Consistency', 'Sleep Discomfort Areas', 'Last Sleep Assessment Date',
  ]) {
    assert.ok(key in props, `missing ${key}`);
  }
  assert.equal(props['Sleep Assessment Completed'], true);
});

test('every rule renders without throwing for every answer set', () => {
  for (const answers of [GOOD, POOR, EXAMPLE]) {
    const report = buildReport(answers);
    for (const r of report.recommendations) {
      assert.ok(r.title && r.reason && r.action);
      assert.ok(!/undefined|null|NaN/.test(`${r.title} ${r.reason} ${r.action}`), `${r.id}: ${r.reason}`);
    }
    assert.ok(!/undefined|NaN/.test(report.summary));
    assert.ok(!/undefined|NaN/.test(report.primary_opportunity_explanation));
  }
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length, 'rule ids unique');
  assert.equal(QUESTIONS.length, 15);
});

test('excellent sleepers get honest opportunity copy instead of a false problem', () => {
  const report = buildReport(GOOD);
  assert.match(report.primary_opportunity_explanation, /All four of your areas score well/);
  assert.match(report.primary_opportunity_explanation, /Nothing here needs fixing/);
  const poor = buildReport(POOR);
  assert.match(poor.primary_opportunity_explanation, /You told us that/);
});

test('summary copy changes with the answers', () => {
  const good = scoreAssessment(GOOD);
  const poor = scoreAssessment(POOR);
  assert.notEqual(buildSummary(good, 'Sam'), buildSummary(poor, 'Alex'));
  assert.match(buildSummary(scoreAssessment(EXAMPLE), 'Jess'), /evening wind-down|temperature|caffeine/);
});
