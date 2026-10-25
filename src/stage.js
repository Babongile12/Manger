// Stage / performance mode: big lyrics on a dark screen, adjustable size, auto-scroll,
// next/previous song through a setlist, and the screen stays awake.
import { $ } from './utils.js';
import { state } from './state.js';
import { store } from './notifications.js';
import { playNote, parseKey } from './tone.js';

let ids = [], idx = 0, timer = null, speed = 30, pos = 0, lock = null;
let font = Number(store.get('manger_stage_font')) || 30;

const cur = () => state.songs.find(s => s.id === ids[idx]);

function render() {
  const s = cur(); if (!s) return closeStage();
  $('stTitle').textContent = s.title;
  $('stKey').textContent = s.key && s.key !== 'N/A' ? 'Key: ' + s.key : '';
  $('stLyrics').textContent = s.lyrics || 'No lyrics added yet.';
  $('stLyrics').style.fontSize = font + 'px';
  $('stNotes').textContent = s.notes ? '📝 ' + s.notes : '';
  $('stPos').textContent = ids.length > 1 ? `${idx + 1} / ${ids.length}` : '';
  $('stPrev').disabled = idx === 0; $('stNext').disabled = idx >= ids.length - 1;
  $('stNote').classList.toggle('hidden', parseKey(s.key) == null);
  stopScroll(); $('stBody').scrollTop = 0; pos = 0;
}

export function openStage(list, start = 0) {
  ids = list.filter(id => state.songs.some(s => s.id === id)); if (!ids.length) return;
  idx = Math.min(start, ids.length - 1); render();
  $('stage').classList.add('active'); document.body.style.overflow = 'hidden'; wake();
}
export function stageEvent(eventId) {
  const ev = state.events.find(e => e.id === eventId); if (!ev) return;
  if (!(ev.songIds || []).some(id => state.songs.some(s => s.id === id))) return alert('This event has no songs in its setlist yet.');
  openStage(ev.songIds);
}
export function closeStage() {
  stopScroll(); $('stage').classList.remove('active'); document.body.style.overflow = 'auto'; release();
}

function startScroll() {
  const b = $('stBody'); pos = b.scrollTop; $('stScroll').textContent = '⏸ Pause';
  timer = setInterval(() => {
    if (Math.abs(b.scrollTop - Math.round(pos)) > 2) pos = b.scrollTop;   // user scrolled by hand
    pos = Math.min(pos + speed * 0.05, b.scrollHeight - b.clientHeight); b.scrollTop = pos;
    if (pos >= b.scrollHeight - b.clientHeight - 1) stopScroll();
  }, 50);
}
function stopScroll() { clearInterval(timer); timer = null; $('stScroll').textContent = '▶ Auto-scroll'; }

async function wake() { try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch { /* not supported */ } }
function release() { try { lock && lock.release(); } catch { /* ignore */ } lock = null; }

const go = d => { const n = idx + d; if (n < 0 || n >= ids.length) return; idx = n; render(); };
const size = d => { font = Math.max(16, Math.min(90, font + d)); store.set('manger_stage_font', String(font)); $('stLyrics').style.fontSize = font + 'px'; };

export function initStage() {
  $('stClose').onclick = closeStage;
  $('stPrev').onclick = () => go(-1); $('stNext').onclick = () => go(1);
  $('stBigger').onclick = () => size(4); $('stSmaller').onclick = () => size(-4);
  $('stScroll').onclick = () => timer ? stopScroll() : startScroll();
  $('stFaster').onclick = () => { speed = Math.min(150, speed + 10); };
  $('stSlower').onclick = () => { speed = Math.max(10, speed - 10); };
  $('stNote').onclick = () => { const s = cur(); if (s) playNote(s.key); };
  addEventListener('keydown', e => {
    if (!$('stage').classList.contains('active')) return;
    if (e.key === 'Escape') closeStage(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('stage').classList.contains('active')) wake(); });
}
