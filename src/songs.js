import { addDoc, updateDoc, deleteDoc } from './db.js';
import { doc, serverTimestamp } from 'firebase/firestore';
import { $, esc, msg, shortDate, safeUrl } from './utils.js';
import { state, on } from './state.js';
import { showPage } from './nav.js';
import { notify, store } from './notifications.js';
import { getAudio, getAudioMime, setAudio, b64ToBlob, blobToB64, playBlob } from './audio.js';
import { playNote, parseKey } from './tone.js';
import { openStage } from './stage.js';
import { songUsage } from './stats.js';
import { myMember } from './identity.js';
import { requireLeader } from './roles.js';
import { deleteWithUndo } from './trash.js';

let editingId = null, filter = 'all', sortMode = 'new';
const LINKS = [['lnkRef', 'linkRef'], ['lnkSheet', 'linkSheet'], ['lnkS', 'linkS'], ['lnkA', 'linkA'], ['lnkT', 'linkT'], ['lnkB', 'linkB']];

/* ---------- personal favourites (kept on this device) ---------- */
const favKey = () => 'manger_favs_' + state.currentUid;
const favs = () => { try { return new Set(JSON.parse(store.get(favKey()) || '[]')); } catch { return new Set(); } };
export function toggleFav(id) {
  const f = favs(); f.has(id) ? f.delete(id) : f.add(id);
  store.set(favKey(), JSON.stringify([...f])); renderSongs();
}

const parseTags = str => [...new Set((str || '').split(',').map(t => t.trim().replace(/^#/, '').toLowerCase()).filter(t => t && t.length <= 24))].slice(0, 8);
const allTags = () => [...new Set(state.songs.flatMap(s => s.tags || []))].sort();
const hasKey = s => parseKey(s.key) != null;

/* ---------- library ---------- */
function renderChips() {
  const chips = [['all', 'All'], ['fav', '⭐ Favourites'], ...allTags().map(t => ['tag:' + t, '#' + t])];
  if (!chips.some(([k]) => k === filter)) filter = 'all';
  $('songChips').innerHTML = chips.map(([k, l]) => `<button class="chip ${k === filter ? 'on' : ''}" data-action="songFilter" data-id="${esc(k)}">${esc(l)}</button>`).join('');
}
export const setFilter = k => { filter = k; renderSongs(); };

export function renderSongs() {
  renderChips();
  const t = $('searchInput').value.toLowerCase().trim(), fv = favs();
  let f = state.songs.filter(s => {
    if (filter === 'fav' && !fv.has(s.id)) return false;
    if (filter.startsWith('tag:') && !(s.tags || []).includes(filter.slice(4))) return false;
    return !t || [s.title, s.key, s.lyrics, (s.tags || []).join(' ')].some(v => (v || '').toLowerCase().includes(t));
  });
  if (sortMode === 'az') f = f.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sortMode === 'last') f = f.slice().sort((a, b) => (songUsage(a.id).last || '').localeCompare(songUsage(b.id).last || ''));   // never / longest ago first
  else if (sortMode === 'most') f = f.slice().sort((a, b) => songUsage(b.id).count - songUsage(a.id).count);

  $('songCount').textContent = state.songs.length + ' Song' + (state.songs.length !== 1 ? 's' : '');
  if (!f.length) {
    $('songList').innerHTML = `<div class="empty"><span class="ic">🎵</span><p>${state.songs.length ? 'No matches.' : 'No songs yet. Add your first one above!'}</p></div>`;
    return;
  }
  $('songList').innerHTML = f.map(s => {
    const l = s.lyrics || '', p = l ? l.substring(0, 100) + (l.length > 100 ? '...' : '') : 'No lyrics';
    const id = esc(s.id), u = songUsage(s.id);
    const usage = u.count ? `🕒 Last sung ${esc(shortDate(u.last))} • ${u.count}×` : '🆕 Not sung yet';
    return `<div class="item"><div class="top"><div><button class="star" data-action="toggleFav" data-id="${id}" aria-label="Favourite">${fv.has(s.id) ? '⭐' : '☆'}</button><span class="ttl">${esc(s.title)}</span><span class="key">${esc(s.key)}</span>${s.audioBase64 ? ' 🎵' : ''}
      <div class="mu" style="font-size:.85rem;margin-top:2px">${usage}${(s.tags || []).map(x => ` <span class="tagc">#${esc(x)}</span>`).join('')}</div></div>
      <div class="acts">${hasKey(s) ? `<button class="btn b-dk sm" data-action="playNote" data-id="${id}">🔔 Note</button>` : ''}${s.audioBase64 ? `<button class="btn b-pri sm" data-action="playAudio" data-id="${id}">▶️ Play Key</button>` : ''}
      <button class="btn b-pri sm" data-action="editSong" data-id="${id}">✏️ Edit</button>
      <button class="btn b-no sm" data-action="deleteSong" data-id="${id}">🗑️</button></div></div>
      <div class="prev" data-action="viewSong" data-id="${id}"><span>📖 ${esc(p)}</span><span style="color:var(--ac);font-weight:600">View Lyrics →</span></div></div>`;
  }).join('');
}

/* ---------- song modal ---------- */
function linkButtons(s) {
  const out = [], me = myMember();
  const parts = [['linkS', 'Soprano'], ['linkA', 'Alto'], ['linkT', 'Tenor'], ['linkB', 'Bass']];
  const a = (u, label, cls = 'b-pri') => `<a class="btn ${cls} sm" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  const mine = me && parts.find(([, n]) => n === me.part);
  if (mine && s[mine[0]]) out.push(a(s[mine[0]], `🎧 Your part (${mine[1]})`, 'b-ok'));
  parts.forEach(([k, n]) => { if (s[k] && !(mine && mine[0] === k)) out.push(a(s[k], `🎧 ${n}`)); });
  if (s.linkRef) out.push(a(s.linkRef, '▶️ Listen / reference', 'b-dk'));
  if (s.linkSheet) out.push(a(s.linkSheet, '📄 Sheet music', 'b-dk'));
  return out.join(' ');
}

export function viewSong(id) {
  const s = state.songs.find(x => x.id === id); if (!s) return;
  state.viewingId = id;
  $('mTitle').textContent = s.title; $('mMeta').textContent = 'Key: ' + s.key;
  $('mLyrics').textContent = s.lyrics || 'No lyrics added yet.';
  $('mNotesBox').classList.toggle('hidden', !s.notes); $('mNotes').textContent = s.notes || '';
  const u = songUsage(s.id);
  $('mUsage').textContent = u.count ? `🕒 Last sung ${shortDate(u.last)} • sung ${u.count} time${u.count !== 1 ? 's' : ''}` : '🆕 Not in any past setlist yet';
  $('mTags').innerHTML = (s.tags || []).map(x => `<span class="tagc">#${esc(x)}</span>`).join(' ');
  $('mLinks').innerHTML = linkButtons(s);
  $('mNoteBtn').classList.toggle('hidden', !hasKey(s));
  $('mAudioBox').classList.toggle('hidden', !s.audioBase64);
  if (s.audioBase64) $('mAudio').src = URL.createObjectURL(b64ToBlob(s.audioBase64, s.audioMime));
  else $('mAudio').removeAttribute('src');
  $('songModal').classList.add('active'); document.body.style.overflow = 'hidden';
}

export function closeModal() {
  $('songModal').classList.remove('active');
  document.body.style.overflow = 'auto';
  $('mAudio').pause();
}

export function playAudio(id) {
  const s = state.songs.find(x => x.id === id);
  if (s && s.audioBase64) playBlob(b64ToBlob(s.audioBase64, s.audioMime));
}
export function playNoteFor(id) { const s = state.songs.find(x => x.id === id); if (s) playNote(s.key); }

/* ---------- CRUD ---------- */
async function saveSong() {
  if (!requireLeader()) return;
  const title = $('songTitle').value.trim();
  if (!title) return msg($('songFb'), '⚠️ Please enter a title.');
  const data = {
    title, key: $('songKey').value.trim() || 'N/A', lyrics: $('songLyrics').value.trim(), notes: $('songNotes').value.trim(),
    tags: parseTags($('songTags').value)
  };
  for (const [inp, field] of LINKS) {
    const raw = $(inp).value.trim(), u = safeUrl(raw);
    if (raw && !u) return msg($('songFb'), '⚠️ One of the links does not look like a web address.');
    data[field] = u || null;
  }
  const blob = getAudio();
  data.audioBase64 = blob ? await blobToB64(blob) : null;
  data.audioMime = blob ? getAudioMime() : null;
  try {
    const wasEdit = !!editingId;
    if (wasEdit) await updateDoc(doc(state.songsCol, editingId), data);
    else { data.created = serverTimestamp(); await addDoc(state.songsCol, data); }
    if (!wasEdit) notify(`🎵 New song added: ${title}`, 'song');
    clearForm(); msg($('songFb'), `✅ "${title}" ${wasEdit ? 'updated' : 'added'}!`, true, 3000);
  } catch (e) { msg($('songFb'), '⚠️ Save failed: ' + e.message); }
}

export function editSong(id) {
  if (!requireLeader()) return;
  const s = state.songs.find(x => x.id === id); if (!s) return;
  closeModal(); showPage('songs'); editingId = id;
  $('songTitle').value = s.title; $('songKey').value = s.key;
  $('songLyrics').value = s.lyrics || ''; $('songNotes').value = s.notes || ''; $('songTags').value = (s.tags || []).join(', ');
  LINKS.forEach(([inp, field]) => $(inp).value = s[field] || '');
  $('linksBox').open = LINKS.some(([, f]) => s[f]);
  setAudio(s.audioBase64 ? b64ToBlob(s.audioBase64, s.audioMime) : null, s.audioMime);
  $('saveSongBtn').textContent = '🔄 Update Song'; $('cancelSongBtn').classList.remove('hidden');
  msg($('songFb'), `✏️ Editing "${s.title}"`, true);
  $('songFormCard').scrollIntoView({ behavior: 'smooth' });
}

export async function deleteSong(id) {
  if (!requireLeader()) return;
  const s = state.songs.find(x => x.id === id); if (!s) return;
  const n = state.events.filter(e => (e.songIds || []).includes(id)).length;
  if (!confirm(`Delete "${s.title}"?` + (n ? `\n\nIt is used in ${n} event${n !== 1 ? 's' : ''} and will disappear from those setlists.` : '') + '\n\nYou can restore it from Settings → Recently deleted.')) return;
  try { await deleteWithUndo('song', s, s.title, () => deleteDoc(doc(state.songsCol, id))); }
  catch (e) { return alert('Delete failed: ' + e.message); }
  closeModal();
  if (editingId === id) clearForm();
}

export function clearForm() {
  ['songTitle', 'songKey', 'songLyrics', 'songNotes', 'songTags', ...LINKS.map(l => l[0])].forEach(i => $(i).value = '');
  $('linksBox').open = false;
  setAudio(null); editingId = null;
  $('saveSongBtn').textContent = '💾 Save Song'; $('cancelSongBtn').classList.add('hidden'); $('songFb').textContent = '';
}

export function initSongs() {
  $('searchInput').oninput = renderSongs;
  $('songSort').onchange = e => { sortMode = e.target.value; renderSongs(); };
  $('saveSongBtn').onclick = saveSong;
  $('cancelSongBtn').onclick = clearForm;

  $('closeModalBtn').onclick = closeModal;
  $('songModal').onclick = e => { if (e.target === $('songModal')) closeModal(); };
  addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  $('mEdit').onclick = () => { if (state.viewingId) editSong(state.viewingId); };
  $('mDelete').onclick = () => { if (state.viewingId) deleteSong(state.viewingId); };
  $('mNoteBtn').onclick = () => { if (state.viewingId) playNoteFor(state.viewingId); };
  $('mStage').onclick = () => { const id = state.viewingId; if (id) { closeModal(); openStage([id]); } };

  on('songs', renderSongs);
  on('events', renderSongs);       // "last sung" depends on events
  on('me', renderSongs);
  on('signedOut', () => { clearForm(); closeModal(); filter = 'all'; });
}
