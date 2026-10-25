// Pinned announcement + quick polls (shown on Home).
import { updateDoc, addDoc, deleteDoc } from './db.js';
import { doc, serverTimestamp } from 'firebase/firestore';
import { $, esc, msg } from './utils.js';
import { state } from './state.js';
import { voterId } from './identity.js';
import { notify } from './notifications.js';
import { requireLeader } from './roles.js';

export function announcementHtml() {
  const t = state.group.announcement; if (!t) return '';
  const when = state.group.announcementAt ? new Date(state.group.announcementAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '';
  return `<div class="ann">📢 <strong>Announcement</strong>${when ? ` <span class="mu">• ${esc(when)}</span>` : ''}<div style="white-space:pre-wrap;margin-top:6px">${esc(t)}</div></div>`;
}

function pollCard(p) {
  const votes = p.votes || {}, opts = p.options || [], total = Object.keys(votes).length, mine = votes[voterId()], closed = !!p.closed;
  const rows = opts.map((o, i) => {
    const n = Object.values(votes).filter(v => v === i).length, pct = total ? Math.round(n / total * 100) : 0;
    return `<div class="popt"><button class="btn sm ${mine === i ? 'b-ok' : 'b-dk'}" data-action="vote" data-id="${esc(p.id)}|${i}" ${closed ? 'disabled' : ''}>${mine === i ? '✔ ' : ''}${esc(o)}</button>
      <div class="pbar"><i style="width:${pct}%"></i></div><span class="mu">${n} (${pct}%)</span></div>`;
  }).join('');
  return `<div class="card"><h2 style="font-size:1.2rem">📊 ${esc(p.question)} ${closed ? '<span class="key">closed</span>' : ''}</h2>${rows}
    <div class="mu" style="margin-top:6px">${total} vote${total !== 1 ? 's' : ''}</div>
    <div class="acts leader-only mt"><button class="btn b-dk sm" data-action="togglePoll" data-id="${esc(p.id)}">${closed ? 'Reopen' : 'Close poll'}</button>
    <button class="btn b-no sm" data-action="deletePoll" data-id="${esc(p.id)}">🗑️</button></div></div>`;
}

export function communityHtml() {
  const ms = p => (p.created && p.created.toMillis) ? p.created.toMillis() : Date.now();
  const sorted = state.polls.slice().sort((a, b) => ms(b) - ms(a));
  const shown = [...sorted.filter(p => !p.closed), ...sorted.filter(p => p.closed).slice(0, 2)];
  return announcementHtml() + shown.map(pollCard).join('') +
    `<div class="acts leader-only" style="margin-bottom:16px"><button class="btn b-dk sm" data-action="openAnn">📢 ${state.group.announcement ? 'Edit' : 'Post'} announcement</button><button class="btn b-dk sm" data-action="openPoll">📊 New poll</button></div>`;
}

export async function votePoll(arg) {
  const [id, i] = (arg || '').split('|'), p = state.polls.find(x => x.id === id);
  if (!p || p.closed) return;
  try { await updateDoc(doc(state.pollsCol, id), { ['votes.' + voterId()]: Number(i) }); } catch (e) { alert('Could not save your vote: ' + e.message); }
}
export async function togglePoll(id) {
  if (!requireLeader()) return; const p = state.polls.find(x => x.id === id); if (!p) return;
  try { await updateDoc(doc(state.pollsCol, id), { closed: !p.closed }); } catch (e) { alert(e.message); }
}
export async function deletePoll(id) {
  if (!requireLeader()) return;
  if (!confirm('Delete this poll and its votes?')) return;
  try { await deleteDoc(doc(state.pollsCol, id)); } catch (e) { alert(e.message); }
}

/* ---------- modals ---------- */
export function openAnn() { if (!requireLeader()) return; $('annText').value = state.group.announcement || ''; $('annFb').textContent = ''; $('annModal').classList.add('active'); }
export function openPoll() { if (!requireLeader()) return; $('pollQ').value = ''; $('pollOpts').value = ''; $('pollFb').textContent = ''; $('pollModal').classList.add('active'); }
const close = id => $(id).classList.remove('active');

export function initCommunity() {
  $('annClose').onclick = () => close('annModal'); $('pollClose').onclick = () => close('pollModal');
  $('annModal').onclick = e => { if (e.target === $('annModal')) close('annModal'); };
  $('pollModal').onclick = e => { if (e.target === $('pollModal')) close('pollModal'); };
  $('annSave').onclick = async () => {
    const t = $('annText').value.trim(); if (!t) return msg($('annFb'), '⚠️ Write something first (or press Remove).');
    try { await updateDoc(state.gref, { announcement: t, announcementAt: Date.now() }); notify('📢 ' + (t.length > 90 ? t.slice(0, 90) + '…' : t), 'announcement'); close('annModal'); }
    catch (e) { msg($('annFb'), '⚠️ ' + e.message); }
  };
  $('annClear').onclick = async () => {
    try { await updateDoc(state.gref, { announcement: null, announcementAt: null }); close('annModal'); } catch (e) { msg($('annFb'), '⚠️ ' + e.message); }
  };
  $('pollSave').onclick = async () => {
    const q = $('pollQ').value.trim(), opts = $('pollOpts').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!q) return msg($('pollFb'), '⚠️ Enter a question.');
    if (opts.length < 2 || opts.length > 6) return msg($('pollFb'), '⚠️ Enter 2 to 6 options, one per line.');
    try { await addDoc(state.pollsCol, { question: q, options: opts, votes: {}, closed: false, created: serverTimestamp() }); notify('📊 New poll: ' + q, 'poll'); close('pollModal'); }
    catch (e) { msg($('pollFb'), '⚠️ ' + e.message); }
  };
}
