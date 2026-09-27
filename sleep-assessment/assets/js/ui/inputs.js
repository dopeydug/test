/**
 * Input components for the assessment. Each returns { el, focus } and reports
 * changes through `onChange`. All are keyboard-accessible: options behave as
 * radio / checkbox groups, the scale is a radiogroup, the time picker uses
 * spinbuttons with arrow keys.
 */

import { h, icon } from './dom.js';
import { parseTime, toHHMM, formatTime, sleepWindowMinutes, formatDurationProse } from '../engine/time.js';

/* ------------------------------------------------------------------ */
/* Single choice                                                       */
/* ------------------------------------------------------------------ */
export function renderSingleChoice(question, value, { onChange }) {
  const group = h('div', { class: 'mm-sa-options', role: 'radiogroup', 'aria-labelledby': `q-${question.id}-title` });
  const buttons = question.options.map((opt, i) => {
    const btn = h('button', {
      type: 'button', role: 'radio', class: 'mm-sa-option', 'aria-checked': String(opt.value === value),
      dataset: { value: opt.value }, tabindex: opt.value === value || (value == null && i === 0) ? '0' : '-1',
      onclick: () => select(opt.value),
      onkeydown: (e) => onRadioKey(e, buttons, i),
    },
    question.icons ? icon(`pos_${opt.value}`, 'mm-sa-option__icon') : null,
    h('span', { class: 'mm-sa-option__label', text: opt.label }),
    i < 9 ? h('span', { class: 'mm-sa-option__key', text: String(i + 1), 'aria-hidden': 'true' }) : null,
    h('span', { class: 'mm-sa-option__mark' }, icon('check')),
    );
    return btn;
  });
  group.append(...buttons);

  function select(v) {
    buttons.forEach((b) => {
      const on = b.dataset.value === v;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    onChange(v);
  }

  return {
    el: group,
    focus: () => (buttons.find((b) => b.tabIndex === 0) || buttons[0]).focus({ preventScroll: true }),
    selectIndex: (i) => buttons[i] && select(buttons[i].dataset.value),
  };
}

function onRadioKey(e, buttons, i) {
  const move = (delta) => {
    e.preventDefault();
    const next = buttons[(i + delta + buttons.length) % buttons.length];
    next.focus();
  };
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') move(1);
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') move(-1);
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); buttons[i].click(); }
}

/* ------------------------------------------------------------------ */
/* Multi choice (with exclusive "none" option)                        */
/* ------------------------------------------------------------------ */
export function renderMultiChoice(question, values = [], { onChange }) {
  let selected = new Set(values || []);
  const twoCol = question.options.length >= 8;
  const group = h('div', { class: `mm-sa-options ${twoCol ? 'mm-sa-options--two' : ''}`, role: 'group', 'aria-labelledby': `q-${question.id}-title` });
  const buttons = question.options.map((opt, i) => h('button', {
    type: 'button', role: 'checkbox', class: 'mm-sa-option mm-sa-option--multi', 'aria-checked': String(selected.has(opt.value)),
    dataset: { value: opt.value },
    onclick: () => toggle(opt.value),
    // Space toggles (checkbox convention). Enter is left to the screen, which
    // treats it as "Continue", so it can never toggle an option by accident.
    onkeydown: (e) => {
      if (e.key === ' ') { e.preventDefault(); toggle(opt.value); }
      else if (e.key === 'Enter') e.preventDefault();
    },
  },
  h('span', { class: 'mm-sa-option__label', text: opt.label }),
  i < 9 ? h('span', { class: 'mm-sa-option__key', text: String(i + 1), 'aria-hidden': 'true' }) : null,
  h('span', { class: 'mm-sa-option__mark' }, icon('check')),
  ));
  group.append(...buttons);

  function toggle(v) {
    const exclusive = question.exclusiveValue;
    if (selected.has(v)) selected.delete(v);
    else if (v === exclusive) selected = new Set([v]);           // "none" clears the rest
    else { selected.add(v); if (exclusive) selected.delete(exclusive); } // anything else clears "none"
    buttons.forEach((b) => b.setAttribute('aria-checked', String(selected.has(b.dataset.value))));
    onChange([...selected]);
  }

  return {
    el: group,
    focus: () => buttons[0].focus({ preventScroll: true }),
    selectIndex: (i) => buttons[i] && toggle(buttons[i].dataset.value),
  };
}

/* ------------------------------------------------------------------ */
/* 1–10 scale                                                          */
/* ------------------------------------------------------------------ */
export function renderScale(question, value, { onChange }) {
  const min = question.min ?? 1;
  const max = question.max ?? 10;
  let current = value == null ? null : Number(value);
  const valueEl = h('div', { class: 'mm-sa-scale__value', 'aria-live': 'polite' });
  const cells = [];
  for (let n = min; n <= max; n += 1) {
    cells.push(h('button', {
      type: 'button', role: 'radio', class: 'mm-sa-scale__cell', 'aria-checked': String(current === n),
      'aria-label': `${n} out of ${max}`, dataset: { value: String(n) }, tabindex: current === n || (current == null && n === min) ? '0' : '-1',
      onclick: () => select(n),
      onkeydown: (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); select(Math.min(max, (current ?? min - 1) + 1), true); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); select(Math.max(min, (current ?? min + 1) - 1), true); }
        else if (e.key === 'Home') { e.preventDefault(); select(min, true); }
        else if (e.key === 'End') { e.preventDefault(); select(max, true); }
        else if (e.key === 'Enter') e.preventDefault(); // Enter = Continue, never a silent selection
      },
    }, String(n)));
  }
  const grid = h('div', { class: 'mm-sa-scale__grid', role: 'radiogroup', 'aria-labelledby': `q-${question.id}-title` }, cells);
  const wrap = h('div', { class: 'mm-sa-scale' },
    valueEl,
    grid,
    h('div', { class: 'mm-sa-scale__labels' }, h('span', { text: `${min} — ${question.minLabel}` }), h('span', { text: `${max} — ${question.maxLabel}` })),
  );
  paint();

  function select(n, focus = false) {
    current = n;
    paint();
    if (focus) cells[n - min].focus();
    onChange(n);
  }
  function paint() {
    cells.forEach((c) => {
      const n = Number(c.dataset.value);
      c.setAttribute('aria-checked', String(current === n));
      c.classList.toggle('is-below', current != null && n < current);
      c.tabIndex = current === n || (current == null && n === min) ? 0 : -1;
    });
    valueEl.replaceChildren(
      current == null
        ? h('small', { text: 'Choose a number' })
        : h('span', {}, String(current), h('small', { text: `/ ${max}` })),
    );
  }

  return { el: wrap, focus: () => (cells.find((c) => c.tabIndex === 0) || cells[0]).focus({ preventScroll: true }) };
}

/* ------------------------------------------------------------------ */
/* Time picker                                                         */
/* ------------------------------------------------------------------ */
const MINUTE_STEP = 5;

export function renderTimePicker(question, value, { onChange, describe }) {
  let minutes = parseTime(value) ?? parseTime(question.defaultValue) ?? 22 * 60 + 30;
  const hourEl = spin('Hour', 1, 12);
  const minuteEl = spin('Minutes', 0, 59);
  const periodEl = spin('AM or PM', 0, 1);
  const presets = (question.presets || []).map((p) => h('button', {
    type: 'button', class: 'mm-sa-chip', 'aria-pressed': 'false', dataset: { preset: p }, text: formatTime(parseTime(p)),
    onclick: () => set(parseTime(p)),
  }));
  const noteEl = h('div', { class: 'mm-sa-time__window', hidden: true, 'aria-live': 'polite' });
  const dial = h('div', { class: 'mm-sa-time__dial', role: 'group', 'aria-label': 'Choose a time' },
    column(hourEl, () => bump('hour', 1), () => bump('hour', -1)),
    h('div', { class: 'mm-sa-time__colon', 'aria-hidden': 'true', text: ':' }),
    column(minuteEl, () => bump('minute', 1), () => bump('minute', -1)),
    column(periodEl, () => bump('period', 1), () => bump('period', -1)),
  );
  const wrap = h('div', { class: 'mm-sa-time' }, dial, h('div', { class: 'mm-sa-time__presets', role: 'group', 'aria-label': 'Common times' }, presets), noteEl);
  paint();
  onChange(toHHMM(minutes), { silent: true });

  function spin(label, min, max) {
    return h('div', {
      class: `mm-sa-time__val ${label.startsWith('AM') ? 'mm-sa-time__val--period' : ''}`, role: 'spinbutton', tabindex: '0',
      'aria-label': label, 'aria-valuemin': String(min), 'aria-valuemax': String(max),
      onkeydown: (e) => {
        const kind = label === 'Hour' ? 'hour' : label === 'Minutes' ? 'minute' : 'period';
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); bump(kind, 1); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); bump(kind, -1); }
      },
    });
  }
  function column(valueEl, up, down) {
    return h('div', { class: 'mm-sa-time__col' },
      h('button', { type: 'button', class: 'mm-sa-time__step', 'aria-label': `Increase ${valueEl.getAttribute('aria-label')}`, onclick: up, tabindex: '-1' }, icon('chevronUp')),
      valueEl,
      h('button', { type: 'button', class: 'mm-sa-time__step', 'aria-label': `Decrease ${valueEl.getAttribute('aria-label')}`, onclick: down, tabindex: '-1' }, icon('chevronDown')),
    );
  }
  function bump(kind, dir) {
    if (kind === 'hour') set(minutes + dir * 60);
    else if (kind === 'minute') {
      const h24 = Math.floor(minutes / 60);
      const m = ((Math.round(minutes % 60 / MINUTE_STEP) * MINUTE_STEP) + dir * MINUTE_STEP + 60) % 60;
      set(h24 * 60 + m);
    } else set(minutes + 12 * 60);
  }
  function set(next) {
    minutes = ((next % 1440) + 1440) % 1440;
    paint();
    onChange(toHHMM(minutes));
  }
  function paint() {
    const h24 = Math.floor(minutes / 60);
    const m = minutes % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    hourEl.textContent = String(h12);
    hourEl.setAttribute('aria-valuenow', String(h12));
    minuteEl.textContent = String(m).padStart(2, '0');
    minuteEl.setAttribute('aria-valuenow', String(m));
    periodEl.textContent = h24 >= 12 ? 'PM' : 'AM';
    periodEl.setAttribute('aria-valuenow', h24 >= 12 ? '1' : '0');
    periodEl.setAttribute('aria-valuetext', h24 >= 12 ? 'PM' : 'AM');
    const hhmm = toHHMM(minutes);
    presets.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.preset === hhmm)));
    const note = typeof describe === 'function' ? describe(hhmm) : null;
    if (note) { noteEl.hidden = false; noteEl.replaceChildren(...note); } else { noteEl.hidden = true; }
  }

  return { el: wrap, focus: () => hourEl.focus({ preventScroll: true }) };
}

/** Sleep-window note shown on the wake-time question. */
export function describeSleepWindow(bedtimeHHMM) {
  return (wakeHHMM) => {
    const bed = parseTime(bedtimeHHMM);
    const wake = parseTime(wakeHHMM);
    if (bed == null || wake == null) return null;
    const window = sleepWindowMinutes(bed, wake);
    if (window == null) return [h('span', { text: 'Your wake time matches your bedtime. Adjust one of them so we can work out your sleep window.' })];
    return [
      h('strong', { text: formatDurationProse(window) }),
      h('span', { text: `in bed between ${formatTime(bed)} and ${formatTime(wake)}. Your actual sleep will be a little less than this.` }),
    ];
  };
}

/* ------------------------------------------------------------------ */
/* Text field                                                          */
/* ------------------------------------------------------------------ */
export function renderTextField(question, value, { onChange, onSubmit }) {
  const input = h('input', {
    type: 'text', class: 'mm-sa-input', id: `q-${question.id}-input`, placeholder: question.placeholder || '',
    autocomplete: question.autocomplete || 'off', autocapitalize: 'words', spellcheck: 'false', maxlength: String(question.maxLength || 60),
    enterkeyhint: 'next', value: value || '',
    oninput: (e) => onChange(e.target.value),
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } },
  });
  const wrap = h('div', { class: 'mm-sa-field' },
    h('label', { for: input.id, text: question.placeholder || 'Your answer' }),
    input,
  );
  return { el: wrap, focus: () => input.focus({ preventScroll: true }), input };
}
