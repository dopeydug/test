/**
 * Analytics adapter.
 *
 * Emits the assessment's events through whatever the host page already uses:
 *   - window.dataLayer (Google Tag Manager convention) — always, when enabled
 *   - Klaviyo onsite tracking (window.klaviyo) — for the milestone events
 *   - Shopify custom pixels (Shopify.analytics.publish) — when present
 *
 * Event names are fixed constants so GTM triggers can be built against them.
 */

import { getConfig } from '../data/config.js';

export const EVENTS = Object.freeze({
  STARTED: 'sleep_assessment_started',
  QUESTION_COMPLETED: 'sleep_assessment_question_completed',
  COMPLETED: 'sleep_assessment_completed',
  REPORT_VIEWED: 'sleep_report_viewed',
  RECOMMENDATION_CLICKED: 'sleep_recommendation_clicked',
  PRODUCT_CLICKED: 'sleep_product_clicked',
  RESET_STARTED: 'sleep_reset_started',
});

/** Events worth mirroring into Klaviyo as onsite "Active on Site"-style metrics. */
const KLAVIYO_MIRRORED = new Set([EVENTS.STARTED, EVENTS.COMPLETED, EVENTS.REPORT_VIEWED, EVENTS.PRODUCT_CLICKED]);

export function track(event, params = {}) {
  const config = getConfig();
  const payload = { event, event_category: 'sleep_assessment', ...params, timestamp: new Date().toISOString() };

  if (config.analytics.dataLayer && typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  }

  if (typeof window !== 'undefined' && window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
    try { window.Shopify.analytics.publish(event, params); } catch { /* non-fatal */ }
  }

  if (config.klaviyo.clientTracking && KLAVIYO_MIRRORED.has(event) && typeof window !== 'undefined' && window.klaviyo) {
    try { window.klaviyo.push(['track', humanise(event), params]); } catch { /* non-fatal */ }
  }

  if (config.analytics.debug && typeof console !== 'undefined') {
    console.debug('[sleep-assessment]', event, params);
  }
  return payload;
}

function humanise(event) {
  return event.replace(/^sleep_/, 'Sleep ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
