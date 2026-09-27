/**
 * Sleep Assessment — question definitions.
 *
 * Every answer is stored under a stable machine key (the `id`) so the scoring
 * engine, recommendation rules and Klaviyo payload never depend on display copy.
 * Option `value`s are the keys the engine reasons about; `label`s are what the
 * customer sees and what is written to Klaviyo as human-readable properties.
 */

export const QUESTION_TYPES = Object.freeze({
  TEXT: 'text',
  SINGLE: 'single',
  MULTI: 'multi',
  TIME: 'time',
  SCALE: 'scale',
});

export const QUESTIONS = [
  {
    id: 'first_name',
    type: QUESTION_TYPES.TEXT,
    eyebrow: 'Before we begin',
    title: 'First, what should we call you?',
    placeholder: 'First name',
    autocomplete: 'given-name',
    maxLength: 40,
    required: true,
  },
  {
    id: 'sleep_goal',
    type: QUESTION_TYPES.SINGLE,
    title: 'What would you most like to improve about your sleep?',
    options: [
      { value: 'fall_asleep', label: 'Fall asleep more easily' },
      { value: 'stay_asleep', label: 'Stay asleep through the night' },
      { value: 'wake_refreshed', label: 'Wake feeling more refreshed' },
      { value: 'physical_comfort', label: 'Improve physical comfort' },
      { value: 'sleep_cooler', label: 'Sleep cooler' },
      { value: 'consistent_routine', label: 'Build a more consistent routine' },
      { value: 'curious', label: "I'm mostly curious about my sleep" },
    ],
  },
  {
    id: 'usual_bedtime',
    type: QUESTION_TYPES.TIME,
    title: 'What time do you usually go to bed?',
    hint: 'Think of the time you usually turn the lights out on a typical weeknight.',
    defaultValue: '22:30',
    presets: ['21:30', '22:00', '22:30', '23:00', '23:30', '00:00'],
  },
  {
    id: 'usual_wake_time',
    type: QUESTION_TYPES.TIME,
    title: 'What time do you usually wake up?',
    hint: 'Your usual weekday wake time is the most useful one to work from.',
    defaultValue: '06:30',
    presets: ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00'],
    showSleepWindow: true,
  },
  {
    id: 'sleep_onset',
    type: QUESTION_TYPES.SINGLE,
    title: 'How long does it usually take you to fall asleep?',
    options: [
      { value: 'under_10', label: 'Less than 10 minutes' },
      { value: '10_20', label: '10–20 minutes' },
      { value: '20_40', label: '20–40 minutes' },
      { value: '40_60', label: '40–60 minutes' },
      { value: 'over_60', label: 'More than an hour' },
    ],
  },
  {
    id: 'night_wakings',
    type: QUESTION_TYPES.SINGLE,
    title: 'How often do you wake during the night?',
    options: [
      { value: 'rarely', label: 'Rarely' },
      { value: 'once', label: 'Once' },
      { value: 'twice', label: 'Twice' },
      { value: 'three_plus', label: 'Three or more times' },
      { value: 'varies', label: 'It varies significantly' },
    ],
  },
  {
    id: 'morning_refresh_score',
    type: QUESTION_TYPES.SCALE,
    title: 'How refreshed do you usually feel when you wake up?',
    min: 1,
    max: 10,
    minLabel: 'Exhausted',
    maxLabel: 'Fully refreshed',
  },
  {
    id: 'sleep_temperature',
    type: QUESTION_TYPES.SINGLE,
    title: 'How does your temperature usually feel during the night?',
    options: [
      { value: 'too_hot', label: 'I often feel too hot' },
      { value: 'slightly_warm', label: 'Slightly warm' },
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'slightly_cold', label: 'Slightly cold' },
      { value: 'too_cold', label: 'I often feel too cold' },
      { value: 'changes', label: 'It changes throughout the night' },
    ],
  },
  {
    id: 'sleep_position',
    type: QUESTION_TYPES.SINGLE,
    title: 'What position do you spend most of the night sleeping in?',
    icons: true,
    options: [
      { value: 'side', label: 'Side' },
      { value: 'back', label: 'Back' },
      { value: 'stomach', label: 'Stomach' },
      { value: 'combination', label: 'Combination' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    id: 'bed_comfort_score',
    type: QUESTION_TYPES.SCALE,
    title: 'How comfortable does your bed currently feel?',
    min: 1,
    max: 10,
    minLabel: 'Very uncomfortable',
    maxLabel: 'Extremely comfortable',
  },
  {
    id: 'sleep_discomfort_areas',
    type: QUESTION_TYPES.MULTI,
    title: "Do you regularly notice discomfort when you're trying to sleep or when you wake?",
    hint: 'Select everything that applies.',
    exclusiveValue: 'none',
    options: [
      { value: 'neck', label: 'Neck' },
      { value: 'shoulders', label: 'Shoulders' },
      { value: 'upper_back', label: 'Upper back' },
      { value: 'lower_back', label: 'Lower back' },
      { value: 'hips', label: 'Hips' },
      { value: 'knees', label: 'Knees' },
      { value: 'general_stiffness', label: 'General stiffness' },
      { value: 'none', label: 'No regular discomfort' },
    ],
  },
  {
    id: 'caffeine_cutoff',
    type: QUESTION_TYPES.SINGLE,
    title: 'When do you usually have your last caffeinated drink?',
    hint: 'Coffee, tea, energy drinks, cola and pre-workout all count.',
    options: [
      { value: 'before_10am', label: 'Before 10am' },
      { value: '10am_12pm', label: '10am–12pm' },
      { value: '12pm_2pm', label: '12pm–2pm' },
      { value: '2pm_4pm', label: '2pm–4pm' },
      { value: 'after_4pm', label: 'After 4pm' },
      { value: 'none', label: "I don't consume caffeine" },
    ],
  },
  {
    id: 'prebed_screen_time',
    type: QUESTION_TYPES.SINGLE,
    title: 'In the hour before bed, how much time do you typically spend looking at a phone, TV or computer?',
    options: [
      { value: 'almost_none', label: 'Almost none' },
      { value: 'under_15', label: 'Less than 15 minutes' },
      { value: '15_30', label: '15–30 minutes' },
      { value: '30_60', label: '30–60 minutes' },
      { value: 'entire_hour', label: 'Almost the entire hour' },
    ],
  },
  {
    id: 'sleep_schedule_consistency',
    type: QUESTION_TYPES.SINGLE,
    title: 'How consistent is your bedtime across the week?',
    options: [
      { value: 'within_30', label: 'Usually within 30 minutes' },
      { value: 'within_60', label: 'Usually within an hour' },
      { value: 'varies_1_2h', label: 'Varies by 1–2 hours' },
      { value: 'varies_2h_plus', label: 'Varies by more than 2 hours' },
      { value: 'constantly', label: 'My schedule changes constantly' },
    ],
  },
  {
    id: 'sleep_disturbances',
    type: QUESTION_TYPES.MULTI,
    optional: true,
    title: 'What tends to disturb your sleep?',
    hint: 'Optional. Select everything that applies.',
    exclusiveValue: 'nothing',
    options: [
      { value: 'temperature', label: 'Temperature' },
      { value: 'noise', label: 'Noise' },
      { value: 'light', label: 'Light' },
      { value: 'partner', label: 'Partner movement' },
      { value: 'children', label: 'Children' },
      { value: 'pets', label: 'Pets' },
      { value: 'physical_discomfort', label: 'Physical discomfort' },
      { value: 'stress', label: 'Stress / racing thoughts' },
      { value: 'bathroom', label: 'Bathroom trips' },
      { value: 'nothing', label: 'Nothing regularly' },
    ],
  },
];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id) {
  return BY_ID.get(id);
}

/** Human-readable label for a stored answer value (or array of values). */
export function labelFor(questionId, value) {
  const q = BY_ID.get(questionId);
  if (!q) return value == null ? '' : String(value);
  if (Array.isArray(value)) return value.map((v) => labelFor(questionId, v));
  if (!q.options) return value == null ? '' : String(value);
  const opt = q.options.find((o) => o.value === value);
  return opt ? opt.label : String(value ?? '');
}

/** Number of questions shown in the progress indicator. */
export const QUESTION_COUNT = QUESTIONS.length;
