// "Install on this phone": Android shows a real install button; iPhones need the Share-menu steps.
import { $ } from './utils.js';
// Shown in Settings so you can tell which version is running on a phone.
const APP_VERSION = '2026-10-26 install-check-3';

let deferred = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function renderInstall() {
  const s = $('installStatus'), b = $('installBtn');
  if (standalone()) { s.textContent = '✅ You are using the installed app.'; b.classList.add('hidden'); return; }
  if (deferred) { s.textContent = 'Add Manger to your home screen so it opens like an app.'; b.classList.remove('hidden'); return; }
  b.classList.add('hidden');
  s.textContent = isIOS()
    ? 'On iPhone: open this page in Safari, tap the Share button (square with an arrow), then "Add to Home Screen".'
    : 'In your browser menu (⋮), choose "Install app" or "Add to Home screen".';
}

/* Reports what THIS browser can see, so install problems can be diagnosed on the phone itself. */
export async function diagnose() {
  const out = [], L = (ok, t) => out.push((ok === true ? '✅ ' : ok === false ? '❌ ' : 'ℹ️ ') + t);
  L(null, 'App version: ' + APP_VERSION);
  L(location.protocol === 'https:' || location.hostname === 'localhost', 'Secure connection: ' + location.protocol.replace(':', ''));
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) L(false, 'The page has no manifest link');
  else {
    try {
      const r = await fetch(link.href, { cache: 'no-store' });
      if (!r.ok) L(false, `Manifest NOT FOUND (error ${r.status}) at ${link.href}`);
      else {
        const m = await r.json(); L(true, `Manifest loaded: "${m.name}"`);
        for (const ic of (m.icons || [])) {
          const url = new URL(ic.src, link.href).href;
          const ok = await new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = url; });
          L(ok, `Icon ${ic.sizes}${ic.purpose === 'maskable' ? ' (maskable)' : ''}: ${ok ? 'found' : 'NOT FOUND at ' + url}`);
        }
      }
    } catch (e) { L(false, 'Manifest check failed: ' + e.message); }
  }
  if (!('serviceWorker' in navigator)) L(false, 'Offline helper not supported in this browser');
  else {
    const reg = await navigator.serviceWorker.getRegistration();
    L(!!reg, 'Offline helper (service worker): ' + (reg ? (reg.active ? 'active' : 'starting') : 'not registered yet. Reload the page once.'));
  }
  L(null, 'Opened as: ' + (standalone() ? 'installed app' : 'browser tab'));
  L(null, 'Browser: ' + navigator.userAgent.slice(0, 100));
  return out.join('\n');
}

export function initInstall() {
  $('appVersion').textContent = 'Version ' + APP_VERSION;
  $('installCheckBtn').onclick = async () => {
    const r = $('installReport'); r.classList.remove('hidden'); r.textContent = 'Checking…';
    r.textContent = await diagnose();
  };
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; renderInstall(); });
  addEventListener('appinstalled', () => { deferred = null; renderInstall(); });
  $('installBtn').onclick = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    deferred = null; renderInstall();
  };
  renderInstall();

  // offline support: only on a real website address (not while developing, not inside the phone-app wrapper)
  const real = location.protocol === 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
  if (real && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
