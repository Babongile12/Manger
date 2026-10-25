// WhatsApp sharing, add-to-calendar (.ics), printable setlist, and backups/exports.
import { $, esc, msg, longDate, shortDate } from './utils.js';
import { state } from './state.js';
import { songsFor } from './events.js';
import { recordedPractices } from './stats.js';

const pad = n => String(n).padStart(2, '0');

function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const find = arg => { const [kind, id] = (arg || '').split('|'); return { kind, item: (kind === 'practice' ? state.practices : state.events).find(x => x.id === id) }; };

/* ---------- WhatsApp ---------- */
function textFor(kind, it) {
  const g = state.group.name || 'Our group', t = it.time ? ' @' + it.time + 'hrs' : '';
  if (kind === 'practice') {
    const rem = (it.reminders || '').split('\n').map(x => x.trim()).filter(Boolean);
    return [`🎤 *${g} – ${it.name || 'Practice'}*`, `📅 ${longDate(it.date)}${t}`, `📍 ${it.venue}`,
      rem.length ? '\n🔔 Remember:\n' + rem.map(r => '• ' + r).join('\n') : '', it.preNotes ? '\n📝 ' + it.preNotes : ''].filter(Boolean).join('\n');
  }
  const songs = songsFor(it);
  return [`📅 *${g} – ${it.name || it.venue}*`, `🗓️ ${longDate(it.date)}${t}`, `📍 ${it.venue}`, it.dressCode ? `👔 ${it.dressCode}` : '', it.notes ? `📝 ${it.notes}` : '',
    songs.length ? '\n🎶 Setlist:\n' + songs.map((s, i) => `${i + 1}. ${s.title}${s.key && s.key !== 'N/A' ? ' (' + s.key + ')' : ''}`).join('\n') : ''].filter(Boolean).join('\n');
}
export function shareItem(arg) {
  const { kind, item } = find(arg); if (!item) return;
  window.open('https://wa.me/?text=' + encodeURIComponent(textFor(kind, item)), '_blank', 'noopener');
}

/* ---------- calendar (.ics) ---------- */
const esc2 = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const day = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
const fold = l => { const out = []; while (l.length > 73) { out.push(l.slice(0, 73)); l = ' ' + l.slice(73); } out.push(l); return out.join('\r\n'); };

export function buildIcs(kind, it) {
  const [y, m, d] = it.date.split('-').map(Number), title = kind === 'practice' ? (it.name || 'Practice') : (it.name || it.venue);
  const desc = kind === 'practice' ? [(it.reminders || ''), it.preNotes || ''].filter(Boolean).join('\n\n')
    : [it.notes || '', songsFor(it).length ? 'Setlist:\n' + songsFor(it).map((s, i) => `${i + 1}. ${s.title}`).join('\n') : ''].filter(Boolean).join('\n\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Manger//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${kind}-${it.id}@manger`, 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'];
  if (it.time) {
    const [h, mi] = it.time.split(':').map(Number), s = new Date(y, m - 1, d, h, mi), e = new Date(y, m - 1, d, h, mi + 120);
    L.push(`DTSTART:${day(s)}T${pad(s.getHours())}${pad(s.getMinutes())}00`, `DTEND:${day(e)}T${pad(e.getHours())}${pad(e.getMinutes())}00`);
  } else {
    const n = new Date(y, m - 1, d + 1);
    L.push(`DTSTART;VALUE=DATE:${day(new Date(y, m - 1, d))}`, `DTEND;VALUE=DATE:${day(n)}`);
  }
  L.push('SUMMARY:' + esc2((state.group.name ? state.group.name + ' – ' : '') + title), 'LOCATION:' + esc2(it.venue));
  if (desc) L.push('DESCRIPTION:' + esc2(desc));
  L.push('BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
export function calItem(arg) {
  const { kind, item } = find(arg); if (!item) return;
  download(`manger-${kind}-${item.date}.ics`, buildIcs(kind, item), 'text/calendar');
}

/* ---------- print setlist (Save as PDF from the print dialog) ---------- */
export function printEvent(id) {
  const ev = state.events.find(e => e.id === id); if (!ev) return;
  const songs = songsFor(ev), w = window.open('', '_blank'); if (!w) return alert('Please allow pop-ups to print.');
  w.document.write(`<!doctype html><title>Setlist</title><body style="font-family:Georgia,serif;max-width:700px;margin:30px auto">
    <h1>${esc(state.group.name || '')}</h1><h2>${esc(ev.name || ev.venue)}</h2>
    <p>${esc(longDate(ev.date))}${ev.time ? ' at ' + esc(ev.time) : ''}<br>📍 ${esc(ev.venue)}${ev.dressCode ? '<br>👔 ' + esc(ev.dressCode) : ''}</p>
    ${ev.notes ? '<p><em>' + esc(ev.notes) + '</em></p>' : ''}
    <ol style="font-size:1.3rem;line-height:1.8">${songs.map(s => `<li>${esc(s.title)} ${s.key && s.key !== 'N/A' ? '<small>(' + esc(s.key) + ')</small>' : ''}</li>`).join('')}</ol></body>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

/* ---------- backup + CSV ---------- */
const plain = v => Array.isArray(v) ? v.map(plain)
  : (v && typeof v === 'object') ? (typeof v.toMillis === 'function' ? new Date(v.toMillis()).toISOString() : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])))
  : v;
export function exportBackup() {
  const data = { app: 'Manger', exportedAt: new Date().toISOString(), group: plain({ ...state.group, leaderPin: undefined }),
    songs: plain(state.songs), events: plain(state.events), practices: plain(state.practices), members: plain(state.members) };
  download(`manger-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
}

const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function csvAttendance() {
  const rec = recordedPractices(), ms = state.members.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const head = ['Name', 'Part', 'Phone', 'Email', 'Birthday', ...rec.map(p => p.date), 'Attended', 'Practices recorded', 'Percent'];
  const rows = ms.map(m => {
    const marks = rec.map(p => (p.presentIds || []).includes(m.id) ? 'Y' : ''), n = marks.filter(Boolean).length;
    return [m.name, m.part, m.phone, m.email, m.birthday, ...marks, n, rec.length, rec.length ? Math.round(n / rec.length * 100) + '%' : ''];
  });
  return [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
}
export const exportCsv = () => download(`manger-members-attendance-${new Date().toISOString().slice(0, 10)}.csv`, csvAttendance(), 'text/csv');
