import { $, esc, longDate, countdown, todayStr } from './utils.js';
import { state, on } from './state.js';
import { upcoming, songsFor } from './events.js';
import { practicesUpcoming } from './practice.js';
import { rsvpHtml } from './rsvp.js';
import { communityHtml } from './community.js';
import { upcomingBirthdays } from './stats.js';

/* "Practice today @14:30hrs" strip at the very top */
function todayBanner() {
  const t = todayStr();
  const items = [
    ...state.practices.filter(p => p.date === t).map(p => ({ label: 'Practice', time: p.time, venue: p.venue })),
    ...state.events.filter(e => e.date === t).map(e => ({ label: e.name || 'Event', time: e.time, venue: e.venue }))
  ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  return items.map(i => `<div class="today">📌 ${esc(i.label)} today${i.time ? ' @' + esc(i.time) + 'hrs' : ''} • ${esc(i.venue)}</div>`).join('');
}

function birthdayBlock() {
  const b = upcomingBirthdays(7); if (!b.length) return '';
  return `<div class="card bday"><h2 style="font-size:1.2rem">🎂 Birthdays</h2>${b.map(x => {
    const first = (x.m.name || '').split(' ')[0];
    const when = x.diff === 0 ? '<strong>today! 🎉</strong>' : x.diff === 1 ? 'tomorrow' : 'on ' + esc(x.date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' }));
    return `<div>${esc(first)}${x.m.part ? ' <span class="key">' + esc(x.m.part) + '</span>' : ''} – ${when}</div>`;
  }).join('')}</div>`;
}

function performanceBlock() {
  const next = upcoming()[0];
  const group = state.group, songs = state.songs, events = state.events;
  if (!next) {
    const fresh = !songs.length && !events.length && !state.practices.length;
    return `<div class="card"><div class="empty"><span class="ic">${fresh ? '👋' : '📅'}</span>
      <p><strong>${fresh ? 'Welcome, ' + esc(group.name || 'your group') + '!' : 'No upcoming performances'}</strong></p>
      <p>${fresh ? 'Your group is brand new. Start by adding your songs, then plan an event.' : ''}</p>
      ${fresh ? `<button class="btn b-ok" data-action="showPage" data-id="songs">➕ Add songs</button>` : ''}
      <button class="btn ${fresh ? 'b-pri' : 'b-ok'}" data-action="showPage" data-id="events">➕ Add an event</button></div></div>`;
  }
  const list = songsFor(next), id = esc(next.id);
  const setlist = list.length ? list.map((s, i) => `
    <div class="sl ${s.audioBase64 ? 'hk' : ''}" data-action="viewSong" data-id="${esc(s.id)}"><div class="num">${i + 1}</div>
      <div class="info"><span class="ttl">${esc(s.title)}</span><span class="key">${esc(s.key)}</span></div>
      ${s.audioBase64 ? `<button class="btn b-pri sm" data-action="playAudio" data-id="${esc(s.id)}">▶️ Play Key</button>` : ''}
      <span class="lnk">Lyrics →</span></div>`).join('')
    : `<div class="empty"><span class="ic">🎶</span><p>No songs picked for this event yet.</p><button class="btn b-pri" data-action="editEvent" data-id="${id}">✏️ Add songs</button></div>`;
  return `
    <div class="next"><span class="cd">${countdown(next.date)}</span>
      <h2>${esc(next.name || next.venue)}</h2>
      <div class="when">${esc(longDate(next.date))}${next.time ? ' at ' + esc(next.time) : ''}</div>
      <div class="det"><div><span>📍 Venue</span><strong>${esc(next.venue)}</strong></div>
        ${next.time ? `<div><span>🕒 Time</span><strong>${esc(next.time)}</strong></div>` : ''}
        ${next.dressCode ? `<div><span>👔 Dress code</span><strong>${esc(next.dressCode)}</strong></div>` : ''}</div>
      ${next.notes ? `<div class="enotes">📝 ${esc(next.notes)}</div>` : ''}</div>
    <div class="card">${rsvpHtml('event', next)}</div>
    <div class="card"><h2>🎶 Songs for this event <span class="mu" style="font-size:1rem;font-family:'Segoe UI',sans-serif">${list.length} song${list.length !== 1 ? 's' : ''}</span></h2>
      ${setlist}
      <div class="acts mt">${list.length ? `<button class="btn b-ok sm" data-action="stageEvent" data-id="${id}">🎤 Stage mode</button>` : ''}
        <button class="btn b-dk sm" data-action="shareItem" data-id="event|${id}">📲 Share to WhatsApp</button>
        <button class="btn b-dk sm" data-action="calItem" data-id="event|${id}">📆 Add to calendar</button>
        ${list.length ? `<button class="btn b-dk sm" data-action="printEvent" data-id="${id}">🖨️ Print setlist</button>` : ''}
        <button class="btn b-dk sm" data-action="editEvent" data-id="${id}">✏️ Edit this event</button></div></div>`;
}

function practiceBlock() {
  const p = practicesUpcoming()[0];
  if (!p) return '';
  const rem = (p.reminders || '').split('\n').map(x => x.trim()).filter(Boolean), id = esc(p.id);
  return `<div class="card"><span class="cd">${countdown(p.date)}</span>
    <h2>🎤 Next practice${p.name ? ': ' + esc(p.name) : ''}</h2>
    <p class="mu">${esc(longDate(p.date))}${p.time ? ' at ' + esc(p.time) : ''} • 📍 ${esc(p.venue)}</p>
    ${rem.length ? `<div class="notes"><strong>🔔 Reminders:</strong><ul style="margin:6px 0 0 20px">${rem.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
    ${p.preNotes ? `<div class="notes"><strong>📝 Before practice:</strong><br />${esc(p.preNotes).replace(/\n/g, '<br />')}</div>` : ''}
    ${rsvpHtml('practice', p)}
    <div class="acts mt"><button class="btn b-dk sm" data-action="viewPractice" data-id="${id}">👁️ View details</button>
      <button class="btn b-dk sm" data-action="shareItem" data-id="practice|${id}">📲 Share to WhatsApp</button>
      <button class="btn b-dk sm" data-action="calItem" data-id="practice|${id}">📆 Add to calendar</button></div></div>`;
}

export function renderHome() {
  $('homeContent').innerHTML = todayBanner() + communityHtml() + birthdayBlock() + performanceBlock() + practiceBlock();
}

export function initHome() {
  ['group', 'songs', 'events', 'practices', 'members', 'polls', 'me'].forEach(e => on(e, renderHome));
}
