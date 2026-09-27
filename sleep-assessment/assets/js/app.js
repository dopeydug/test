/**
 * Muscle Mat — Personal Sleep Assessment
 * Application flow: intro → 15 questions → email → generating → report.
 *
 * Mount with:  import { mount } from './app.js'; mount(document.getElementById('mm-sleep-assessment'));
 * or simply include this module on a page that contains #mm-sleep-assessment.
 */

import { getConfig } from './data/config.js';
import { QUESTIONS, QUESTION_TYPES } from './data/questions.js';
import { resolveProducts } from './data/products.js';
import { buildReport } from './engine/report.js';
import { parseTime, sleepWindowMinutes } from './engine/time.js';
import { track, EVENTS } from './integrations/analytics.js';
import { syncSleepAssessmentToKlaviyo } from './integrations/klaviyo.js';
import * as storage from './integrations/storage.js';
import { h, clear, prefersReducedMotion } from './ui/dom.js';
import { renderHeader, renderIntro, renderQuestionScreen, renderEmailScreen, renderGenerating } from './ui/screens.js';
import { renderResults } from './ui/results.js';

const SCREENS = { INTRO: 'intro', QUESTION: 'question', EMAIL: 'email', GENERATING: 'generating', RESULTS: 'results' };

export function mount(root) {
  const config = getConfig();
  const products = resolveProducts(config.products);
  const total = QUESTIONS.length;

  const state = {
    screen: SCREENS.INTRO,
    step: 0,
    answers: {},
    email: '',
    consent: false,
    report: null,
    syncState: null,
    startedAt: null,
    isRetake: false,
  };

  let current = null;          // { el, focus?, cancel? }
  let autoAdvanceTimer = null;
  let transitioning = false;
  let keyHandler = null;

  root.classList.add('mm-sa');
  const header = renderHeader(config);
  const stage = h('main', { class: 'mm-sa-main' }, h('div', { class: 'mm-sa-stage', id: 'mm-sa-stage' }));
  const stageInner = stage.firstChild;
  const toast = h('div', { class: 'mm-sa-toast', role: 'status', 'aria-live': 'polite' });
  root.append(header, stage, toast);

  /* ------------------------------------------------------------ */
  /* Rendering + transitions                                        */
  /* ------------------------------------------------------------ */
  async function show(next, { pushHistory = true } = {}) {
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
    if (current && typeof current.cancel === 'function') current.cancel();
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }

    const previous = current;
    current = next;
    transitioning = true;
    if (previous && previous.el && !prefersReducedMotion()) {
      previous.el.classList.add('is-leaving');
      await wait(190);
    }
    clear(stageInner);
    stageInner.append(next.el);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (pushHistory) pushState();
    transitioning = false;
    if (typeof next.focus === 'function') next.focus();
    if (typeof next.onShown === 'function') next.onShown();
  }

  function pushState() {
    try {
      const hash = state.screen === SCREENS.QUESTION ? `#q${state.step + 1}` : state.screen === SCREENS.INTRO ? '' : `#${state.screen}`;
      history.pushState({ screen: state.screen, step: state.step }, '', `${location.pathname}${location.search}${hash}`);
    } catch { /* ignore */ }
  }

  window.addEventListener('popstate', (e) => {
    const s = e.state;
    if (!s || s.screen === SCREENS.INTRO) { renderIntroScreen({ pushHistory: false }); return; }
    if (s.screen === SCREENS.QUESTION && canVisit(s.step)) { state.step = s.step; renderQuestion({ pushHistory: false }); return; }
    if (s.screen === SCREENS.EMAIL && allAnswered()) { renderEmail({ pushHistory: false }); return; }
    if (s.screen === SCREENS.RESULTS && state.report) { renderReport({ pushHistory: false }); return; }
    renderIntroScreen({ pushHistory: false });
  });

  /* ------------------------------------------------------------ */
  /* Intro                                                          */
  /* ------------------------------------------------------------ */
  function renderIntroScreen(opts = {}) {
    state.screen = SCREENS.INTRO;
    const resume = storage.loadProgress();
    const latestReport = storage.getLatestReport();
    const el = renderIntro({
      config,
      resume: resume && resume.step > 0 ? resume : null,
      latestReport,
      onStart: () => start({ fresh: true }),
      onResume: () => { state.answers = { ...resume.answers }; state.step = Math.min(resume.step, total - 1); begin(); renderQuestion(); },
      onRestart: () => start({ fresh: true }),
      onViewReport: () => { state.report = latestReport; renderReport(); },
    });
    show({ el }, opts);
  }

  function start({ fresh }) {
    if (fresh) {
      const keepName = state.isRetake ? state.answers.first_name : undefined;
      state.answers = keepName ? { first_name: keepName } : {};
      storage.clearProgress();
    }
    state.step = 0;
    begin();
    renderQuestion();
  }

  function begin() {
    state.startedAt = Date.now();
    track(EVENTS.STARTED, { retake: state.isRetake, previous_score: state.isRetake && state.report ? state.report.overall_sleep_score : undefined });
  }

  /* ------------------------------------------------------------ */
  /* Questions                                                      */
  /* ------------------------------------------------------------ */
  function canVisit(step) {
    if (step < 0 || step >= total) return false;
    for (let i = 0; i < step; i += 1) {
      const q = QUESTIONS[i];
      if (!q.optional && validate(q, state.answers[q.id])) return false;
    }
    return true;
  }

  function allAnswered() {
    return QUESTIONS.every((q) => q.optional || !validate(q, state.answers[q.id]));
  }

  function validate(question, value) {
    switch (question.type) {
      case QUESTION_TYPES.TEXT: {
        const v = (value || '').trim();
        if (!v) return 'Please tell us your first name so we can personalise your report.';
        if (v.length > (question.maxLength || 40)) return 'That name is a little long. Just your first name is perfect.';
        if (!/^[\p{L}][\p{L}\p{M}'’ .-]*$/u.test(v)) return 'Please use letters only for your first name.';
        return null;
      }
      case QUESTION_TYPES.SINGLE:
        return value ? null : 'Please choose one option to continue.';
      case QUESTION_TYPES.MULTI:
        if (question.optional) return null;
        return Array.isArray(value) && value.length ? null : 'Please select at least one option, or “No regular discomfort”.';
      case QUESTION_TYPES.SCALE:
        return value != null && value !== '' ? null : 'Please choose a number between 1 and 10.';
      case QUESTION_TYPES.TIME: {
        if (parseTime(value) == null) return 'Please choose a time.';
        if (question.id === 'usual_wake_time') {
          const window = sleepWindowMinutes(parseTime(state.answers.usual_bedtime), parseTime(value));
          if (window == null) return 'Your wake time is the same as your bedtime. Please adjust one of them.';
        }
        return null;
      }
      default:
        return null;
    }
  }

  function renderQuestion(opts = {}) {
    state.screen = SCREENS.QUESTION;
    const question = QUESTIONS[state.step];
    const value = state.answers[question.id];
    let screen;
    screen = renderQuestionScreen({
      question,
      index: state.step,
      total,
      value,
      answers: state.answers,
      onChange: (v, meta = {}) => {
        state.answers[question.id] = v;
        // The time picker reports its default value synchronously while the
        // screen is still being built; store it and wait for the screen.
        if (!screen) return;
        if (!meta.silent) screen.setError('');
        screen.setContinueEnabled(!validate(question, v));
        storage.saveProgress(state.answers, state.step);
        // Auto-advance for simple single-choice questions after a short confirmation.
        if (question.type === QUESTION_TYPES.SINGLE && !meta.silent) {
          if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
          autoAdvanceTimer = setTimeout(() => { autoAdvanceTimer = null; next(); }, config.ui.autoAdvanceDelayMs);
        }
      },
      onBack: back,
      onContinue: next,
      onSkip: () => { state.answers[question.id] = []; next({ skipped: true }); },
    });
    screen.setContinueEnabled(!validate(question, state.answers[question.id]));

    // Keyboard shortcuts: 1–9 select options, Enter continues (except in text fields).
    const handler = (e) => {
      if (transitioning) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (/^[1-9]$/.test(e.key) && screen.control.selectIndex && (question.type === QUESTION_TYPES.SINGLE || question.type === QUESTION_TYPES.MULTI)) {
        e.preventDefault();
        screen.control.selectIndex(Number(e.key) - 1);
      } else if (e.key === 'Enter' && question.type !== QUESTION_TYPES.SINGLE) {
        e.preventDefault();
        next();
      }
    };
    show(screen, opts).then(() => { keyHandler = handler; document.addEventListener('keydown', handler); });
  }

  function next({ skipped = false } = {}) {
    if (transitioning) return;
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
    const question = QUESTIONS[state.step];
    const error = validate(question, state.answers[question.id]);
    if (error && !(question.optional && skipped)) { current.setError(error); current.focus(); return; }
    if (question.type === QUESTION_TYPES.TEXT) state.answers[question.id] = state.answers[question.id].trim();
    if (question.optional && state.answers[question.id] == null) state.answers[question.id] = [];

    track(EVENTS.QUESTION_COMPLETED, {
      question_id: question.id,
      question_index: state.step + 1,
      question_total: total,
      // First name is personal data: never sent to analytics.
      answer: question.id === 'first_name' ? undefined : state.answers[question.id],
      skipped,
    });

    if (state.step >= total - 1) { storage.saveProgress(state.answers, total); renderEmail(); return; }
    state.step += 1;
    storage.saveProgress(state.answers, state.step);
    renderQuestion();
  }

  function back() {
    if (transitioning) return;
    if (state.step === 0) { renderIntroScreen(); return; }
    state.step -= 1;
    renderQuestion();
  }

  /* ------------------------------------------------------------ */
  /* Email capture → generating → results                           */
  /* ------------------------------------------------------------ */
  function renderEmail(opts = {}) {
    state.screen = SCREENS.EMAIL;
    const screen = renderEmailScreen({
      config,
      firstName: state.answers.first_name,
      initialEmail: state.email,
      initialConsent: state.consent,
      onBack: () => { state.step = total - 1; renderQuestion(); },
      onSubmit: ({ email, marketingConsent }) => {
        state.email = email;
        state.consent = marketingConsent;
        completeAssessment();
      },
    });
    show(screen, opts);
  }

  async function completeAssessment() {
    state.screen = SCREENS.GENERATING;
    const previous = storage.getLatestReport();
    const report = buildReport(state.answers, { email: state.email, marketingConsent: state.consent, previous });
    state.report = report;
    storage.saveReport(report);
    storage.clearProgress();

    track(EVENTS.COMPLETED, {
      assessment_id: report.assessment_id,
      overall_sleep_score: report.overall_sleep_score,
      routine_score: report.routine_score,
      environment_score: report.environment_score,
      comfort_score: report.comfort_score,
      winddown_score: report.winddown_score,
      primary_opportunity: report.primary_opportunity,
      sleep_goal: report.sleep_goal,
      marketing_consent: report.marketing_consent,
      retake: Boolean(previous),
      duration_seconds: state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : undefined,
    });

    // Sync while the generating state plays; never block the report on it.
    const sync = Promise.race([
      syncSleepAssessmentToKlaviyo(report, { config }),
      wait(config.ui.generatingDurationMs + 2500).then(() => ({ client: false, server: false, errors: ['timeout'] })),
    ]);

    const generating = renderGenerating({
      durationMs: config.ui.generatingDurationMs,
      onDone: async () => { state.syncState = await sync; renderReport(); },
    });
    // Not pushed to history: the browser Back button from the report returns
    // to the email step, never to the transient generating state.
    show(generating, { pushHistory: false });
  }

  function renderReport(opts = {}) {
    state.screen = SCREENS.RESULTS;
    const report = state.report;
    const added = new Set(readAdded(report.assessment_id));
    const screen = renderResults({
      report,
      products,
      config,
      syncState: state.syncState,
      addedRecommendationIds: added,
      resetStartedAt: readResetStart(report.assessment_id),
      onRetake: () => { state.isRetake = true; start({ fresh: true }); },
      onPrint: () => { track(EVENTS.RECOMMENDATION_CLICKED, { action: 'print_report', assessment_id: report.assessment_id }); window.print(); },
      onProductClick: (product, placement) => track(EVENTS.PRODUCT_CLICKED, {
        assessment_id: report.assessment_id, product_id: product.id, product_handle: product.handle, product_title: product.title, placement,
      }),
      onRecommendationToggle: (rec, button) => {
        const on = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', String(on));
        button.querySelector('span:last-child').textContent = on ? 'Added to my plan' : 'Add to my plan';
        const box = button.querySelector('.mm-sa-check__box');
        box.style.background = on ? 'var(--mm-navy)' : '';
        box.style.borderColor = on ? 'var(--mm-navy)' : '';
        box.querySelector('svg').style.opacity = on ? '1' : '';
        if (on) added.add(rec.id); else added.delete(rec.id);
        writeAdded(report.assessment_id, [...added]);
        track(EVENTS.RECOMMENDATION_CLICKED, { assessment_id: report.assessment_id, recommendation_id: rec.id, recommendation_title: rec.title, priority: rec.priority, added: on });
        showToast(on ? 'Added to your plan' : 'Removed from your plan');
      },
      onResetStart: (button) => {
        const startedAt = new Date().toISOString();
        writeResetStart(report.assessment_id, startedAt);
        track(EVENTS.RESET_STARTED, { assessment_id: report.assessment_id, started_at: startedAt });
        button.replaceWith(h('p', { class: 'mm-sa-small', text: 'Your reset starts tonight. Day 1: notice, don’t change.' }));
        showToast('Your 7-Day Reset starts tonight');
      },
    });
    show(screen, opts).then(() => {
      track(EVENTS.REPORT_VIEWED, { assessment_id: report.assessment_id, overall_sleep_score: report.overall_sleep_score, primary_opportunity: report.primary_opportunity });
    });
  }

  /* ------------------------------------------------------------ */
  /* Small utilities                                                */
  /* ------------------------------------------------------------ */
  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function readAdded(id) { try { return JSON.parse(localStorage.getItem(`mm_sa_added_${id}`) || '[]'); } catch { return []; } }
  function writeAdded(id, list) { try { localStorage.setItem(`mm_sa_added_${id}`, JSON.stringify(list)); } catch { /* ignore */ } }
  function readResetStart(id) { try { return localStorage.getItem(`mm_sa_reset_${id}`); } catch { return null; } }
  function writeResetStart(id, iso) { try { localStorage.setItem(`mm_sa_reset_${id}`, iso); } catch { /* ignore */ } }

  /* ------------------------------------------------------------ */
  /* Boot                                                           */
  /* ------------------------------------------------------------ */
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  if (demo && DEMO_ANSWERS[demo]) {
    // QA aid: ?demo=example|good|poor renders a report instantly without saving it.
    state.answers = { ...DEMO_ANSWERS[demo] };
    state.report = buildReport(state.answers, { email: params.get('email') || '' });
    renderReport({ pushHistory: false });
  } else if (location.hash === '#results' && storage.getLatestReport()) {
    state.report = storage.getLatestReport();
    renderReport({ pushHistory: false });
  } else {
    renderIntroScreen({ pushHistory: false });
  }
  try { history.replaceState({ screen: state.screen, step: state.step }, '', location.href); } catch { /* ignore */ }

  return { state, config };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fixtures for ?demo= — mirrors the unit-test fixtures. */
export const DEMO_ANSWERS = {
  example: {
    first_name: 'Jess', sleep_goal: 'fall_asleep', usual_bedtime: '22:30', usual_wake_time: '06:30', sleep_onset: '20_40', night_wakings: 'once',
    morning_refresh_score: 6, sleep_temperature: 'too_hot', sleep_position: 'combination', bed_comfort_score: 7, sleep_discomfort_areas: ['none'],
    caffeine_cutoff: '2pm_4pm', prebed_screen_time: '30_60', sleep_schedule_consistency: 'within_60', sleep_disturbances: ['nothing'],
  },
  good: {
    first_name: 'Sam', sleep_goal: 'curious', usual_bedtime: '22:30', usual_wake_time: '06:30', sleep_onset: '10_20', night_wakings: 'rarely',
    morning_refresh_score: 8, sleep_temperature: 'comfortable', sleep_position: 'side', bed_comfort_score: 9, sleep_discomfort_areas: ['none'],
    caffeine_cutoff: 'before_10am', prebed_screen_time: 'almost_none', sleep_schedule_consistency: 'within_30', sleep_disturbances: ['nothing'],
  },
  poor: {
    first_name: 'Alex', sleep_goal: 'physical_comfort', usual_bedtime: '00:30', usual_wake_time: '06:00', sleep_onset: 'over_60', night_wakings: 'three_plus',
    morning_refresh_score: 2, sleep_temperature: 'too_hot', sleep_position: 'side', bed_comfort_score: 3, sleep_discomfort_areas: ['neck', 'hips', 'lower_back'],
    caffeine_cutoff: 'after_4pm', prebed_screen_time: 'entire_hour', sleep_schedule_consistency: 'constantly', sleep_disturbances: ['temperature', 'light', 'stress', 'noise'],
  },
};

// Auto-mount when the host page provides the container.
if (typeof document !== 'undefined') {
  const boot = () => {
    const root = document.getElementById('mm-sleep-assessment');
    if (root && !root.dataset.mounted) { root.dataset.mounted = 'true'; mount(root); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
