/**
 * Muscle Mat product catalogue used by the Sleep Assessment.
 *
 * Every entry below is a REAL product taken from the Muscle Mat Shopify store
 * (handle, title, image and "from" price as at build time). Nothing here is
 * invented. `facts` are lifted from the store's own product copy and are kept
 * descriptive — the assessment never makes treatment or medical claims.
 *
 * In the Shopify theme integration the Liquid section injects live product
 * data (title, price, image, URL, availability) into `window.MM_SLEEP_CONFIG`
 * and these entries are used only as a fallback, so prices never go stale.
 */

export const STORE_URL = 'https://www.musclemat.com.au';

export const PRODUCTS = Object.freeze({
  topper: {
    id: 'topper',
    handle: 'luxury-mattress-topper',
    title: 'Muscle Mat Luxury Mattress Topper',
    shortTitle: '10cm Mattress Topper',
    url: `${STORE_URL}/products/luxury-mattress-topper`,
    image: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/products/Mat-Topper-7.jpg?v=1617705994',
    priceFrom: 139,
    currency: 'AUD',
    facts: ['10cm plush comfort layer', 'Deep 40cm skirt fits like a fitted sheet', 'Cotton cover'],
    cta: 'Explore the Mattress Topper',
  },
  pillow: {
    id: 'pillow',
    handle: 'pillow',
    title: 'Muscle Mat Adjustable Pillow',
    shortTitle: 'Adjustable Pillow',
    url: `${STORE_URL}/products/pillow`,
    image: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/products/MM-Pillow-2.jpg?v=1650459143',
    priceFrom: 99,
    currency: 'AUD',
    facts: ['Two height pads and a high/low curve: eight combinations', 'Suits side, back and front sleepers'],
    cta: 'Explore the Adjustable Pillow',
  },
  duvet: {
    id: 'duvet',
    handle: 'duvet',
    title: 'Muscle Mat All Season Duvet',
    shortTitle: 'All Season Duvet',
    url: `${STORE_URL}/products/duvet`,
    image: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/files/Untitled_design_26.png?v=1749435243',
    priceFrom: 149,
    currency: 'AUD',
    facts: ['Breathable, temperature-regulating materials', '100% cotton outer'],
    cta: 'Explore the All Season Duvet',
  },
  sheets: {
    id: 'sheets',
    handle: 'casa-cotton-fitted-sheet',
    title: 'Casa Cotton Fitted Sheet',
    shortTitle: 'Casa Cotton Sheets',
    url: `${STORE_URL}/products/casa-cotton-fitted-sheet`,
    image: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/files/8_e631b9fa-9e89-477a-bb19-4e50ead994ce.png?v=1787844529',
    priceFrom: 75,
    currency: 'AUD',
    facts: ['Cotton fitted sheet', 'Six colours, Single to Super King'],
    cta: 'Explore Casa Cotton Sheets',
  },
  acupressure_mat: {
    id: 'acupressure_mat',
    handle: 'musclemat',
    title: 'Muscle Mat Acupressure Mat With Pillow',
    shortTitle: 'Acupressure Mat',
    url: `${STORE_URL}/products/musclemat`,
    image: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/files/MuscleMat-LR-24.jpg?v=1770092803',
    priceFrom: 68.95,
    currency: 'AUD',
    facts: ['6,210 acupressure points', 'Designed for a 20-minute lie-down', 'Pillow included'],
    cta: 'Explore the Muscle Mat',
  },
  relax_mat: {
    id: 'relax_mat',
    handle: 'relax-mat',
    title: 'Relax Mat',
    shortTitle: 'Relax Mat',
    url: `${STORE_URL}/products/relax-mat`,
    image: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/files/RelaxMat-1224-41.png?v=1772412397',
    priceFrom: 169,
    currency: 'AUD',
    facts: ['35mm of dense, slow-rebound foam', 'Soft, spill and stain resistant cover'],
    cta: 'Explore the Relax Mat',
  },
  alpine_blanket: {
    id: 'alpine_blanket',
    handle: 'designer-blanket',
    title: 'The Alpine Blanket',
    shortTitle: 'Alpine Blanket',
    url: `${STORE_URL}/products/designer-blanket`,
    image: 'https://cdn.shopify.com/s/files/1/0348/8327/2836/files/21.png?v=1779368702',
    priceFrom: 169,
    currency: 'AUD',
    facts: ['Small and Large sizes', 'Oat, Grey and Charcoal'],
    cta: 'Explore the Alpine Blanket',
  },
});

/** Merge live product data (from the theme) over the static catalogue. */
export function resolveProducts(overrides = {}) {
  const merged = {};
  for (const [id, product] of Object.entries(PRODUCTS)) {
    merged[id] = { ...product, ...(overrides[id] || {}) };
  }
  return merged;
}

/** "$139" / "$68.95" — whole dollars stay whole. */
export function formatPrice(amount, currency = 'AUD') {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  const n = Number(amount);
  const formatted = Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
  return currency === 'AUD' ? `$${formatted}` : `${formatted} ${currency}`;
}
