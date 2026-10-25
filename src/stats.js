// Numbers derived from data you already have: song usage, attendance, birthdays.
import { state } from './state.js';
import { todayStr } from './utils.js';

/* how often / when was a song last in a setlist (events up to and including today) */
export function songUsage(id) {
  const t = todayStr(); let count = 0, last = '';
  for (const e of state.events) if (e.date <= t && (e.songIds || []).includes(id)) { count++; if (e.date > last) last = e.date; }
  return { count, last };
}

/* practices where attendance was actually recorded (someone ticked present) */
export function recordedPractices() {
  const t = todayStr();
  return state.practices.filter(p => p.date <= t && (p.presentIds || []).some(id => state.members.some(m => m.id === id)))
    .sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
}

export function attendanceStats() {
  const rec = recordedPractices(), last3 = rec.slice(-3);
  return state.members.map(m => {
    const att = rec.filter(p => (p.presentIds || []).includes(m.id));
    return {
      m, attended: att.length, total: rec.length,
      pct: rec.length ? Math.round(att.length / rec.length * 100) : null,
      lastDate: att.length ? att[att.length - 1].date : '',
      missed3: last3.length === 3 && !last3.some(p => (p.presentIds || []).includes(m.id))
    };
  }).sort((a, b) => (a.m.name || '').localeCompare(b.m.name || ''));
}

/* birthdays today or within `days` (only day+month are used) */
export function upcomingBirthdays(days = 7) {
  const today = new Date(); today.setHours(0, 0, 0, 0); const out = [];
  for (const m of state.members) {
    if (!m.birthday) continue;
    const [, mo, da] = m.birthday.split('-').map(Number); if (!mo || !da) continue;
    let d = new Date(today.getFullYear(), mo - 1, da);
    if (d < today) d = new Date(today.getFullYear() + 1, mo - 1, da);
    const diff = Math.round((d - today) / 86400000);
    if (diff <= days) out.push({ m, diff, date: d });
  }
  return out.sort((a, b) => a.diff - b.diff);
}
