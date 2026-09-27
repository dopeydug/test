/**
 * Results screen — the personalised sleep report.
 * Editorial, wider layout than the assessment. All copy comes from the report
 * object produced by engine/report.js; nothing here recomputes scores.
 */

import { h, icon, withImageFallback, nextFrame, prefersReducedMotion } from './dom.js';
import { CATEGORIES } from '../engine/scoring.js';
import { formatPrice } from '../data/products.js';
import { formatDurationProse, formatTime, parseTime, sleepWindowMinutes } from '../engine/time.js';

export function renderResults({
  report, products, config, syncState, addedRecommendationIds = new Set(), resetStartedAt = null,
  onRetake, onPrint, onProductClick, onRecommendationToggle, onResetStart,
}) {
  const name = report.first_name || 'Your';
  const possessive = report.first_name ? `${report.first_name}’s` : 'Your';
  const date = formatDate(report.assessment_completed_at);
  const lowest = report.primary_opportunity_category;

  const el = h('article', { class: 'mm-sa-screen mm-sa-results', 'aria-labelledby': 'mm-sa-report-title' },
    /* ---------------- Hero: title + score ---------------- */
    h('section', { class: 'mm-sa-rhero' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide mm-sa-rhero__grid' },
          h('div', { class: 'mm-sa-rhero__copy' },
            h('p', { class: 'mm-sa-eyebrow', text: `Personal sleep report · ${date}` }),
            h('h1', { class: 'mm-sa-display mm-sa-h1', id: 'mm-sa-report-title', tabindex: '-1', text: `${possessive} Sleep Report` }),
            h('p', { class: 'mm-sa-lead', text: 'Based on your sleep routine, environment and comfort.' }),
            h('p', { class: 'mm-sa-body', text: report.summary }),
            report.strengths.length
              ? h('div', { class: 'mm-sa-strengths' }, h('span', { class: 'mm-sa-strengths__label', text: 'What’s working:' }), report.strengths.map((s) => h('span', { class: 'mm-sa-tag', text: s })))
              : null,
          ),
          h('div', { class: 'mm-sa-score' },
            h('p', { class: 'mm-sa-eyebrow', text: 'Your sleep score' }),
            scoreRing(report.overall_sleep_score),
            h('p', { class: 'mm-sa-score__band', text: report.score_band }),
            report.previous_overall_sleep_score != null ? deltaChip(report) : null,
          ),
        ),
      ),
    ),

    /* ---------------- Category scores ---------------- */
    h('section', { class: 'mm-sa-section', style: { paddingTop: '0' } },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide' },
          h('div', { class: 'mm-sa-cats' }, CATEGORIES.map((c) => categoryCard(c, report, lowest))),
          h('p', { class: 'mm-sa-cats__note', text: 'These scores are designed to help identify areas worth improving and are not a medical assessment. They reflect the answers you gave today.' }),
        ),
      ),
    ),

    /* ---------------- Biggest opportunity ---------------- */
    h('section', { class: 'mm-sa-section mm-sa-section--tint' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide mm-sa-opp' },
          h('div', {},
            h('p', { class: 'mm-sa-eyebrow', text: 'Your biggest opportunity' }),
            h('h2', { class: 'mm-sa-display mm-sa-opp__title', text: report.primary_opportunity, style: { marginTop: '12px' } }),
            h('p', { class: 'mm-sa-opp__score', style: { marginTop: '18px' } }, h('b', { text: String(scoreFor(report, lowest)) }), h('span', { text: '/ 100 today' })),
          ),
          h('p', { class: 'mm-sa-opp__text', text: report.primary_opportunity_explanation }),
        ),
      ),
    ),

    /* ---------------- Top three recommendations ---------------- */
    h('section', { class: 'mm-sa-section' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide' },
          h('div', { class: 'mm-sa-section__head' },
            h('p', { class: 'mm-sa-eyebrow', text: 'Your top three recommendations' }),
            h('h2', { class: 'mm-sa-display mm-sa-h2', text: 'Start with these.' }),
            h('p', { class: 'mm-sa-lead', text: 'Ranked by how much difference they are likely to make given what you told us. One at a time is plenty.' }),
          ),
          h('div', { class: 'mm-sa-recs' }, report.recommendations.map((r) => recommendationCard(r, addedRecommendationIds.has(r.id), onRecommendationToggle))),
        ),
      ),
    ),

    /* ---------------- Tonight ---------------- */
    h('section', { class: 'mm-sa-section mm-sa-section--white' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide' },
          h('div', { class: 'mm-sa-section__head' },
            h('p', { class: 'mm-sa-eyebrow', text: 'Tonight' }),
            h('h2', { class: 'mm-sa-display mm-sa-h2', text: 'Your plan for tonight' }),
          ),
          h('div', { class: 'mm-sa-tonight' },
            h('ol', { class: 'mm-sa-timeline' }, report.tonight_plan.map(timelineItem)),
            h('div', { class: 'mm-sa-tonight__aside' },
              h('div', { class: 'mm-sa-note' },
                h('h4', { text: 'Why these times' }),
                h('p', { text: `Everything is calculated back from the ${bedtimeLabel(report)} bedtime you told us about. If your bedtime shifts, shift the whole plan with it rather than dropping steps.` }),
              ),
              h('div', { class: 'mm-sa-note' },
                h('h4', { text: 'Your sleep window' }),
                h('p', { text: windowSentence(report) }),
              ),
              h('div', { class: 'mm-sa-note' },
                h('h4', { text: 'One change at a time' }),
                h('p', { text: 'You don’t need to do all of this perfectly tonight. Pick the step that feels easiest and repeat it for three nights before adding the next.' }),
              ),
            ),
          ),
        ),
      ),
    ),

    /* ---------------- 7-day reset ---------------- */
    h('section', { class: 'mm-sa-section mm-sa-section--sand' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide' },
          h('div', { class: 'mm-sa-section__head' },
            h('p', { class: 'mm-sa-eyebrow', text: 'The next seven days' }),
            h('h2', { class: 'mm-sa-display mm-sa-h2', text: 'Your 7-Day Sleep Reset' }),
            h('p', { class: 'mm-sa-lead', text: 'A gentle sequence that builds on itself. Each day adds one thing; nothing is dropped.' }),
            resetControl(resetStartedAt, onResetStart),
          ),
          h('ol', { class: 'mm-sa-days' }, report.seven_day_reset.map((d, i) => dayItem(d, i === report.seven_day_reset.length - 1, onRetake))),
        ),
      ),
    ),

    /* ---------------- Products ---------------- */
    h('section', { class: 'mm-sa-section' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide' },
          h('div', { class: 'mm-sa-section__head' },
            h('p', { class: 'mm-sa-eyebrow', text: 'From Muscle Mat' }),
            h('h2', { class: 'mm-sa-display mm-sa-h2', text: 'Your comfort recommendations' }),
            h('p', { class: 'mm-sa-lead', text: 'Based on what you told us, these may be relevant to your sleep setup.' }),
          ),
          report.products.length
            ? h('div', { class: `mm-sa-products ${report.products.length === 2 ? 'mm-sa-products--two' : report.products.length === 1 ? 'mm-sa-products--one' : ''}` },
                report.products.map((p) => productCard(p, products[p.product], onProductClick)))
            : h('p', { class: 'mm-sa-products__empty', text: `Nothing to add here${report.first_name ? `, ${report.first_name}` : ''}. Based on your answers, your comfort setup sounds like it is already working for you, so we would rather not suggest anything you don’t need.` }),
          h('p', { class: 'mm-sa-micro', style: { marginTop: '18px' }, text: 'Suggestions are based only on your answers. Prices shown are the current “from” price at the time this report was generated.' }),
        ),
      ),
    ),

    /* ---------------- Keep your report ---------------- */
    h('section', { class: 'mm-sa-section mm-sa-section--tint' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide', style: { display: 'flex', flexDirection: 'column', gap: '22px' } },
          h('p', { class: 'mm-sa-eyebrow', text: 'Keep your report' }),
          h('div', { class: 'mm-sa-saved' }, savedLine(report, syncState)),
          h('div', { class: 'mm-sa-actions' },
            h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--secondary', onclick: onPrint }, icon('print'), 'Save as PDF'),
            h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--secondary', onclick: onRetake }, icon('refresh'), 'Retake My Assessment'),
            h('a', { class: 'mm-sa-btn mm-sa-btn--ghost', href: config.brand.homeUrl }, 'Back to musclemat.com.au'),
          ),
        ),
      ),
    ),

    /* ---------------- Footer / disclaimers ---------------- */
    h('footer', { class: 'mm-sa-footer' },
      h('div', { class: 'mm-sa-container' },
        h('div', { class: 'mm-sa-wide mm-sa-footer__inner' },
          h('p', { text: 'This assessment is a general wellbeing tool based on the answers you provided. It is for educational purposes only and is not a medical assessment, diagnosis or treatment. Scores are not clinically validated. If you have ongoing difficulty sleeping, persistent pain, or any health concern, please speak with your GP or a qualified health professional.' }),
          h('p', { text: 'Product suggestions describe how a product may fit the preferences you told us about. They are not claims that any product treats or prevents a health condition.' }),
          h('p', {}, `© ${new Date().getFullYear()} Muscle Mat · `, h('a', { href: config.brand.privacyUrl, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), ` · Questions? ${config.brand.contactEmail}`),
        ),
      ),
    ),
  );

  // Animate ring and bars once painted.
  nextFrame().then(() => {
    const ring = el.querySelector('.mm-sa-ring .value');
    if (ring) ring.style.strokeDashoffset = ring.dataset.target;
    el.querySelectorAll('.mm-sa-cat__fill').forEach((bar) => { bar.style.width = bar.dataset.target; });
  });

  return { el, focus: () => el.querySelector('#mm-sa-report-title').focus({ preventScroll: true }) };
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */
function scoreRing(score) {
  const r = 58;
  const c = 2 * Math.PI * r;
  const target = c * (1 - score / 100);
  const ring = h('div', { class: 'mm-sa-ring', role: 'img', 'aria-label': `Sleep score ${score} out of 100` });
  const ticks = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const x1 = 66 + Math.cos(a) * 50, y1 = 66 + Math.sin(a) * 50;
    const x2 = 66 + Math.cos(a) * 52.5, y2 = 66 + Math.sin(a) * 52.5;
    return `<line class="tick" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  }).join('');
  ring.innerHTML = `<svg viewBox="0 0 132 132" aria-hidden="true">
      <circle class="track" cx="66" cy="66" r="${r}"/>
      ${ticks}
      <circle class="value" cx="66" cy="66" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(prefersReducedMotion() ? target : c).toFixed(2)}" data-target="${target.toFixed(2)}"/>
    </svg>`;
  ring.append(h('div', { class: 'mm-sa-ring__center' }, h('span', { class: 'mm-sa-ring__num', text: String(score) }), h('span', { class: 'mm-sa-ring__of', text: '/ 100' })));
  return ring;
}

function deltaChip(report) {
  const change = report.score_change;
  const text = change === 0 ? 'No change' : `${change > 0 ? '+' : '−'}${Math.abs(change)}`;
  return h('p', { class: 'mm-sa-score__delta' }, h('strong', { text: text }), h('span', { text: `since your last assessment (${report.previous_overall_sleep_score})` }));
}

function scoreFor(report, category) {
  return { routine: report.routine_score, environment: report.environment_score, comfort: report.comfort_score, winddown: report.winddown_score }[category];
}

function categoryCard(category, report, lowest) {
  const score = scoreFor(report, category.key);
  const prev = report.previous_category_scores ? report.previous_category_scores[category.key] : null;
  return h('div', { class: `mm-sa-cat ${category.key === lowest ? 'mm-sa-cat--lowest' : ''}` },
    h('div', { class: 'mm-sa-cat__row' },
      h('span', { class: 'mm-sa-cat__name', text: category.label }),
      h('span', { class: 'mm-sa-cat__score' }, String(score), h('small', { text: '/ 100' })),
    ),
    h('div', { class: 'mm-sa-cat__bar', role: 'img', 'aria-label': `${category.label} ${score} out of 100` },
      h('div', { class: 'mm-sa-cat__fill', style: { width: prefersReducedMotion() ? `${score}%` : '0%' }, dataset: { target: `${score}%` } }),
    ),
    h('p', { class: 'mm-sa-cat__desc', text: category.description }),
    prev != null ? h('p', { class: 'mm-sa-cat__prev', text: `Last time: ${prev}` }) : null,
  );
}

const CATEGORY_LABEL = { routine: 'Routine', environment: 'Environment', comfort: 'Comfort', winddown: 'Wind-down' };

function recommendationCard(rec, added, onToggle) {
  const toggle = h('button', { type: 'button', class: 'mm-sa-rec__done', 'aria-pressed': String(added), onclick: () => onToggle(rec, toggle) },
    h('span', { class: 'mm-sa-check__box', style: added ? { background: 'var(--mm-navy)', borderColor: 'var(--mm-navy)' } : null }, icon('check')),
    h('span', { text: added ? 'Added to my plan' : 'Add to my plan' }),
  );
  if (added) toggle.querySelector('svg').style.opacity = '1';
  return h('article', { class: 'mm-sa-rec' },
    h('span', { class: 'mm-sa-rec__n', text: String(rec.priority).padStart(2, '0') }),
    h('span', { class: 'mm-sa-rec__cat', text: CATEGORY_LABEL[rec.category] }),
    h('h3', { class: 'mm-sa-rec__title', text: rec.title }),
    h('p', { class: 'mm-sa-rec__reason', text: rec.reason }),
    h('div', { class: 'mm-sa-rec__try' }, h('b', { text: 'Try this' }), h('p', { text: rec.action })),
    rec.note ? h('p', { class: 'mm-sa-rec__note', text: rec.note }) : null,
    h('div', { class: 'mm-sa-rec__actions' }, toggle),
  );
}

function timelineItem(step) {
  return h('li', { class: `mm-sa-tl ${step.key === 'bed' ? 'mm-sa-tl--bed' : ''}` },
    h('div', { class: 'mm-sa-tl__time' }, step.timeLabel, step.isTomorrow ? h('small', { text: 'Tomorrow' }) : null),
    h('div', { class: 'mm-sa-tl__body' }, h('p', { class: 'mm-sa-tl__title', text: step.title }), h('p', { class: 'mm-sa-tl__detail', text: step.detail })),
  );
}

function dayItem(day, isLast, onRetake) {
  return h('li', { class: `mm-sa-day ${isLast ? 'mm-sa-day--wide' : ''}` },
    h('div', { class: 'mm-sa-day__n' }, h('small', { text: 'Day' }), String(day.day)),
    h('div', {},
      h('h3', { class: 'mm-sa-day__title', text: day.title }),
      h('p', { class: 'mm-sa-day__body', text: day.body }),
      day.isReassess
        ? h('div', { class: 'mm-sa-day__cta' },
            h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--primary', onclick: onRetake }, 'Retake My Assessment', icon('arrowRight')),
            h('span', { class: 'mm-sa-small', text: 'Your new score will be compared with today’s.' }),
          )
        : null,
    ),
  );
}

function resetControl(startedAt, onStart) {
  if (startedAt) {
    return h('p', { class: 'mm-sa-small', text: `You started your reset on ${formatDate(startedAt)}. Day 1 was that night.` });
  }
  const btn = h('button', { type: 'button', class: 'mm-sa-btn mm-sa-btn--primary', onclick: () => onStart(btn) }, 'Start my 7-Day Reset tonight', icon('arrowRight'));
  return h('div', { class: 'mm-sa-actions' }, btn);
}

function productCard(pick, product, onClick) {
  if (!product) return null;
  const img = withImageFallback(h('img', { src: product.image, alt: product.title, loading: 'lazy' }));
  return h('article', { class: 'mm-sa-product' },
    h('a', { class: 'mm-sa-product__media', href: product.url, target: '_blank', rel: 'noopener', tabindex: '-1', 'aria-hidden': 'true', onclick: () => onClick(product, 'image') }, img),
    h('div', { class: 'mm-sa-product__body' },
      h('h3', { class: 'mm-sa-product__title', text: product.title }),
      product.priceFrom != null ? h('p', { class: 'mm-sa-product__price', text: `From ${formatPrice(product.priceFrom, product.currency)}` }) : null,
      h('p', { class: 'mm-sa-product__why', text: pick.why }),
      product.facts && product.facts.length ? h('ul', { class: 'mm-sa-product__facts' }, product.facts.map((f) => h('li', { text: f }))) : null,
      h('div', { class: 'mm-sa-product__cta' },
        h('a', { class: 'mm-sa-btn mm-sa-btn--secondary', href: product.url, target: '_blank', rel: 'noopener', onclick: () => onClick(product, 'cta') }, product.cta, icon('arrowRight')),
      ),
    ),
  );
}

function savedLine(report, syncState) {
  const email = report.email;
  if (!email) return h('span', { text: 'Your report is saved on this device. Save a PDF copy below if you would like to keep it.' });
  if (syncState && syncState.server) return h('span', {}, 'A copy of this report is on its way to ', h('strong', { text: email }), '. It is also saved on this device.');
  return h('span', {}, 'Your report is saved on this device under ', h('strong', { text: email }), '. Save a PDF copy below if you would like to keep it.');
}

function bedtimeLabel(report) {
  const raw = report.raw_answers && report.raw_answers.usual_bedtime;
  const m = parseTime(raw);
  return m == null ? 'usual' : formatTime(m);
}

function windowSentence(report) {
  const bed = parseTime(report.raw_answers && report.raw_answers.usual_bedtime);
  const wake = parseTime(report.raw_answers && report.raw_answers.usual_wake_time);
  const window = sleepWindowMinutes(bed, wake);
  if (window == null) return 'We could not work out your sleep window from your bedtime and wake time.';
  return `About ${formatDurationProse(window)} in bed between ${formatTime(bed)} and ${formatTime(wake)}. Time in bed is an opportunity for sleep, not a measure of it, so treat it as the upper limit of what you are getting.`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}
