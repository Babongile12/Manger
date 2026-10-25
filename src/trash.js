// "Recently deleted": songs, events, practices and members go here for 30 days and can be restored.
import { setDoc, deleteDoc } from './db.js';
import { doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { $, esc } from './utils.js';
import { state, on } from './state.js';
import { toast } from './notifications.js';
import { isLeader } from './roles.js';

const COL = { song: 'songsCol', event: 'eventsCol', practice: 'practicesCol', member: 'membersCol' };
const ICON = { song: '🎵', event: '📅', practice: '🎤', member: '👤' };
const DAYS = 30;

/* put a copy in the bin; returns the bin id. `obj` is the state object (it contains its own id). */
export async function binItem(kind, obj, label) {
  const { id, created, ...rest } = obj;
  const ref = doc(state.trashCol);
  await setDoc(ref, {
    kind, srcId: id, label, data: rest, deleted: serverTimestamp(),
    createdMs: created && created.toMillis ? created.toMillis() : null
  });
  return ref.id;
}

/* convenience used by every delete: bin it, delete it, offer Undo */
export async function deleteWithUndo(kind, obj, label, deleteFn) {
  const tid = await binItem(kind, obj, label);
  await deleteFn();
  toast(`🗑️ Deleted: ${label}`, { label: 'Undo', fn: () => restoreItem(tid, true) });
}

export async function restoreItem(trashId, quiet) {
  const t = state.trash.find(x => x.id === trashId); if (!t) return;
  const col = state[COL[t.kind]]; if (!col) return;
  try {
    await setDoc(doc(col, t.srcId), { ...t.data, created: t.createdMs ? Timestamp.fromMillis(t.createdMs) : serverTimestamp() });
    await deleteDoc(doc(state.trashCol, trashId));
    toast(`↩️ Restored: ${t.label}`);
  } catch (e) { alert('Could not restore: ' + e.message); }
}

const ms = t => (t.deleted && t.deleted.toMillis) ? t.deleted.toMillis() : Date.now();
const ago = m => { const d = Math.floor((Date.now() - m) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };

let purged = new Set();
export function renderTrash() {
  $('trashList').innerHTML = state.trash.length
    ? state.trash.map(t => `<div class="erow"><div><div class="et">${ICON[t.kind] || '🗑️'} ${esc(t.label)}</div><div class="es">${esc(t.kind)} • deleted ${ago(ms(t))}</div></div>
        <button class="btn b-pri sm" data-action="restoreTrash" data-id="${esc(t.id)}">↩️ Restore</button></div>`).join('')
    : '<p class="mu">Nothing deleted recently.</p>';
  if (isLeader()) {   // tidy up anything older than 30 days
    state.trash.filter(t => Date.now() - ms(t) > DAYS * 86400000 && !purged.has(t.id)).forEach(t => { purged.add(t.id); deleteDoc(doc(state.trashCol, t.id)).catch(() => {}); });
  }
}

export function initTrash() {
  on('trash', renderTrash);
  on('signedOut', () => { purged = new Set(); });
}
