/**
 * Small copy helpers shared by the scoring summary, rules and results UI.
 * Keeping these pure makes the personalised copy easy to unit test.
 */

/** "a, b and c" */
export function joinNatural(items, conjunction = 'and') {
  const list = items.filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} ${conjunction} ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} ${conjunction} ${list[list.length - 1]}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function lowerFirst(str) {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** Adjective form of discomfort areas for prose: "hip and shoulder discomfort". */
export const DISCOMFORT_ADJECTIVE = Object.freeze({
  neck: 'neck',
  shoulders: 'shoulder',
  upper_back: 'upper back',
  lower_back: 'lower back',
  hips: 'hip',
  knees: 'knee',
  general_stiffness: 'general stiffness',
});

/** "hip and shoulder discomfort" / "general stiffness" — handles the stiffness noun. */
export function describeDiscomfort(areas = []) {
  const list = areas.filter((a) => a !== 'none' && DISCOMFORT_ADJECTIVE[a]);
  if (list.length === 0) return '';
  const hasStiffness = list.includes('general_stiffness');
  const others = list.filter((a) => a !== 'general_stiffness').map((a) => DISCOMFORT_ADJECTIVE[a]);
  const parts = [];
  if (others.length) parts.push(`${joinNatural(others)} discomfort`);
  if (hasStiffness) parts.push('general stiffness');
  return joinNatural(parts);
}

/** Prose phrase for the caffeine cutoff answer. */
export function caffeinePhrase(value) {
  switch (value) {
    case 'before_10am': return 'before 10am';
    case '10am_12pm': return 'between 10am and midday';
    case '12pm_2pm': return 'between midday and 2pm';
    case '2pm_4pm': return 'between 2pm and 4pm';
    case 'after_4pm': return 'after 4pm';
    default: return '';
  }
}

/** Prose phrase for pre-bed screen time. */
export function screenPhrase(value) {
  switch (value) {
    case 'almost_none': return 'almost none';
    case 'under_15': return 'less than 15 minutes';
    case '15_30': return '15 to 30 minutes';
    case '30_60': return 'most';
    case 'entire_hour': return 'almost all';
    default: return '';
  }
}

/** Prose phrase for sleep onset. */
export function onsetPhrase(value) {
  switch (value) {
    case 'under_10': return 'less than 10 minutes';
    case '10_20': return '10 to 20 minutes';
    case '20_40': return '20 to 40 minutes';
    case '40_60': return '40 to 60 minutes';
    case 'over_60': return 'more than an hour';
    default: return '';
  }
}

/** Prose phrase for bedtime consistency. */
export function consistencyPhrase(value) {
  switch (value) {
    case 'within_30': return 'stays within about 30 minutes';
    case 'within_60': return 'stays within about an hour';
    case 'varies_1_2h': return 'moves by one to two hours';
    case 'varies_2h_plus': return 'moves by more than two hours';
    case 'constantly': return 'changes constantly';
    default: return '';
  }
}

/** Prose phrase for night wakings. */
export function wakingsPhrase(value) {
  switch (value) {
    case 'rarely': return 'rarely wake during the night';
    case 'once': return 'usually wake once a night';
    case 'twice': return 'usually wake twice a night';
    case 'three_plus': return 'wake three or more times a night';
    case 'varies': return 'find your night wakings vary a lot';
    default: return '';
  }
}

/** Prose phrase for temperature. */
export function temperaturePhrase(value) {
  switch (value) {
    case 'too_hot': return 'you often feel too hot overnight';
    case 'slightly_warm': return 'you tend to run slightly warm at night';
    case 'comfortable': return 'your temperature usually feels comfortable';
    case 'slightly_cold': return 'you tend to feel slightly cold at night';
    case 'too_cold': return 'you often feel too cold overnight';
    case 'changes': return 'your temperature changes through the night';
    default: return '';
  }
}
