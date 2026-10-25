import { $ } from './utils.js';
import { state, on } from './state.js';

// 'members' is a page but deliberately has no tab in the bar (open it from Settings)
const PAGES = ['home', 'songs', 'events', 'practice', 'members', 'settings'];

export function showPage(p) {
  if (!PAGES.includes(p)) p = 'home';
  PAGES.forEach(x => $('page-' + x).classList.toggle('hidden', x !== p));
  const tab = p === 'members' ? 'settings' : p;   // Members lives under Settings
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.page === tab));
  if (location.hash !== '#' + p) history.replaceState(null, '', '#' + p);
  window.scrollTo(0, 0);
}

function badge() {
  const online = navigator.onLine, c = $('conn');
  c.textContent = online ? '🟢 Live' : '🟡 Offline';
  c.style.background = online ? '#2E7D32' : '#C62828';
}

export function initNav() {
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => showPage(b.dataset.page));
  window.addEventListener('hashchange', () => { if (state.currentUid) showPage(location.hash.replace('#', '')); });
  addEventListener('online', badge); addEventListener('offline', badge); badge();

  // header / footer / tab title follow the group name
  on('group', () => {
    const name = state.group.name;
    $('gName').textContent = name || 'Group';
    $('footName').textContent = name || 'Manger';
    document.title = (name || 'Group') + ' • Manger';
  });
  on('signedOut', () => { document.title = 'Manger'; });
}
