import { addDoc, updateDoc, deleteDoc } from './db.js';
import { doc, serverTimestamp } from 'firebase/firestore';
import { $, esc, msg } from './utils.js';
import { state, on } from './state.js';
import { showPage } from './nav.js';
import { requireLeader } from './roles.js';
import { deleteWithUndo } from './trash.js';
import { attendanceStats } from './stats.js';
import { exportCsv } from './share.js';

export const PARTS = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Baritone', 'Instrumentalist', 'Conductor / Leader', 'Other'];

let editingId = null;

export const sortedMembers = () => state.members.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));

const bday = s => { const [, mo, da] = s.split('-').map(Number); return mo && da ? new Date(2000, mo - 1, da).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' }) : ''; };

/* ---------- attendance stats ---------- */
export function renderStats() {
  const rows = attendanceStats(), total = rows.length ? rows[0].total : 0;
  $('attStatsNote').textContent = total ? `Based on ${total} practice${total !== 1 ? 's' : ''} where attendance was recorded.` : 'No attendance recorded yet. Tick who was present when you save a practice.';
  $('attStats').innerHTML = !total ? '' : rows.map(r => `<div class="arow"><div class="an">${esc(r.m.name)}${r.m.part ? ` <span class="key">${esc(r.m.part)}</span>` : ''}${r.missed3 ? ' <span title="Missed the last 3 practices">⚠️</span>' : ''}</div>
    <div class="pbar"><i style="width:${r.pct}%;${r.pct < 60 ? 'background:#C62828' : ''}"></i></div><div class="mu">${r.attended}/${r.total} • ${r.pct}%${r.lastDate ? ' • last ' + esc(r.lastDate) : ''}</div></div>`).join('');
}

export function renderMembers() {
  renderStats();
  const t = $('memberSearch').value.toLowerCase().trim();
  const all = sortedMembers();
  const f = t ? all.filter(m => [m.name, m.part].some(v => (v || '').toLowerCase().includes(t))) : all;
  $('memberCount').textContent = all.length + ' member' + (all.length !== 1 ? 's' : '');

  // how many of each part
  const counts = {};
  all.forEach(m => { const p = m.part || 'No part set'; counts[p] = (counts[p] || 0) + 1; });
  $('partSummary').innerHTML = Object.entries(counts).map(([p, n]) => `<span class="key">${esc(p)} ${n}</span>`).join(' ');

  if (!f.length) {
    $('memberList').innerHTML = `<div class="empty"><span class="ic">👥</span><p>${all.length ? 'No matches.' : 'No members yet. Add your first one above!'}</p></div>`;
    return;
  }
  $('memberList').innerHTML = f.map(m => {
    const id = esc(m.id);
    const phone = m.phone ? `<a href="tel:${esc(String(m.phone).replace(/[^\d+]/g, ''))}">${esc(m.phone)}</a>` : '';
    const mail = m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : '';
    const contact = [phone, mail].filter(Boolean).join(' • ');
    return `<div class="item"><div class="top"><div><span class="ttl">${esc(m.name)}</span>${m.part ? `<span class="key">${esc(m.part)}</span>` : ''}</div>
      <div class="acts"><button class="btn b-pri sm" data-action="editMember" data-id="${id}">✏️ Edit</button>
      <button class="btn b-no sm" data-action="deleteMember" data-id="${id}">🗑️</button></div></div>
      ${contact ? `<div class="mu mt">${contact}</div>` : ''}
      ${m.birthday ? `<div class="mu mt">🎂 ${esc(bday(m.birthday))}</div>` : ''}
      ${m.notes ? `<div class="mu mt" style="white-space:pre-wrap">📝 ${esc(m.notes)}</div>` : ''}</div>`;
  }).join('');
}

async function saveMember() {
  if (!requireLeader()) return;
  const name = $('mbName').value.trim();
  if (!name) return msg($('mbFb'), '⚠️ Please enter the member\'s name.');
  const data = { name, part: $('mbPart').value, phone: $('mbPhone').value.trim(), email: $('mbEmail').value.trim(), notes: $('mbNotes').value.trim(), birthday: $('mbBirthday').value };
  try {
    const wasEdit = !!editingId;
    if (wasEdit) await updateDoc(doc(state.membersCol, editingId), data);
    else { data.created = serverTimestamp(); await addDoc(state.membersCol, data); }
    clearMemberForm(); msg($('mbFb'), `✅ ${name} ${wasEdit ? 'updated' : 'added'}!`, true, 3000);
  } catch (e) { msg($('mbFb'), '⚠️ Save failed: ' + e.message); }
}

export function editMember(id) {
  if (!requireLeader()) return;
  const m = state.members.find(x => x.id === id); if (!m) return;
  showPage('members'); editingId = id;
  $('mbName').value = m.name || ''; $('mbPart').value = m.part || ''; $('mbPhone').value = m.phone || '';
  $('mbEmail').value = m.email || ''; $('mbNotes').value = m.notes || ''; $('mbBirthday').value = m.birthday || '';
  $('memberFormTitle').textContent = '✏️ Edit Member'; $('mbSave').textContent = '🔄 Update Member';
  $('mbCancel').classList.remove('hidden');
  msg($('mbFb'), `✏️ Editing ${m.name}`, true);
  $('memberFormCard').scrollIntoView({ behavior: 'smooth' });
}

export async function deleteMember(id) {
  if (!requireLeader()) return;
  const m = state.members.find(x => x.id === id); if (!m) return;
  if (!confirm(`Remove ${m.name} from the group?\n\nYou can restore them from Settings → Recently deleted.`)) return;
  try { await deleteWithUndo('member', m, m.name, () => deleteDoc(doc(state.membersCol, id))); } catch (e) { return alert('Delete failed: ' + e.message); }
  if (editingId === id) clearMemberForm();
}

export function clearMemberForm() {
  ['mbName', 'mbPart', 'mbPhone', 'mbEmail', 'mbNotes', 'mbBirthday'].forEach(i => $(i).value = '');
  editingId = null;
  $('memberFormTitle').textContent = '➕ Add Member'; $('mbSave').textContent = '💾 Save Member';
  $('mbCancel').classList.add('hidden'); $('mbFb').textContent = '';
}

export function initMembers() {
  $('mbPart').innerHTML = '<option value="">Choose a part…</option>' + PARTS.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  $('memberSearch').oninput = renderMembers;
  $('mbSave').onclick = saveMember;
  $('mbCancel').onclick = clearMemberForm;
  $('csvBtn').onclick = exportCsv;
  on('members', renderMembers);
  on('practices', renderStats);
  on('signedOut', () => { clearMemberForm(); $('memberSearch').value = ''; });
}
