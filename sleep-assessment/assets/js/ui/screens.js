/**
 * Screens: intro, question shell (progress + navigation), email capture and
 * the report-generation state. Pure rendering; the flow lives in app.js.
 */

import { h, icon, withImageFallback } from './dom.js';
import { QUESTION_TYPES } from '../data/questions.js';
import {
  renderSingleChoice, renderMultiChoice, renderScale, renderTimePicker, renderTextField, describeSleepWindow,
} from './inputs.js';

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
export function renderHeader(config) {
  const logo = h('a', { class: 'mm-sa-logo', href: config.brand.homeUrl, 'aria-label': `${config.brand.name} home` },
    withImageFallback(h('img', { src: config.brand.logoUrl, alt: config.brand.logoAlt, width: '150', height: '26' }), (img) => img.closest('.mm-sa-logo').classList.add('is-fallback')),
    h('span', { class: 'mm-sa-logo__word', text: config.brand.name }),
  );
  return h('header', { class: 'mm-sa-header' },
    h('div', { class: 'mm-sa-container mm-sa-header__inner' },
      logo,
      h('div', { class: 'mm-sa-header__right' },
        h('span', { class: 'mm-sa-header__title', text: 'Complimentary Sleep Assessment' }),
        h('a', { class: 'mm-sa-header__exit', href: config.brand.homeUrl, text: 'Exit' }),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */
export function renderIntro({ config, resume, latestReport, onStart, onResume, onRestart, onViewReport }) {
  const image = withImageFallback(h('img', { src: config.brand.heroImageUrl, alt: config.brand.heroImageAlt, loading: 'eager', fetchpriority: 'high' }));
  const resumeBox = resume
    ? h('div', { class: 'mm-sa-intro__resume' },
        h('span', { text: `You're part-way through${resume.answers.first_name ? `, ${resume.answers.first_name}` : ''}.` }),
        h('button', { type: 'button', class: 'mm-sa-link', text: 'Continue where you left off', onclick: onResume }),
        h('button', { type: 'button', class: 'mm-sa-link', text: 'Start again', onclick: onRestart }),
      )
    : latestReport
      ? h('div', { class: 'mm-sa-intro__resume' },
          h('span', { text: `Your last report scored ${latestReport.overall_sleep_score}/100.` }),
          h('button', { type: 'button', class: 'mm-sa-link', text: 'View my last report', onclick: onViewReport }),
        )
      : null;

  return h('section', { class: 'mm-sa-screen mm-sa-intro', 'aria-labelledby': 'mm-sa-intro-title' },
    h('div', { class: 'mm-sa-container' },
      h('div', { class: 'mm-sa-intro__grid' },
        h('div', { class: 'mm-sa-intro__copy' },
          h('p', { class: 'mm-sa-eyebrow', text: 'Complimentary for Muscle Mat customers' }),
          h('h1', { class: 'mm-sa-display mm-sa-h1', id: 'mm-sa-intro-title' }, 'Understand your sleep.', h('br'), 'Improve what matters.'),
          h('p', { class: 'mm-sa-lead', text: 'Complete our 2-minute sleep assessment and receive a personalised breakdown of your sleep habits, environment and comfort, plus practical recommendations you can start tonight.' }),
          h('div', { class: 'mm-sa-intro__actions' },
            h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--primary', onclick: onStart }, 'Start My Sleep Assessment', icon('arrowRight')),
            h('p', { class: 'mm-sa-intro__meta' }, h('span', { text: 'Approximately 2 minutes' }), h('span', { text: 'Personalised results' }), h('span', { text: 'No cost' })),
          ),
          resumeBox,
        ),
        h('div', { class: 'mm-sa-intro__visual' },
          h('div', { class: 'mm-sa-intro__frame' }, image,
            h('div', { class: 'mm-sa-intro__caption' }, h('span', { class: 'mm-sa-eyebrow', text: 'Your report includes' }), h('strong', { text: 'A sleep score, three priorities, tonight’s plan and a 7-day reset.' })),
          ),
          h('div', { class: 'mm-sa-intro__block', 'aria-hidden': 'true' }),
        ),
      ),
      h('div', { class: 'mm-sa-benefits' },
        benefit('01', 'Understand your sleep', 'See which areas of your routine and environment may be affecting your rest.'),
        benefit('02', 'Get personalised recommendations', 'Receive practical suggestions based on your answers.'),
        benefit('03', 'Build a better routine', 'Turn your results into a simple 7-day plan.'),
      ),
    ),
  );
}

function benefit(n, title, body) {
  return h('div', { class: 'mm-sa-benefit' }, h('span', { class: 'mm-sa-benefit__n', text: n }), h('h3', { text: title }), h('p', { text: body }));
}

/* ------------------------------------------------------------------ */
/* Question shell                                                      */
/* ------------------------------------------------------------------ */
export function renderQuestionScreen({ question, index, total, value, answers, onChange, onBack, onContinue, onSkip }) {
  const errorEl = h('p', { class: 'mm-sa-question__error', role: 'alert', 'aria-live': 'assertive' });
  const continueBtn = h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--primary', onclick: onContinue }, index === total - 1 ? 'See my report' : 'Continue', icon('arrowRight'));
  const backBtn = h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--ghost', onclick: onBack, disabled: index === 0 }, icon('arrowLeft'), 'Back');
  const skipBtn = question.optional ? h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--ghost', text: 'Skip', onclick: onSkip }) : null;

  let control;
  const change = (v, meta) => onChange(v, meta);
  switch (question.type) {
    case QUESTION_TYPES.TEXT:
      control = renderTextField(question, value, { onChange: change, onSubmit: onContinue });
      break;
    case QUESTION_TYPES.SINGLE:
      control = renderSingleChoice(question, value, { onChange: change });
      break;
    case QUESTION_TYPES.MULTI:
      control = renderMultiChoice(question, value, { onChange: change });
      break;
    case QUESTION_TYPES.SCALE:
      control = renderScale(question, value, { onChange: change });
      break;
    case QUESTION_TYPES.TIME:
      control = renderTimePicker(question, value, {
        onChange: change,
        describe: question.showSleepWindow ? describeSleepWindow(answers.usual_bedtime) : null,
      });
      break;
    default:
      control = { el: h('div'), focus() {} };
  }

  const pct = Math.round(((index + 1) / total) * 100);
  const el = h('section', { class: 'mm-sa-screen mm-sa-assessment', 'aria-labelledby': `q-${question.id}-title` },
    h('div', { class: 'mm-sa-container' },
      h('div', { class: 'mm-sa-narrow' },
        h('div', { class: 'mm-sa-progress' },
          h('div', { class: 'mm-sa-progress__row' },
            h('span', { class: 'mm-sa-eyebrow', text: 'Your sleep assessment' }),
            h('span', { class: 'mm-sa-progress__count', text: `Question ${index + 1} of ${total}` }),
          ),
          h('div', { class: 'mm-sa-progress__track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(index + 1), 'aria-label': 'Assessment progress' },
            h('div', { class: 'mm-sa-progress__fill', style: { width: `${Math.max(4, ((index) / total) * 100)}%` }, dataset: { target: `${pct}%` } }),
          ),
        ),
        h('div', { class: 'mm-sa-question' },
          h('div', { class: 'mm-sa-question__head' },
            question.eyebrow ? h('p', { class: 'mm-sa-eyebrow', text: question.eyebrow }) : null,
            h('h2', { class: 'mm-sa-display mm-sa-question__title', id: `q-${question.id}-title`, text: question.title }),
            question.hint ? h('p', { class: 'mm-sa-question__hint', text: question.hint }) : null,
          ),
          control.el,
          errorEl,
        ),
      ),
    ),
    h('div', { class: 'mm-sa-nav' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-narrow mm-sa-nav__inner' }, backBtn, h('div', { class: 'mm-sa-nav__right' }, skipBtn, continueBtn)),
      ),
    ),
  );

  // Animate the progress bar to its new value after paint.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fill = el.querySelector('.mm-sa-progress__fill');
    if (fill) fill.style.width = fill.dataset.target;
  }));

  return {
    el,
    control,
    focus: () => control.focus(),
    setError: (msg) => { errorEl.textContent = msg || ''; if (control.input) control.input.setAttribute('aria-invalid', msg ? 'true' : 'false'); },
    setContinueEnabled: (enabled) => { continueBtn.disabled = !enabled; },
  };
}

/* ------------------------------------------------------------------ */
/* Email capture                                                       */
/* ------------------------------------------------------------------ */
export function renderEmailScreen({ config, firstName, initialEmail = '', initialConsent = false, onSubmit, onBack }) {
  const errorEl = h('p', { class: 'mm-sa-question__error', role: 'alert' });
  const input = h('input', {
    type: 'email', class: 'mm-sa-input mm-sa-input--email', id: 'mm-sa-email', placeholder: 'you@example.com', autocomplete: 'email',
    inputmode: 'email', enterkeyhint: 'go', spellcheck: 'false', value: initialEmail, required: true,
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } },
    oninput: () => { errorEl.textContent = ''; input.removeAttribute('aria-invalid'); },
  });
  const consent = h('input', { type: 'checkbox', id: 'mm-sa-consent', checked: initialConsent || null });
  const submitBtn = h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--primary mm-sa-btn--block', onclick: () => submit() }, 'Show My Sleep Report', icon('arrowRight'));

  function submit() {
    const email = input.value.trim();
    if (!isValidEmail(email)) {
      errorEl.textContent = 'Please enter a valid email address so we can save your report.';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    submitBtn.disabled = true;
    onSubmit({ email, marketingConsent: consent.checked });
  }

  const el = h('section', { class: 'mm-sa-screen mm-sa-email', 'aria-labelledby': 'mm-sa-email-title' },
    h('div', { class: 'mm-sa-container' },
      h('div', { class: 'mm-sa-narrow mm-sa-email__card' },
        h('p', { class: 'mm-sa-eyebrow', text: 'Almost there' }),
        h('h2', { class: 'mm-sa-display mm-sa-h2', id: 'mm-sa-email-title', text: `${firstName ? `${firstName}, your` : 'Your'} personalised sleep report is ready.` }),
        h('p', { class: 'mm-sa-lead', text: 'We’ve analysed your answers across sleep routine, comfort, environment and recovery.' }),
        h('div', { class: 'mm-sa-email__preview', 'aria-hidden': 'true' },
          previewTile('Routine', '72%'), previewTile('Environment', '58%'), previewTile('Comfort', '81%'), previewTile('Wind-down', '46%'),
        ),
        h('div', { class: 'mm-sa-field' },
          h('label', { for: 'mm-sa-email', text: 'Where should we save your report?' }),
          input,
          errorEl,
        ),
        h('label', { class: 'mm-sa-check', for: 'mm-sa-consent' },
          consent,
          h('span', { class: 'mm-sa-check__box' }, icon('check')),
          h('span', { text: 'Yes, send me occasional sleep tips and Muscle Mat news by email. Optional. Unsubscribe at any time.' }),
        ),
        submitBtn,
        h('p', { class: 'mm-sa-micro' },
          'We use your email to save and send your sleep report. Marketing emails are only sent if you tick the box above. See the ',
          h('a', { href: config.brand.privacyUrl, target: '_blank', rel: 'noopener', text: 'Muscle Mat Privacy Policy' }),
          ' for how your information is handled.',
        ),
        h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--ghost', onclick: onBack }, icon('arrowLeft'), 'Back to my answers'),
      ),
    ),
  );
  return { el, focus: () => input.focus({ preventScroll: true }) };
}

function previewTile(label, width) {
  return h('span', {}, h('i', { style: { '--w': width } }), label);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/* ------------------------------------------------------------------ */
/* Generating                                                          */
/* ------------------------------------------------------------------ */
export const GENERATING_MESSAGES = [
  'Reviewing your sleep routine…',
  'Assessing your sleep environment…',
  'Identifying your highest-impact opportunities…',
  'Building your personalised plan…',
];

export function renderGenerating({ durationMs = 2800, messages = GENERATING_MESSAGES, onDone }) {
  const msg = h('p', { class: 'mm-sa-generating__msg', text: messages[0], 'aria-live': 'polite' });
  const bar = h('i');
  const el = h('section', { class: 'mm-sa-screen mm-sa-generating', 'aria-busy': 'true' },
    h('div', { class: 'mm-sa-generating__inner' },
      h('div', { class: 'mm-sa-generating__ring', 'aria-hidden': 'true' },
        h('svg', { viewBox: '0 0 84 84' }),
      ),
      h('p', { class: 'mm-sa-eyebrow', text: 'Preparing your report' }),
      msg,
      h('div', { class: 'mm-sa-generating__bar', 'aria-hidden': 'true' }, bar),
    ),
  );
  // Inline SVG via innerHTML (static markup).
  el.querySelector('svg').outerHTML = '<svg viewBox="0 0 84 84" aria-hidden="true"><circle class="track" cx="42" cy="42" r="38"/><circle class="arc" cx="42" cy="42" r="38"/></svg>';

  const stepMs = durationMs / messages.length;
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    if (i >= messages.length) { clearInterval(timer); return; }
    msg.classList.add('is-swapping');
    setTimeout(() => { msg.textContent = messages[i]; msg.classList.remove('is-swapping'); }, 220);
  }, stepMs);
  requestAnimationFrame(() => { bar.style.transitionDuration = `${durationMs}ms`; bar.style.width = '100%'; });
  const done = setTimeout(() => { clearInterval(timer); onDone(); }, durationMs);

  return { el, cancel: () => { clearInterval(timer); clearTimeout(done); } };
}
