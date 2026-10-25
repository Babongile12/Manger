import { addDoc, updateDoc, deleteDoc } from './db.js';
import { doc, serverTimestamp } from 'firebase/firestore';
import { $, esc, msg, todayStr, shortDate, longDate } from './utils.js';
import { state, on } from './state.js';
import { showPage } from './nav.js';
import { notify } from './notifications.js';
import { sortedMembers } from './members.js';
import { requireLeader } from './roles.js';
import { deleteWithUndo } from './trash.js';
import { rsvpHtml } from './rsvp.js';

let editingId = null, present = [], viewingPracticeId = null;

/* ---------- selectors (also used by home.js / reminders) ---------- */
const sortKey = p => (p.date || '') + ' ' + (p.time || '');
export const practicesUpcoming = () => state.practices.filter(p => p.date >= todayStr()).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
export const practicesPast = () => state.practices.filter(p => p.date < todayStr()).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
const presentCount = p => (p.presentIds || []).filter(id => state.members.some(m => m.id === id)).length;
const lines = t => (t || '').split('\n').map(x => x.trim()).filter(Boolean);
const when = (date, time) => shortDate(date) + (time ? ' @' + time + 'hrs' : '');

/* ---------- attendance picker (inside the form) ---------- */
export function renderAttendance() {
  present = present.filter(id => state.members.some(m => m.id === id));
  const list = sortedMembers();
  $('attCount').textContent = list.length ? `(${present.length} of ${list.length} present)` : '';
  $('attList').innerHTML = !list.length
    ? `<div class="empty" style="padding:20px"><p>No members yet.</p><button class="btn b-pri sm" data-action="showPage" data-id="members">👥 Add members</button></div>`
    : list.map(m => `<label><input type="checkbox" ${present.includes(m.id) ? 'checked' : ''} data-action="togglePresent" data-id="${esc(m.id)}" /><span>${esc(m.name)} ${m.part ? `<span class="key">${esc(m.part)}</span>` : ''}</span></label>`).join('');
}

export function togglePresent(id, on) {
  if (on && !present.includes(id)) present.push(id);
  else if (!on) present = present.filter(x => x !== id);
  renderAttendance();
}

/* ---------- CRUD ---------- */
async function savePractice() {
  if (!requireLeader()) return;
  const date = $('pDate').value, venue = $('pVenue').value.trim();
  if (!date || !venue) return msg($('practiceFb'), '⚠️ Please enter a date and a venue.');
  const data = {
    name: $('pName').value.trim(), date, time: $('pTime').value, venue,
    preNotes: $('pPre').value.trim(), postNotes: $('pPost').value.trim(), reminders: $('pRemind').value.trim(),
    nextDate: $('pNextDate').value, nextTime: $('pNextTime').value,
    presentIds: present.filter(id => state.members.some(m => m.id === id))
  };
  try {
    const wasEdit = !!editingId;
    if (wasEdit) await updateDoc(doc(state.practicesCol, editingId), data);
    else { data.created = serverTimestamp(); await addDoc(state.practicesCol, data); }
    notify(`${wasEdit ? '✏️ Practice updated' : '🎤 New practice'}: ${when(date, data.time)} • ${venue}`, 'practice');
    clearPracticeForm(); msg($('practiceFb'), `✅ Practice ${wasEdit ? 'updated' : 'added'}!`, true, 3000);
  } catch (e) { msg($('practiceFb'), '⚠️ Save failed: ' + e.message); }
}

export function editPractice(id) {
  if (!requireLeader()) return;
  const p = state.practices.find(x => x.id === id); if (!p) return;
  closePracticeModal(); showPage('practice'); editingId = id;
  $('pName').value = p.name || ''; $('pDate').value = p.date || ''; $('pTime').value = p.time || ''; $('pVenue').value = p.venue || '';
  $('pPre').value = p.preNotes || ''; $('pPost').value = p.postNotes || ''; $('pRemind').value = p.reminders || '';
  $('pNextDate').value = p.nextDate || ''; $('pNextTime').value = p.nextTime || '';
  present = (p.presentIds || []).slice();
  $('practiceFormTitle').textContent = '✏️ Edit Practice'; $('savePracticeBtn').textContent = '🔄 Update Practice';
  $('cancelPracticeBtn').classList.remove('hidden');
  msg($('practiceFb'), `✏️ Editing practice on ${shortDate(p.date)}`, true);
  renderAttendance(); $('practiceFormCard').scrollIntoView({ behavior: 'smooth' });
}

export async function deletePractice(id) {
  if (!requireLeader()) return;
  const p = state.practices.find(x => x.id === id); if (!p) return;
  if (!confirm(`Delete the practice on ${shortDate(p.date)}? This also removes its notes and attendance.\n\nYou can restore it from Settings → Recently deleted.`)) return;
  try { await deleteWithUndo('practice', p, 'Practice ' + shortDate(p.date), () => deleteDoc(doc(state.practicesCol, id))); } catch (e) { return alert('Delete failed: ' + e.message); }
  notify(`🗑️ Practice removed: ${when(p.date, p.time)}`, 'practice');
  closePracticeModal();
  if (editingId === id) clearPracticeForm();
}

export function clearPracticeForm() {
  ['pName', 'pDate', 'pTime', 'pVenue', 'pPre', 'pPost', 'pRemind', 'pNextDate', 'pNextTime'].forEach(i => $(i).value = '');
  present = []; editingId = null;
  $('practiceFormTitle').textContent = '➕ Add Practice'; $('savePracticeBtn').textContent = '💾 Save Practice';
  $('cancelPracticeBtn').classList.add('hidden'); $('practiceFb').textContent = '';
  renderAttendance();
}

// "Schedule it" - start a new practice pre-filled from the previous practice's "next practice" fields
export function scheduleNext(id) {
  if (!requireLeader()) return;
  const p = state.practices.find(x => x.id === (id || viewingPracticeId)); if (!p || !p.nextDate) return;
  closePracticeModal(); showPage('practice'); clearPracticeForm();
  $('pName').value = p.name || ''; $('pDate').value = p.nextDate; $('pTime').value = p.nextTime || ''; $('pVenue').value = p.venue || '';
  msg($('practiceFb'), '➕ Scheduling the next practice. Adjust anything, then save.', true);
  $('practiceFormCard').scrollIntoView({ behavior: 'smooth' });
}

/* ---------- detail modal ---------- */
export function viewPractice(id) {
  const p = state.practices.find(x => x.id === id); if (!p) return;
  viewingPracticeId = id;
  $('prmTitle').textContent = p.name || 'Practice';
  $('prmMeta').textContent = longDate(p.date) + (p.time ? ' at ' + p.time : '') + ' • ' + p.venue;

  const rem = lines(p.reminders);
  $('prmRemBox').classList.toggle('hidden', !rem.length);
  $('prmRem').innerHTML = rem.map(r => `<li>${esc(r)}</li>`).join('');
  $('prmPreBox').classList.toggle('hidden', !p.preNotes); $('prmPre').textContent = p.preNotes || '';
  $('prmPostBox').classList.toggle('hidden', !p.postNotes); $('prmPost').textContent = p.postNotes || '';

  const ids = p.presentIds || [], ms = sortedMembers();
  const here = ms.filter(m => ids.includes(m.id)).map(m => m.name), away = ms.filter(m => !ids.includes(m.id)).map(m => m.name);
  $('prmAttBox').classList.toggle('hidden', !ms.length);
  $('prmAtt').textContent = `✅ Present (${here.length}): ${here.join(', ') || 'nobody marked yet'}\n❌ Not marked present (${away.length}): ${away.join(', ') || '—'}`;

  $('prmNextBox').classList.toggle('hidden', !p.nextDate);
  $('prmNext').textContent = p.nextDate ? '📆 Next practice: ' + longDate(p.nextDate) + (p.nextTime ? ' at ' + p.nextTime : '') : '';
  $('prmNextBtn').classList.toggle('hidden', !p.nextDate);
  $('prmRsvpBox').classList.toggle('hidden', p.date < todayStr()); $('prmRsvp').innerHTML = rsvpHtml('practice', p);
  $('prmShare').dataset.id = 'practice|' + id; $('prmCal').dataset.id = 'practice|' + id;

  $('practiceModal').classList.add('active'); document.body.style.overflow = 'hidden';
}
export function closePracticeModal() {
  $('practiceModal').classList.remove('active'); document.body.style.overflow = 'auto';
}

/* ---------- lists ---------- */
function practiceRow(p, isPast) {
  const total = state.members.length;
  const att = isPast && total ? ` • ${presentCount(p)}/${total} present` : '';
  const sub = [shortDate(p.date), p.time, p.venue].filter(Boolean).map(esc).join(' • ') + att;
  const id = esc(p.id);
  return `<div class="erow ${isPast ? 'past' : ''}"><div style="flex:1;min-width:0;cursor:pointer" data-action="viewPractice" data-id="${id}"><div class="et">${esc(p.name || 'Practice')}</div><div class="es">${sub}</div></div>
    <div class="acts"><button class="btn b-dk sm" data-action="viewPractice" data-id="${id}">👁️ View</button><button class="btn b-pri sm" data-action="editPractice" data-id="${id}">✏️ Edit</button><button class="btn b-no sm" data-action="deletePractice" data-id="${id}">🗑️</button></div></div>`;
}

export function renderPractices() {
  const u = practicesUpcoming(), p = practicesPast();
  $('practiceUpcoming').innerHTML = u.length ? u.map(x => practiceRow(x, false)).join('') : '<p class="mu">No upcoming practices.</p>';
  $('practicePast').innerHTML = p.length ? p.map(x => practiceRow(x, true)).join('') : '<p class="mu">No past practices yet.</p>';
}

export function initPractice() {
  $('savePracticeBtn').onclick = savePractice;
  $('cancelPracticeBtn').onclick = clearPracticeForm;
  $('attAll').onclick = () => { present = state.members.map(m => m.id); renderAttendance(); };
  $('attNone').onclick = () => { present = []; renderAttendance(); };

  $('prmClose').onclick = closePracticeModal;
  $('practiceModal').onclick = e => { if (e.target === $('practiceModal')) closePracticeModal(); };
  addEventListener('keydown', e => { if (e.key === 'Escape') closePracticeModal(); });
  $('prmEdit').onclick = () => { if (viewingPracticeId) editPractice(viewingPracticeId); };
  $('prmDelete').onclick = () => { if (viewingPracticeId) deletePractice(viewingPracticeId); };
  $('prmNextBtn').onclick = () => scheduleNext();

  const refreshModal = () => { if ($('practiceModal').classList.contains('active') && viewingPracticeId) viewPractice(viewingPracticeId); };
  on('practices', () => { renderPractices(); renderAttendance(); refreshModal(); });
  on('me', refreshModal);
  on('members', () => { renderAttendance(); renderPractices(); });
  on('signedOut', () => { clearPracticeForm(); closePracticeModal(); });
  renderAttendance();
}
