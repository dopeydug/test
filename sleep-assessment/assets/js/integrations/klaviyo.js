/**
 * Klaviyo integration abstraction.
 *
 * SECURITY MODEL
 * - The browser only ever uses Klaviyo's PUBLIC onsite object (window.klaviyo),
 *   which the Muscle Mat theme already loads through the Klaviyo app embed.
 * - Anything that needs a PRIVATE API key (profile import with custom
 *   properties, list subscription with consent, server events) is sent to a
 *   secure server-side endpoint (`config.endpoints.submit`) which holds the key.
 *   See /server/klaviyo-sync.example.mjs for the endpoint contract.
 * - Nothing in this file, in config.js or in the Liquid section contains a key.
 */

import { getConfig } from '../data/config.js';
import { toKlaviyoProperties, toKlaviyoEvent } from '../engine/report.js';

/**
 * Sync a completed assessment to Klaviyo.
 * Resolves with { client: boolean, server: boolean, errors: string[] }.
 * Never throws — the report UI must render whether or not the sync succeeds.
 */
export async function syncSleepAssessmentToKlaviyo(report, options = {}) {
  const config = options.config || getConfig();
  const result = { client: false, server: false, errors: [] };

  // 1) Client-side onsite identify + track (public key, already on the page).
  if (config.klaviyo.clientTracking && typeof window !== 'undefined' && window.klaviyo && report.email) {
    try {
      const properties = toKlaviyoProperties(report);
      window.klaviyo.push(['identify', {
        $email: report.email,
        $first_name: report.first_name || undefined,
        ...properties,
      }]);
      const event = toKlaviyoEvent(report);
      window.klaviyo.push(['track', event.metric, { ...event.properties, $value: event.value }]);
      result.client = true;
    } catch (err) {
      result.errors.push(`client: ${err && err.message ? err.message : err}`);
    }
  }

  // 2) Server-side sync (private key lives on the server).
  //    TODO (integration): deploy the endpoint and set config.endpoints.submit.
  if (config.endpoints.submit) {
    try {
      const response = await fetch(config.endpoints.submit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildServerPayload(report, config)),
        keepalive: true,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result.server = true;
    } catch (err) {
      result.errors.push(`server: ${err && err.message ? err.message : err}`);
    }
  }

  return result;
}

/**
 * The exact JSON the secure endpoint receives. The server is responsible for:
 *   - creating/updating the Klaviyo profile with `klaviyo_properties`
 *   - creating the "Sleep Assessment Completed" event
 *   - subscribing the profile to `list_id` ONLY when `marketing_consent` is true
 *   - triggering the emailed report (a Klaviyo flow keyed off the event)
 */
export function buildServerPayload(report, config = getConfig()) {
  return {
    source: 'sleep_assessment_web',
    report_version: report.report_version,
    assessment_id: report.assessment_id,
    email: report.email,
    first_name: report.first_name,
    marketing_consent: report.marketing_consent,
    consent_timestamp: report.marketing_consent ? report.assessment_completed_at : null,
    consent_source: typeof location !== 'undefined' ? location.href : 'sleep_assessment',
    list_id: config.klaviyo.listId || null,
    klaviyo_properties: toKlaviyoProperties(report),
    klaviyo_event: toKlaviyoEvent(report),
    report, // full result object for the email report template / storage
  };
}
