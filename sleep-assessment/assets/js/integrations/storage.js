/**
 * Local persistence (localStorage).
 *
 *  - progress: answers + current step so a customer who leaves mid-way can resume
 *  - history:  completed reports, newest first, so a retake can be compared with
 *              the original score (the "compare original vs new" feature)
 *
 * Everything is wrapped in try/catch: private browsing and blocked storage must
 * never break the assessment.
 */

const KEY_PROGRESS = 'mm_sleep_assessment_progress_v1';
const KEY_HISTORY = 'mm_sleep_assessment_history_v1';
const MAX_HISTORY = 10;

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function remove(key) {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export function saveProgress(answers, step) {
  return write(KEY_PROGRESS, { answers, step, saved_at: new Date().toISOString() });
}

export function loadProgress() {
  const data = read(KEY_PROGRESS);
  if (!data || !data.answers) return null;
  // Progress older than 7 days is discarded.
  if (Date.now() - Date.parse(data.saved_at || 0) > 7 * 24 * 3600 * 1000) { remove(KEY_PROGRESS); return null; }
  return data;
}

export function clearProgress() {
  remove(KEY_PROGRESS);
}

export function saveReport(report) {
  const history = getHistory().filter((r) => r.assessment_id !== report.assessment_id);
  history.unshift(report);
  return write(KEY_HISTORY, history.slice(0, MAX_HISTORY));
}

export function getHistory() {
  const data = read(KEY_HISTORY);
  return Array.isArray(data) ? data : [];
}

export function getLatestReport() {
  return getHistory()[0] || null;
}

export function clearHistory() {
  remove(KEY_HISTORY);
}
