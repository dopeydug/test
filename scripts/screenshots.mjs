/**
 * Visual QA: walks through the assessment at phone / tablet / desktop widths,
 * captures screenshots into ./screenshots and fails on any console error.
 *
 *   npm run dev   (in one terminal)
 *   npm run screenshots
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.OUT_DIR || 'screenshots';
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 1 },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const errors = [];
let failed = false;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[${vp.name}] console: ${msg.text()}`); });
  page.on('pageerror', (err) => { errors.push(`[${vp.name}] pageerror: ${err.message}`); failed = true; });
  const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${vp.name}-${name}.png`, fullPage: true, ...opts });

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await shot('01-intro');

  await page.getByRole('button', { name: /Start My Sleep Assessment/ }).click();
  await page.waitForSelector('#q-first_name-input');
  await shot('02-q01-name', { fullPage: false });
  await page.fill('#q-first_name-input', 'Jess');
  await page.getByRole('button', { name: /^Continue/ }).click();

  // Q2 goal (auto-advance)
  await page.waitForSelector('[data-value="fall_asleep"]');
  await shot('03-q02-goal');
  await page.click('[data-value="fall_asleep"]');

  // Q3 bedtime: preset 10:30pm
  await page.waitForSelector('[data-preset="22:30"]');
  await shot('04-q03-bedtime', { fullPage: false });
  await page.click('[data-preset="22:30"]');
  await page.getByRole('button', { name: /^Continue/ }).click();

  // Q4 wake
  await page.waitForSelector('[data-preset="06:30"]');
  await page.click('[data-preset="06:30"]');
  await shot('05-q04-wake', { fullPage: false });
  await page.getByRole('button', { name: /^Continue/ }).click();

  const singles = [
    ['sleep_onset', '20_40'], ['night_wakings', 'once'],
  ];
  for (const [, v] of singles) { await page.waitForSelector(`[data-value="${v}"]`); await page.click(`[data-value="${v}"]`); }

  // Q7 refresh scale
  await page.waitForSelector('.mm-sa-scale__cell[data-value="6"]');
  await page.click('.mm-sa-scale__cell[data-value="6"]');
  await shot('06-q07-scale', { fullPage: false });
  await page.getByRole('button', { name: /^Continue/ }).click();

  await page.waitForSelector('[data-value="too_hot"]'); await page.click('[data-value="too_hot"]');
  await page.waitForSelector('[data-value="combination"]'); await shot('07-q09-position'); await page.click('[data-value="combination"]');

  await page.waitForSelector('.mm-sa-scale__cell[data-value="7"]'); await page.click('.mm-sa-scale__cell[data-value="7"]');
  await page.getByRole('button', { name: /^Continue/ }).click();

  // Q11 discomfort multi
  await page.waitForSelector('[data-value="none"]');
  await page.click('[data-value="hips"]'); await page.click('[data-value="shoulders"]'); await page.click('[data-value="none"]');
  await shot('08-q11-discomfort');
  await page.getByRole('button', { name: /^Continue/ }).click();

  await page.waitForSelector('[data-value="2pm_4pm"]'); await page.click('[data-value="2pm_4pm"]');
  await page.waitForSelector('[data-value="30_60"]'); await page.click('[data-value="30_60"]');
  await page.waitForSelector('[data-value="within_60"]'); await page.click('[data-value="within_60"]');

  // Q15 disturbances optional
  await page.waitForSelector('[data-value="nothing"]');
  await page.click('[data-value="temperature"]');
  await shot('09-q15-disturbances');
  await page.getByRole('button', { name: /See my report/ }).click();

  await page.waitForSelector('#mm-sa-email');
  await shot('10-email');
  await page.fill('#mm-sa-email', 'jess@example.com');
  await page.getByRole('button', { name: /Show My Sleep Report/ }).click();
  await page.waitForSelector('.mm-sa-generating');
  await page.waitForTimeout(900);
  await shot('11-generating', { fullPage: false });
  await page.waitForSelector('#mm-sa-report-title', { timeout: 15000 });
  await page.waitForTimeout(1600);
  await shot('12-results');

  // Horizontal overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) { errors.push(`[${vp.name}] horizontal overflow of ${overflow}px on results`); failed = true; }

  // Demo variants
  for (const demo of ['good', 'poor']) {
    await page.goto(`${BASE}/?demo=${demo}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#mm-sa-report-title');
    await page.waitForTimeout(1500);
    await shot(`13-results-${demo}`);
  }
  await context.close();
}

await browser.close();
if (errors.length) { console.error(errors.join('\n')); }
console.log(failed ? 'FAILED' : 'OK', `— screenshots in ${OUT}/`);
process.exit(failed ? 1 : 0);
