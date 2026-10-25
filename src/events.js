import { addDoc, updateDoc, deleteDoc } from './db.js';
import { doc, serverTimestamp } from 'firebase/firestore';
import { $, esc, msg, todayStr, shortDate } from './utils.js';
import { state, on } from './state.js';
import { showPage } from './nav.js';
import { notify } from './notifications.js';
import { requireLeader } from './roles.js';
import { deleteWithUndo } from './trash.js';

let editingEventId = null, selectedIds = [];

/* ---------- selectors (also used by home.js) ---------- */
const sortKey = e => (e.date || '') + ' ' + (e.time || '');
export const upcoming = () => state.events.filter(e => e.date >= todayStr()).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
export const past = () => state.events.filter(e => e.date < todayStr()).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
export const songsFor = ev => (ev.songIds || []).map(id => state.songs.find(s => s.id === id)).filter(Boolean);

/* ---------- song picker + setlist order ---------- */
export function renderPicker() {
  const t = $('pickerSearch').value.toLowerCase().trim();
  const list = state.songs.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '')).filter(s => !t || (s.title || '').toLowerCase().includes(t));
  $('picker').innerHTML = !state.songs.length ? `<div class="empty" style="padding:20px">No songs yet. Add some on the Songs page first.</div>`
    : !list.length ? `<div class="empty" style="padding:20px">No matches.</div>`
    : list.map(s => `<label><input type="checkbox" ${selectedIds.includes(s.id) ? 'checked' : ''} data-action="toggleSong" data-id="${esc(s.id)}" /><span>${esc(s.title)} <span class="key">${esc(s.key)}</span></span></label>`).join('');
}

export function toggleSong(id, on) {
  if (on && !selectedIds.includes(id)) selectedIds.push(id);
  else if (!on) selectedIds = selectedIds.filter(x => x !== id);
  renderSetOrder();
}

export function renderSetOrder() {
  selectedIds = selectedIds.filter(id => state.songs.some(s => s.id === id));
  $('setCount').textContent = selectedIds.length ? `(${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''})` : '';
  $('setOrder').innerHTML = !selectedIds.length ? `<p class="mu">Tick songs above and they will appear here. Use the arrows to set the order.</p>`
    : selectedIds.map((id, i) => `<div class="ord"><span class="n">${i + 1}.</span><span class="nm">${esc(state.songs.find(x => x.id === id).title)}</span>
      <button class="btn b-pri sm" ${i === 0 ? 'disabled' : ''} data-action="moveSong" data-id="${i}" data-arg="-1" aria-label="Move up">▲</button>
      <button class="btn b-pri sm" ${i === selectedIds.length - 1 ? 'disabled' : ''} data-action="moveSong" data-id="${i}" data-arg="1" aria-label="Move down">▼</button>
      <button class="btn b-no sm" data-action="unpick" data-id="${esc(id)}" aria-label="Remove">✕</button></div>`).join('');
}

export function moveSong(i, d) {
  i = Number(i); d = Number(d);
  const j = i + d; if (j < 0 || j >= selectedIds.length) return;
  [selectedIds[i], selectedIds[j]] = [selectedIds[j], selectedIds[i]];
  renderSetOrder();
}

export function unpick(id) {
  selectedIds = selectedIds.filter(x => x !== id);
  renderPicker(); renderSetOrder();
}

/* ---------- CRUD ---------- */
async function saveEvent() {
  if (!requireLeader()) return;
  const date = $('eDate').value, venue = $('eVenue').value.trim();
  if (!date || !venue) return msg($('eventFb'), '⚠️ Please enter a date and a venue.');
  const data = {
    name: $('eName').value.trim(), date, time: $('eTime').value, venue,
    dressCode: $('eDress').value.trim(), notes: $('eNotes').value.trim(),
    songIds: selectedIds.slice()
  };
  try {
    const wasEdit = !!editingEventId;
    if (wasEdit) await updateDoc(doc(state.eventsCol, editingEventId), data);
    else { data.created = serverTimestamp(); await addDoc(state.eventsCol, data); }
    notify(`${wasEdit ? '✏️ Event updated' : '📅 New event'}: ${data.name || venue} • ${shortDate(date)}${data.time ? ' @' + data.time + 'hrs' : ''}`, 'event');
    clearEventForm(); msg($('eventFb'), `✅ "${data.name || venue}" ${wasEdit ? 'updated' : 'added'}!`, true, 3000);
  } catch (e) { msg($('eventFb'), '⚠️ Save failed: ' + e.message); }
}

export function editEvent(id) {
  if (!requireLeader()) return;
  const ev = state.events.find(e => e.id === id); if (!ev) return;
  showPage('events'); editingEventId = id;
  $('eName').value = ev.name || ''; $('eDate').value = ev.date || ''; $('eTime').value = ev.time || '';
  $('eVenue').value = ev.venue || ''; $('eDress').value = ev.dressCode || ''; $('eNotes').value = ev.notes || '';
  selectedIds = (ev.songIds || []).slice(); $('pickerSearch').value = '';
  $('eventFormTitle').textContent = '✏️ Edit Event'; $('saveEventBtn').textContent = '🔄 Update Event';
  $('cancelEventBtn').classList.remove('hidden');
  msg($('eventFb'), `✏️ Editing "${ev.name || ev.venue}"`, true);
  renderPicker(); renderSetOrder(); $('eventFormCard').scrollIntoView({ behavior: 'smooth' });
}

export async function deleteEvent(id) {
  if (!requireLeader()) return;
  const ev = state.events.find(e => e.id === id); if (!ev) return;
  if (!confirm(`Delete "${ev.name || ev.venue}" on ${shortDate(ev.date)}? Your songs will not be affected.\n\nYou can restore it from Settings → Recently deleted.`)) return;
  try { await deleteWithUndo('event', ev, ev.name || ev.venue, () => deleteDoc(doc(state.eventsCol, id))); } catch (e) { return alert('Delete failed: ' + e.message); }
  notify(`🗑️ Event removed: ${ev.name || ev.venue} • ${shortDate(ev.date)}`, 'event');
  if (editingEventId === id) clearEventForm();
}

// copy an old event (same venue, dress code, notes and setlist) into the form as a NEW event
export function copyEvent(id) {
  if (!requireLeader()) return;
  const ev = state.events.find(e => e.id === id); if (!ev) return;
  showPage('events'); clearEventForm();
  $('eName').value = ev.name || ''; $('eTime').value = ev.time || ''; $('eVenue').value = ev.venue || '';
  $('eDress').value = ev.dressCode || ''; $('eNotes').value = ev.notes || '';
  selectedIds = (ev.songIds || []).slice();
  msg($('eventFb'), '📋 Copied. Pick the new date, then save.', true);
  renderPicker(); renderSetOrder(); $('eventFormCard').scrollIntoView({ behavior: 'smooth' });
  $('eDate').focus();
}

export function clearEventForm() {
  ['eName', 'eDate', 'eTime', 'eVenue', 'eDress', 'eNotes', 'pickerSearch'].forEach(i => $(i).value = '');
  selectedIds = []; editingEventId = null;
  $('eventFormTitle').textContent = '➕ Add Event'; $('saveEventBtn').textContent = '💾 Save Event';
  $('cancelEventBtn').classList.add('hidden'); $('eventFb').textContent = '';
  renderPicker(); renderSetOrder();
}

/* ---------- lists ---------- */
function eventRow(ev, isPast) {
  const n = (ev.songIds || []).length;
  const sub = [shortDate(ev.date), ev.time, ev.venue].filter(Boolean).map(esc).join(' • ');
  const id = esc(ev.id);
  return `<div class="erow ${isPast ? 'past' : ''}"><div><div class="et">${esc(ev.name || ev.venue)}</div><div class="es">${sub} • ${n} song${n !== 1 ? 's' : ''}</div></div>
    <div class="acts">${n ? `<button class="btn b-dk sm" data-action="stageEvent" data-id="${id}">🎤 Stage</button>` : ''}<button class="btn b-dk sm" data-action="shareItem" data-id="event|${id}">📲 Share</button><button class="btn b-dk sm" data-action="calItem" data-id="event|${id}">📆</button><button class="btn b-dk sm" data-action="copyEvent" data-id="${id}">📋 Copy</button><button class="btn b-pri sm" data-action="editEvent" data-id="${id}">✏️ Edit</button><button class="btn b-no sm" data-action="deleteEvent" data-id="${id}">🗑️</button></div></div>`;
}

export function renderEvents() {
  const u = upcoming(), p = past();
  $('upcomingList').innerHTML = u.length ? u.map(e => eventRow(e, false)).join('') : '<p class="mu">No upcoming events.</p>';
  $('pastList').innerHTML = p.length ? p.map(e => eventRow(e, true)).join('') : '<p class="mu">No past events yet.</p>';
}

export function initEvents() {
  $('pickerSearch').oninput = renderPicker;
  $('saveEventBtn').onclick = saveEvent;
  $('cancelEventBtn').onclick = clearEventForm;

  // songs changed -> picker, setlist order and event rows (they show song counts)
  on('songs', () => { renderPicker(); renderSetOrder(); renderEvents(); });
  on('events', renderEvents);
  on('signedOut', clearEventForm);
}
