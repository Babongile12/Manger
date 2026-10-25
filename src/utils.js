export const $ = id => document.getElementById(id);

export const esc = s => s == null ? '' : String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function msg(el, text, ok, ms) {
  el.style.color = ok ? '#2E7D32' : '#C62828';
  el.textContent = text;
  if (ms) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, ms);
}

/* ---------- DATES ---------- */
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const todayStr = () => ymd(new Date());
export const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };
export const parseDate = s => {
  const [y, m, d] = (s || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmt = (s, o) => s ? parseDate(s).toLocaleDateString('en-ZA', o) : '';
export const longDate = s => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const shortDate = s => fmt(s, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export function countdown(s) {
  const n = Math.round((parseDate(s) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days';
}

/* Only ever allow http(s) links (blocks javascript: and friends). Returns '' if not usable. */
export function safeUrl(u) {
  u = (u || '').trim(); if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; } catch { return ''; }
}
