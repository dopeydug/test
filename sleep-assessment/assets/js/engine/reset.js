/**
 * "Your 7-Day Sleep Reset" — a fixed seven-day arc whose details are
 * personalised from the answers (caffeine cutoff, biggest environmental issue,
 * comfort focus). Day 7 closes the loop with a retake, and the report stores
 * the original score so a future retake can be compared against it.
 */

import { formatTime, addMinutes } from './time.js';
import { recommendedCaffeineCutoff } from './schedule.js';
import { describeDiscomfort, temperaturePhrase } from './text.js';

const has = (list, v) => Array.isArray(list) && list.includes(v);

export function buildSevenDayReset(ctx) {
  const { answers, facts, scoring } = ctx;
  const bed = facts.bedtimeMinutes;
  const wake = facts.wakeMinutes;
  const cutoff = recommendedCaffeineCutoff(answers, facts);

  // Day 5 focus: the customer's biggest environmental issue.
  let environmentFocus = 'Tonight, do a two-minute audit of the room once the lights are off: is it dark, quiet and slightly cool? Fix the one thing that stands out most.';
  if (has(facts.disturbances, 'light')) environmentFocus = 'Light is your main disturbance. Tonight, block the leaks: standby LEDs, blind edges, the hallway. Notice whether the room is truly dark when you close your eyes.';
  else if (has(facts.disturbances, 'noise')) environmentFocus = 'Noise is your main disturbance. Tonight, run a fan or steady background sound and see whether sudden noises bother you less.';
  else if (has(facts.disturbances, 'temperature') || ['too_hot', 'slightly_warm'].includes(answers.sleep_temperature)) environmentFocus = 'Temperature is your main issue. Tonight, set the room a touch cooler an hour before bed and use lighter layers you can adjust without fully waking.';
  else if (['too_cold', 'slightly_cold'].includes(answers.sleep_temperature)) environmentFocus = 'You run cold. Tonight, warm the bed before you get in and keep an extra layer within reach rather than heating the whole room.';
  else if (has(facts.disturbances, 'partner')) environmentFocus = 'Partner movement is your main disturbance. Tonight, try separate duvets or agree on a phone-free window before lights-out.';
  else if (has(facts.disturbances, 'bathroom')) environmentFocus = 'Bathroom trips interrupt your night. Today, shift most of your fluids earlier and keep the last hour before bed light.';
  else if (has(facts.disturbances, 'children') || has(facts.disturbances, 'pets')) environmentFocus = 'Your interruptions come from the people or pets you live with. Tonight, keep a low warm light for wake-ups so you do not fully switch on.';

  // Day 6 focus: comfort.
  const comfortBits = [];
  if (facts.bedComfort != null && facts.bedComfort <= 6) comfortBits.push(`you rated your bed ${facts.bedComfort}/10`);
  if (facts.hasDiscomfort) comfortBits.push(`you notice ${describeDiscomfort(facts.discomfortAreas)}`);
  if (['too_hot', 'too_cold'].includes(answers.sleep_temperature)) comfortBits.push(temperaturePhrase(answers.sleep_temperature));
  const comfortFocus = comfortBits.length
    ? `You told us ${comfortBits.join(' and ')}. Tonight, check pillow height for your position, notice where you feel pressure on waking, and decide whether the surface or the support needs attention first.`
    : 'Your comfort scores are already solid. Tonight, simply notice how your pillow and bedding feel on waking so you have a baseline to compare against later.';

  // Day 3: caffeine (or an alternative for non-caffeine drinkers).
  const caffeineDay = cutoff.applicable
    ? {
        title: 'Test your caffeine cutoff.',
        body: cutoff.isCurrentHabit
          ? `Your current cutoff (${cutoff.label}) already gives caffeine time to clear. Keep it there today and notice how you feel at bedtime.`
          : `Have your final caffeinated drink before ${cutoff.label} today and compare how easily you fall asleep tonight.`,
      }
    : {
        title: 'Lighten the afternoon.',
        body: 'You do not consume caffeine, so use today to notice the other afternoon habits that shape your evening: a walk after lunch, daylight, and an earlier dinner.',
      };

  return [
    {
      day: 1,
      title: 'Establish your baseline.',
      body: `Don’t change everything tonight. Simply notice how long it takes to fall asleep and how you feel at ${wake != null ? formatTime(wake) : 'wake time'} tomorrow.`,
    },
    {
      day: 2,
      title: 'Lock in your wake time.',
      body: `Aim to get up at approximately ${wake != null ? formatTime(wake) : 'the same time'} whatever happened overnight, and get some daylight within the hour.`,
    },
    { day: 3, ...caffeineDay },
    {
      day: 4,
      title: 'Build your landing zone.',
      body: bed != null
        ? `From ${formatTime(addMinutes(bed, -30))}, lower the lights and put the phone down. Keep the same short sequence you will repeat every night.`
        : 'Thirty minutes before bed, lower the lights and put the phone down.',
    },
    { day: 5, title: 'Optimise your environment.', body: environmentFocus },
    { day: 6, title: 'Focus on comfort.', body: comfortFocus },
    {
      day: 7,
      title: 'Reassess.',
      body: `How refreshed do you feel today, compared with ${scoring.facts.refresh != null ? `the ${scoring.facts.refresh}/10 you told us` : 'when you started'}? Retake the assessment and compare your scores.`,
      isReassess: true,
    },
  ];
}
