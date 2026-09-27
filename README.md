# Muscle Mat — Complimentary Personal Sleep Assessment

A premium, multi-step sleep assessment that produces a personalised sleep report:
a sleep score, four category scores, the customer's biggest opportunity, three
ranked recommendations, tonight's plan, a 7-Day Sleep Reset and restrained,
answer-driven product suggestions. Built to sit inside the Muscle Mat Shopify
theme (or run standalone) with a Klaviyo-ready data layer.

> **Positioning note.** This is a wellness/educational tool. Scores are
> deterministic but not clinically validated, and the copy never diagnoses or
> makes treatment claims. Disclaimers are built into the report.

## Brand sources used

Nothing here invents a visual identity. Everything was taken from Muscle Mat's
own systems:

| Element | Source |
| --- | --- |
| Palette `#333333 · #FFFAF5 · #2C365A · #EADACB · #96B5D1` | Muscle Mat brand kit (Klaviyo brand colours) |
| Logo (black writing, transparent) | Brand kit logo; theme header uses the same file |
| Typography: body **Mulish**, display/buttons **Assistant** (uppercase, tracked) | `assets/theme-global.css` in the live theme |
| Radius 12px, pill buttons, warm hairlines, 800px breakpoint, 1260px container | Theme settings (`border_radius`) and `.button` / `.buttonV2` |
| Announcement/section tint `#EADACB` with dark text | Theme editorial/advertorial templates |
| Product names, handles, images, "from" prices | Live Shopify catalogue (no fabricated products) |
| Consent wording | Muscle Mat privacy policy + existing single opt-in email lists |

## Project layout

```
sleep-assessment/
  index.html                      Standalone page (preview / hosting)
  assets/css/sleep-assessment.css Scoped styles (.mm-sa), print styles, brand tokens
  assets/js/app.js                Flow controller (intro → questions → email → generating → report)
  assets/js/data/questions.js     The 15 questions and stored keys
  assets/js/data/products.js      Real product catalogue (overridable with live data)
  assets/js/data/config.js        Runtime config (no secrets); host overrides via window.MM_SLEEP_CONFIG
  assets/js/engine/scoring.js     Deterministic scoring model (Routine 30 / Environment 20 / Comfort 25 / Wind-down 25)
  assets/js/engine/rules.js       Recommendation rule engine + biggest-opportunity copy
  assets/js/engine/productRules.js Product relevance rules
  assets/js/engine/schedule.js    Tonight's plan (wrap-around time arithmetic)
  assets/js/engine/reset.js       7-Day Sleep Reset
  assets/js/engine/report.js      Result object + Klaviyo property/event mapping
  assets/js/integrations/         analytics.js (dataLayer events), klaviyo.js (sync abstraction), storage.js
  assets/js/ui/                   DOM helpers, inputs (time picker, scale, choices), screens, results
shopify/
  sections/sleep-assessment.liquid  Theme section: injects live product data + config, no keys
  templates/page.sleep-assessment.json
server/klaviyo-sync.example.mjs   Reference secure endpoint (holds the private Klaviyo key)
scripts/build.mjs                 esbuild bundle → dist/ for the theme
scripts/screenshots.mjs           Playwright visual QA at 375 / 768 / 1440
tests/engine.test.mjs             Unit tests for scoring, rules, schedule, report
dist/                             Built bundle + CSS for Shopify
```

## Run locally

```bash
npm install
npm run dev          # http://127.0.0.1:4173
npm test             # engine unit tests (node --test)
npm run build        # dist/sleep-assessment.min.js + dist/sleep-assessment.css
npm run screenshots  # needs `npm run dev` running; writes ./screenshots
```

QA shortcuts: `/?demo=example`, `/?demo=good`, `/?demo=poor` render a report
instantly; `/#results` re-opens the last saved report on this device.

## Shopify installation

1. `npm run build`, then copy `dist/sleep-assessment.min.js` and
   `dist/sleep-assessment.css` into the theme's `assets/`.
2. Copy `shopify/sections/sleep-assessment.liquid` to `sections/` and
   `shopify/templates/page.sleep-assessment.json` to `templates/`.
3. In `layout/theme.liquid`, add `sleep-assessment` to the template suffixes
   that skip the store header/footer (next to `editorial` / `advertorial`) so
   the assessment's simplified header is the only navigation.
4. Create a page, assign the *Sleep Assessment* template, and (optionally) set
   the hero image, logo, submit endpoint and Klaviyo list ID in the section
   settings.

The section injects live product titles, prices, images and URLs into
`window.MM_SLEEP_CONFIG.products`, so the static catalogue is only a fallback.

## Scoring model (summary)

Each category is built from named parts with a maximum, so the logic is
transparent and tunable in one file (`engine/scoring.js`):

| Category | Parts |
| --- | --- |
| Routine (30%) | bedtime consistency 40 · sleep window 30 · caffeine timing vs bedtime 30 |
| Environment (20%) | temperature 40 · environmental interruptions 40 · night wakings 20 |
| Comfort (25%) | bed comfort rating 50 · physical discomfort 35 · thermal comfort 15 |
| Wind-down (25%) | pre-bed screens 35 · sleep onset 35 · stress 20 · evening regularity 10 |

Whole numbers, clamped to 10–96. Bands: Strong foundation ≥85 · Good
foundation ≥70 · Solid start ≥55 · Room to improve ≥40 · Time for a reset.

## Personalisation engine

`engine/rules.js` holds ~20 rules, each with trigger conditions, a base
priority, severity boosts, goal alignment, category, generated title/reason/
action copy, an optional related product and exclusions. All eligible rules
are ranked (weakest categories get a bonus), and the top three are selected
with at most two per category and no conflicting pairs. Guard-rails:

- no caffeine advice for non-caffeine drinkers
- no screen advice when screen use is already "almost none"
- no topper on comfort grounds when the bed is 10/10 with no discomfort
- earlier-bedtime and later-bedtime advice can never appear together

Products (`engine/productRules.js`) are chosen separately, capped at three,
each with a one-sentence "why" built from the answers. When nothing applies,
the report says so instead of showing products.

## Data & Klaviyo

`engine/report.js` produces one serialisable result object with every field
listed in the brief (answers as human-readable labels plus `raw_answers`,
scores, `primary_opportunity`, `recommendation_1..3`, `recommended_products`,
`assessment_completed_at`, previous-score fields for retake comparison, and the
full plan for an emailed report).

`integrations/klaviyo.js` → `syncSleepAssessmentToKlaviyo(report)`:

1. **Client-side (public key only):** identifies the profile and tracks
   *Sleep Assessment Completed* through the Klaviyo onsite object already
   installed on the theme (`window.klaviyo`).
2. **Server-side:** POSTs the payload to `config.endpoints.submit`. The
   reference handler in `server/klaviyo-sync.example.mjs` upserts the profile
   with custom properties (Sleep Score, Primary Sleep Goal, Primary Sleep
   Opportunity, Sleep Temperature, Sleep Position, Bed Comfort Score, Morning
   Refresh Score, Sleep Schedule Consistency, Sleep Discomfort Areas, Last
   Sleep Assessment Date, …), creates the event, and subscribes to a list
   **only** when the optional marketing box was ticked. The private key lives
   there and nowhere else.

The emailed report is intended to be a Klaviyo flow triggered by the event;
`event.properties` carries the summary, recommendations, tonight's plan and the
7-day reset so the template needs no extra lookups.

## Analytics events

Pushed to `window.dataLayer` (GTM convention), mirrored to Shopify custom
pixels when present, and milestone events to Klaviyo onsite:

`sleep_assessment_started` · `sleep_assessment_question_completed` ·
`sleep_assessment_completed` · `sleep_report_viewed` ·
`sleep_recommendation_clicked` · `sleep_product_clicked` · `sleep_reset_started`

First names and emails are never sent to analytics.

## Retake & comparison

Completed reports are stored locally (newest first). A retake carries the
previous `assessment_id` and scores into the new report (`score_change`,
`previous_category_scores`) and the results screen shows the delta. The same
fields are sent to Klaviyo, so a server-side history can be added without
changing the frontend.

## Accessibility & responsiveness

Radio/checkbox semantics on options, spinbutton time picker with arrow keys,
number-key shortcuts, visible focus states, `prefers-reduced-motion` support,
44px+ tap targets, sticky Back/Continue on mobile, no horizontal overflow at
375px, and a print stylesheet for "Save as PDF".
