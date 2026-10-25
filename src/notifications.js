// In-app notification feed (bell), toasts, and optional system alerts.
//
// How it works: whenever someone adds/changes an event or practice, a small document is
// written to groups/{uid}/notifications. Every other device logged into the same group
// is listening to that collection and shows a toast + bell badge straight away.
// (Alerts while the app is fully CLOSED need push notifications - that comes with the phone app.)
import { addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { $, esc } from './utils.js';
import { state, emit, on } from './state.js';

/* ---------- safe localStorage ---------- */
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
};

// identifies THIS device so you aren't notified about your own changes
export const deviceId = (() => {
  let d = store.get('manger_device');
  if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('manger_device', d); }
  return d;
})();

/* ---------- toast + system notification ---------- */
export function toast(text, action) {
  const box = $('toasts'); if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  if (action) {   // e.g. { label: 'Undo', fn: () => ... }
    const b = document.createElement('button');
    b.className = 'toastbtn'; b.textContent = action.label;
    b.onclick = e => { e.stopPropagation(); t.remove(); action.fn(); };
    t.appendChild(b);
  }
  t.onclick = () => t.remove();
  box.appendChild(t);
  setTimeout(() => t.remove(), action ? 10000 : 7000);
}

export function sysNotify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    new Notification(title, { body, icon: state.group.icon || undefined });
  } catch { /* some mobile browsers refuse - ignore */ }
}

/* ---------- send ---------- */
export async function notify(text, kind = 'info') {
  if (!state.notifCol) return;
  try { await addDoc(state.notifCol, { text, kind, deviceId, created: serverTimestamp() }); }
  catch (e) { console.warn('Could not send notification:', e.message); }
}

/* ---------- receive ---------- */
export function listenNotifications() {
  let ready = false;
  const q = query(state.notifCol, orderBy('created', 'desc'), limit(30));
  return onSnapshot(q, snap => {
    state.notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (ready) {
      snap.docChanges().forEach(ch => {
        if (ch.type !== 'added') return;
        const n = ch.doc.data();
        if (n.deviceId === deviceId) return;          // my own change
        toast(n.text);
        sysNotify('Manger • ' + (state.group.name || 'Group'), n.text);
      });
    }
    ready = true;
    emit('notifications');
  }, e => console.warn('Notifications unavailable:', e.message));
}

/* ---------- bell + feed ---------- */
const seenKey = () => 'manger_seen_' + state.currentUid;
const when = n => (n.created && n.created.toMillis) ? n.created.toMillis() : Date.now();

function unreadCount() {
  const seen = Number(store.get(seenKey()) || 0);
  return state.notifications.filter(n => n.deviceId !== deviceId && when(n) > seen).length;
}

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return new Date(ms).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function renderBell() {
  if (state.currentUid && store.get(seenKey()) === null) store.set(seenKey(), String(Date.now()));
  const n = state.currentUid ? unreadCount() : 0, b = $('bellBadge');
  b.textContent = n > 9 ? '9+' : String(n);
  b.classList.toggle('hidden', n === 0);
}

function openFeed() {
  const seen = Number(store.get(seenKey()) || 0);
  $('notifList').innerHTML = state.notifications.length
    ? state.notifications.map(n => `<div class="nitem ${n.deviceId !== deviceId && when(n) > seen ? 'new' : ''}">${esc(n.text)}<small>${esc(ago(when(n)))}</small></div>`).join('')
    : `<div class="empty"><span class="ic">🔔</span><p>Nothing yet. You'll see event and practice updates here.</p></div>`;
  store.set(seenKey(), String(Date.now()));
  renderBell();
  $('notifModal').classList.add('active'); document.body.style.overflow = 'hidden';
}
function closeFeed() { $('notifModal').classList.remove('active'); document.body.style.overflow = 'auto'; }

/* ---------- settings: turn on system alerts ---------- */
function renderPerm() {
  const b = $('notifPermBtn'), s = $('notifPermStatus');
  if (!('Notification' in window)) {
    s.textContent = 'System alerts are not available in this browser. They will work in the Android / iPhone app.';
    b.classList.add('hidden'); return;
  }
  const p = Notification.permission;
  if (p === 'granted') { s.textContent = '✅ Alerts are on for this device.'; b.classList.add('hidden'); }
  else if (p === 'denied') { s.textContent = '🚫 Alerts are blocked. Allow notifications for this site in your browser settings.'; b.classList.add('hidden'); }
  else { s.textContent = 'Alerts are off on this device.'; b.classList.remove('hidden'); }
}

export function initNotifications() {
  $('bellBtn').onclick = openFeed;
  $('notifClose').onclick = closeFeed;
  $('notifModal').onclick = e => { if (e.target === $('notifModal')) closeFeed(); };
  addEventListener('keydown', e => { if (e.key === 'Escape') closeFeed(); });
  $('notifPermBtn').onclick = async () => { try { await Notification.requestPermission(); } catch { /* ignore */ } renderPerm(); };
  on('notifications', renderBell);
  on('signedOut', () => { closeFeed(); renderBell(); });
  renderPerm(); renderBell();
}
