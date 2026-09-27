/**
 * Tiny DOM helpers. No framework: the assessment must drop into a Shopify
 * theme without a build step, so we keep rendering explicit and dependency-free.
 *
 * `h()` never uses innerHTML for dynamic content — customer-provided text
 * (their name, email) is always set through textContent. The `html` prop is
 * reserved for the static SVG icons declared in this file.
 */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value; // trusted static markup only
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  check: `<svg viewBox="0 0 16 16" ${STROKE} stroke-width="2.2" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>`,
  chevronUp: `<svg viewBox="0 0 16 16" ${STROKE} aria-hidden="true"><path d="M3 10l5-5 5 5"/></svg>`,
  chevronDown: `<svg viewBox="0 0 16 16" ${STROKE} aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>`,
  arrowRight: `<svg viewBox="0 0 16 16" ${STROKE} aria-hidden="true"><path d="M2.5 8h11M9 3.5L13.5 8 9 12.5"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 16 16" ${STROKE} aria-hidden="true"><path d="M13.5 8h-11M7 3.5L2.5 8 7 12.5"/></svg>`,
  print: `<svg viewBox="0 0 16 16" ${STROKE} aria-hidden="true"><path d="M4 6V2.5h8V6M4 12H2.5V7h11v5H12M4.5 9.5h7v4h-7z"/></svg>`,
  refresh: `<svg viewBox="0 0 16 16" ${STROKE} aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/></svg>`,
  // Restrained line pictograms for sleeping position (viewBox 44×28).
  pos_side: `<svg viewBox="0 0 44 28" ${STROKE} aria-hidden="true"><path d="M3 24h38"/><circle cx="10" cy="14.5" r="3.4"/><path d="M14.5 17.5c4.5-2.4 8.5-2.8 12.5-1.2l4.2 1.7c1.6.7 3.3.7 5 0M27 16.3l3.4 4.7"/></svg>`,
  pos_back: `<svg viewBox="0 0 44 28" ${STROKE} aria-hidden="true"><path d="M3 24h38"/><circle cx="10" cy="14" r="3.4"/><path d="M14.5 17h20.5M35 17v-4.5"/></svg>`,
  pos_stomach: `<svg viewBox="0 0 44 28" ${STROKE} aria-hidden="true"><path d="M3 24h38"/><circle cx="10" cy="17.5" r="3.4"/><path d="M14.5 18.5h21M35.5 18.5l2.5-3"/></svg>`,
  pos_combination: `<svg viewBox="0 0 44 28" ${STROKE} aria-hidden="true"><path d="M3 24h38"/><path d="M28.5 9.5a7 7 0 1 0 1.2 6.3"/><path d="M29.7 5.5v4.4h-4.4"/></svg>`,
  pos_not_sure: `<svg viewBox="0 0 44 28" ${STROKE} aria-hidden="true"><path d="M3 24h38"/><circle cx="22" cy="12" r="7.5"/><path d="M19.6 9.8a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4"/><path d="M22 16.6v.4"/></svg>`,
};

export function icon(name, className = '') {
  const span = h('span', { class: className || undefined, 'aria-hidden': 'true' });
  span.innerHTML = ICONS[name] || '';
  return span;
}

/** requestAnimationFrame twice — lets the browser paint before a transition starts. */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Attach a graceful fallback when a remote image fails (CDN blocked, offline). */
export function withImageFallback(img, onBroken) {
  img.addEventListener('error', () => {
    img.setAttribute('data-broken', '');
    if (typeof onBroken === 'function') onBroken(img);
  }, { once: true });
  return img;
}
