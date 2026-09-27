/**
 * Runtime configuration.
 *
 * Defaults live here; the Shopify theme section (or any host page) can override
 * any of them by defining `window.MM_SLEEP_CONFIG` BEFORE the app script loads.
 * No secrets belong in this file or in that global — private Klaviyo keys must
 * only ever live on the server behind `endpoints.submit`.
 */

export const DEFAULT_CONFIG = Object.freeze({
  brand: {
    name: 'Muscle Mat',
    homeUrl: 'https://www.musclemat.com.au',
    // "No arm, black writing, transparent back" logo from the Muscle Mat brand kit.
    // The theme integration swaps this for the theme's own logo setting.
    logoUrl: 'https://d3k81ch9hvuctc.cloudfront.net/company/KtqqGU/images/2bb9ba36-9d64-4af2-9798-602b231b3c63.png',
    logoAlt: 'Muscle Mat',
    privacyUrl: 'https://www.musclemat.com.au/policies/privacy-policy',
    contactEmail: 'info@musclemat.com.au',
    // Editorial hero image (brand photography from the Muscle Mat store).
    heroImageUrl: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/products/Mat-Topper-7.jpg?v=1617705994',
    heroImageAlt: 'A made bed with the Muscle Mat Luxury Mattress Topper',
  },
  endpoints: {
    // TODO (integration): point this at a secure server-side endpoint that
    // receives the assessment payload and talks to Klaviyo with a PRIVATE key.
    // Suggested: a Shopify App Proxy route such as '/apps/sleep-assessment/submit'
    // or a serverless function. See /server/klaviyo-sync.example.mjs.
    submit: null,
  },
  klaviyo: {
    // Uses the Klaviyo onsite object (window.klaviyo) already installed on the
    // Muscle Mat theme via the Klaviyo app embed. Public-key tracking only.
    clientTracking: true,
    // Optional: Klaviyo list ID for opted-in subscribers (handled server-side).
    listId: null,
  },
  analytics: {
    dataLayer: true, // push events to window.dataLayer (GTM convention)
    debug: false,
  },
  ui: {
    autoAdvanceDelayMs: 260,
    transitionMs: 260,
    generatingDurationMs: 2800,
  },
  /** Live product overrides keyed by product id — see data/products.js. */
  products: {},
});

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function mergeConfig(base, override) {
  if (!isObject(override)) return { ...base };
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isObject(v) && isObject(base[k]) ? mergeConfig(base[k], v) : v;
  }
  return out;
}

let cached = null;
export function getConfig() {
  if (cached) return cached;
  const override = typeof window !== 'undefined' ? window.MM_SLEEP_CONFIG : undefined;
  cached = mergeConfig(DEFAULT_CONFIG, override);
  return cached;
}
