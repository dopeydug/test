/**
 * "Your plan for tonight" — an evening schedule calculated from the customer's
 * usual bedtime with real time arithmetic (wrap-around safe past midnight).
 *
 * Offsets are deliberately simple and consistent with the recommendation copy:
 *   final caffeine        bedtime − 9h30 (rounded down to the half hour)
 *   reduce stimulation    bedtime − 60
 *   phone down / lights   bedtime − 30
 *   10-minute wind-down   bedtime − 25
 *   prepare bedroom       bedtime − 15
 *   bed                   bedtime
 *   wake + daylight       usual wake time (+ light within the hour)
 */

import { addMinutes, formatTime, roundToStep, minutesBetween } from './time.js';
import { deriveFacts, CAFFEINE_REFERENCE_MINUTES } from './scoring.js';

export const CAFFEINE_GAP_MINUTES = 9 * 60 + 30;

/**
 * Personalised caffeine cutoff. If the customer already stops earlier than the
 * calculated time, we keep their current habit (never suggest a later cutoff).
 * Returns { minutes, label, isCurrentHabit, applicable }.
 */
export function recommendedCaffeineCutoff(answers, facts = deriveFacts(answers)) {
  if (!facts.consumesCaffeine || facts.bedtimeMinutes == null) {
    return { minutes: null, label: null, isCurrentHabit: false, applicable: false };
  }
  const calculated = roundToStep(addMinutes(facts.bedtimeMinutes, -CAFFEINE_GAP_MINUTES), 30, 'down');
  const current = CAFFEINE_REFERENCE_MINUTES[answers.caffeine_cutoff];
  // Compare gaps to bedtime rather than clock values so after-midnight bedtimes work.
  const calculatedGap = minutesBetween(calculated, facts.bedtimeMinutes);
  const currentGap = current == null ? 0 : minutesBetween(current, facts.bedtimeMinutes);
  const isCurrentHabit = currentGap >= calculatedGap;
  const minutes = isCurrentHabit ? current : calculated;
  return { minutes, label: formatTime(minutes), isCurrentHabit, applicable: true };
}

/**
 * Build tonight's plan.
 * Each step: { key, time (minutes), timeLabel, title, detail, isTomorrow }
 */
export function buildTonightPlan(answers, facts = deriveFacts(answers)) {
  const bed = facts.bedtimeMinutes;
  if (bed == null) return [];
  const steps = [];
  const caffeine = recommendedCaffeineCutoff(answers, facts);
  const screens = answers.prebed_screen_time;
  const temp = answers.sleep_temperature;

  if (caffeine.applicable) {
    steps.push({
      key: 'caffeine',
      time: caffeine.minutes,
      title: 'Final caffeine',
      detail: caffeine.isCurrentHabit
        ? 'Your current cutoff already gives caffeine plenty of time to clear. Keep it there.'
        : `Aim to finish your last coffee or tea by ${caffeine.label} so it has time to clear before bed.`,
    });
  } else {
    steps.push({
      key: 'afternoon',
      time: addMinutes(bed, -(8 * 60)),
      title: 'Afternoon check-in',
      detail: 'No caffeine to plan around. Use the afternoon for daylight and some movement, both help tonight.',
    });
  }

  steps.push({
    key: 'reduce',
    time: addMinutes(bed, -60),
    title: 'Start reducing stimulation',
    detail: facts.hasStress
      ? 'Write down tomorrow’s tasks and anything on your mind, then close the notebook. Work and admin stop here.'
      : 'Finish anything demanding. Lower the volume of the evening: softer light, slower tasks.',
  });

  steps.push({
    key: 'phone',
    time: addMinutes(bed, -30),
    title: screens === 'almost_none' ? 'Lights lower' : 'Phone down & lights lower',
    detail: screens === 'almost_none' || screens === 'under_15'
      ? 'You already keep screens out of the last stretch of the evening. Dim the lights and keep it that way.'
      : 'Move your phone away from the bed and drop the lighting. The aim is a clear line between the day and the night.',
  });

  steps.push({
    key: 'winddown',
    time: addMinutes(bed, -25),
    title: '10-minute wind-down',
    detail: facts.hasStress
      ? 'Slow breathing, a few pages of a book, or a lie-down on the floor or an acupressure mat. Same sequence every night.'
      : 'A shower, a few pages of a book or some gentle stretching. Keep the sequence the same each night.',
  });

  let prepare = 'Cool, dark and quiet. Close blinds, check for stray light and set the temperature.';
  if (temp === 'too_hot' || temp === 'slightly_warm') {
    prepare = 'You run warm: open a window or set the room a touch cooler, and keep lighter layers within reach.';
  } else if (temp === 'too_cold' || temp === 'slightly_cold') {
    prepare = 'You run cold: warm the bed before you get in and keep an extra layer within reach for later in the night.';
  } else if (temp === 'changes') {
    prepare = 'Your temperature shifts overnight: layer your bedding so you can adjust without fully waking.';
  }
  steps.push({ key: 'prepare', time: addMinutes(bed, -15), title: 'Prepare bedroom', detail: prepare });

  steps.push({ key: 'bed', time: bed, title: 'Bed', detail: 'Lights out. Nothing to do now except let it come.' });

  if (facts.wakeMinutes != null) {
    steps.push({
      key: 'wake',
      time: facts.wakeMinutes,
      isTomorrow: true,
      title: 'Wake & daylight',
      detail: `Up at about ${formatTime(facts.wakeMinutes)}. Ten minutes of outdoor light within the hour helps set tonight’s sleepiness.`,
    });
  }

  return steps.map((s) => ({ ...s, timeLabel: formatTime(s.time, { padMinutes: true }) }));
}
