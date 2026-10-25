// "Who are you?" - links THIS device to one member, so the app can do RSVPs, "your part",
// poll votes etc. even though the whole group shares one login. Stored on the device only.
import { $, esc } from './utils.js';
import { state, emit, on } from './state.js';
import { store, deviceId } from './notifications.js';

const key = () => 'manger_me_' + state.currentUid;
let asked = false;

export const getMeId = () => { const v = store.get(key()); return v && v !== 'skip' && state.members.some(m => m.id === v) ? v : null; };
export const myMember = () => state.members.find(m => m.id === getMeId()) || null;
export const voterId = () => getMeId() || 'd_' + deviceId;
const byName = (a, b) => (a.name || '').localeCompare(b.name || '');

export function openWho() {
  const list = state.members.slice().sort(byName);
  $('whoList').innerHTML = list.length
    ? list.map(m => `<button class="btn b-dk who" data-action="pickMe" data-id="${esc(m.id)}">${esc(m.name)}${m.part ? ' · ' + esc(m.part) : ''}</button>`).join('')
      + `<button class="btn b-pri who" data-action="pickMe" data-id="skip">I'm not in this list</button>`
    : '<p class="mu">Add members first (Settings → Group Members), then tell the app who you are.</p>';
  $('whoModal').classList.add('active');
}
const closeWho = () => $('whoModal').classList.remove('active');

export function pickMe(id) {
  if (!id) return openWho();          // e.g. the "Who are you?" button inside an RSVP box
  store.set(key(), id); closeWho(); emit('me');
}

function renderIdentitySettings() {
  const sel = $('meSelect'); if (!sel) return;
  sel.innerHTML = '<option value="">Not set</option>' + state.members.slice().sort(byName).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  sel.value = getMeId() || '';
}

export function initIdentity() {
  $('whoClose').onclick = () => pickMe('skip');
  $('meSelect').onchange = e => pickMe(e.target.value || 'skip');
  on('members', () => {
    renderIdentitySettings();
    if (!asked) {                       // ask once per login, and only if the roster already existed
      asked = true;
      if (state.members.length && store.get(key()) === null) openWho();
    }
  });
  on('me', renderIdentitySettings);
  on('signedOut', () => { asked = false; closeWho(); });
}
