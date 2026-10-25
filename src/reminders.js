// "Practice today @14:30hrs" style reminders.
// Fires once per device per item: the day before ("tomorrow") and on the day ("today").
// This runs while the app is open. Reminders when the app is closed come with the phone app
// (local notifications), using exactly this same data.
import { state, on } from './state.js';
import { todayStr, tomorrowStr } from './utils.js';
import { store, toast, sysNotify } from './notifications.js';
import { upcomingBirthdays } from './stats.js';

export function checkReminders() {
  if (!state.currentUid) return;
  const t = todayStr(), tm = tomorrowStr(), now = new Date();
  const items = [
    ...state.events.map(e => ({ k: 'event', id: e.id, label: e.name || 'Event', date: e.date, time: e.time })),
    ...state.practices.map(p => ({ k: 'practice', id: p.id, label: 'Practice', date: p.date, time: p.time }))
  ];
  for (const it of items) {
    const when = it.date === t ? 'today' : it.date === tm ? 'tomorrow' : null;
    if (!when) continue;
    if (when === 'today' && it.time) {                       // don't remind about something that ended hours ago
      const [h, m] = it.time.split(':').map(Number), at = new Date();
      at.setHours(h, m, 0, 0);
      if (now - at > 2 * 3600 * 1000) continue;
    }
    const key = `manger_rem_${state.currentUid}_${it.k}_${it.id}_${it.date}_${when}`;
    if (store.get(key)) continue;
    store.set(key, '1');
    const text = `${it.label} ${when}${it.time ? ' @' + it.time + 'hrs' : ''}`;
    toast('🔔 ' + text);
    sysNotify('Manger', text);
  }
}

function checkBirthdays() {
  if (!state.currentUid) return;
  upcomingBirthdays(0).forEach(({ m }) => {
    const key = `manger_bday_${state.currentUid}_${m.id}_${todayStr()}`;
    if (store.get(key)) return; store.set(key, '1');
    const text = `Today is ${(m.name || '').split(' ')[0]}'s birthday!`;
    toast('🎂 ' + text); sysNotify('Manger', text);
  });
}

export function initReminders() {
  on('members', checkBirthdays);
  on('events', checkReminders);
  on('practices', checkReminders);
  setInterval(checkReminders, 60 * 1000);
}
