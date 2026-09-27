/**
 * EXAMPLE secure endpoint for the Sleep Assessment → Klaviyo sync.
 *
 * Deploy this as a Shopify App Proxy route (/apps/sleep-assessment/submit),
 * a Cloudflare Worker, Vercel/Netlify function or a small Node service. The
 * browser POSTs the payload produced by integrations/klaviyo.js
 * (buildServerPayload); this handler is the ONLY place the private key lives.
 *
 *   KLAVIYO_PRIVATE_API_KEY   pk_xxx  (Klaviyo → Settings → API keys; needs
 *                             profiles:write, events:write, subscriptions:write)
 *   KLAVIYO_LIST_ID           optional default list for opted-in subscribers
 *
 * What it does, in order:
 *   1. Validates the payload (email, assessment id, scores).
 *   2. Upserts the profile with the custom properties ("Sleep Score", …).
 *   3. Creates the "Sleep Assessment Completed" event — a Klaviyo flow
 *      triggered by this metric sends the emailed report using
 *      event.properties (tonight_plan, seven_day_reset, recommendation_details).
 *   4. Subscribes to the list ONLY when marketing_consent is true, recording
 *      the consent timestamp and source.
 *
 * This file is a reference implementation and is not wired into the frontend
 * until config.endpoints.submit points at it.
 */

const KLAVIYO_API = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

export async function handleSleepAssessmentSubmit(request, env = process.env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const apiKey = env.KLAVIYO_PRIVATE_API_KEY;
  if (!apiKey) return json({ error: 'Server not configured' }, 500);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const problem = validate(payload);
  if (problem) return json({ error: problem }, 422);

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    'Content-Type': 'application/json',
    revision: KLAVIYO_REVISION,
  };

  // TODO: verify the request origin / Shopify app-proxy signature before trusting it.
  // TODO: rate-limit by IP and de-duplicate by payload.assessment_id.

  // 2) Profile upsert with custom properties
  const profileRes = await fetch(`${KLAVIYO_API}/profile-import/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        type: 'profile',
        attributes: {
          email: payload.email,
          first_name: payload.first_name || undefined,
          properties: payload.klaviyo_properties,
        },
      },
    }),
  });
  if (!profileRes.ok) return json({ error: 'Profile sync failed', detail: await safeText(profileRes) }, 502);

  // 3) Event
  const ev = payload.klaviyo_event;
  const eventRes = await fetch(`${KLAVIYO_API}/events/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          properties: ev.properties,
          time: ev.time,
          value: ev.value,
          unique_id: ev.unique_id,
          metric: { data: { type: 'metric', attributes: { name: ev.metric } } },
          profile: { data: { type: 'profile', attributes: { email: payload.email, first_name: payload.first_name || undefined } } },
        },
      },
    }),
  });
  if (!eventRes.ok) return json({ error: 'Event sync failed', detail: await safeText(eventRes) }, 502);

  // 4) Consent-gated list subscription
  const listId = payload.list_id || env.KLAVIYO_LIST_ID;
  if (payload.marketing_consent === true && listId) {
    const subRes = await fetch(`${KLAVIYO_API}/profile-subscription-bulk-create-jobs/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          type: 'profile-subscription-bulk-create-job',
          attributes: {
            custom_source: 'Sleep Assessment',
            profiles: {
              data: [{
                type: 'profile',
                attributes: {
                  email: payload.email,
                  subscriptions: {
                    email: { marketing: { consent: 'SUBSCRIBED', consented_at: payload.consent_timestamp || new Date().toISOString() } },
                  },
                },
              }],
            },
          },
          relationships: { list: { data: { type: 'list', id: listId } } },
        },
      }),
    });
    if (!subRes.ok) return json({ error: 'Subscription failed', detail: await safeText(subRes) }, 502);
  }

  // TODO (optional): persist `payload.report` (e.g. to a database or Shopify
  // customer metafield) so the report can be re-opened from a link in the email.

  return json({ ok: true, assessment_id: payload.assessment_id });
}

function validate(p) {
  if (!p || typeof p !== 'object') return 'Empty payload';
  if (typeof p.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) return 'A valid email is required';
  if (typeof p.assessment_id !== 'string' || p.assessment_id.length < 8) return 'assessment_id missing';
  if (!p.klaviyo_properties || typeof p.klaviyo_properties['Sleep Score'] !== 'number') return 'Scores missing';
  if (!p.klaviyo_event || p.klaviyo_event.metric !== 'Sleep Assessment Completed') return 'Event missing';
  return null;
}

async function safeText(res) { try { return (await res.text()).slice(0, 500); } catch { return ''; } }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/* Node 18+/22 standalone server, for local testing:
 *   KLAVIYO_PRIVATE_API_KEY=pk_... node server/klaviyo-sync.example.mjs
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { createServer } = await import('node:http');
  createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const response = await handleSleepAssessmentSubmit(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  }).listen(8787, () => console.log('Sleep assessment sync listening on :8787'));
}
