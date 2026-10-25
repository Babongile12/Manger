// Leader / member view. A leader PIN hides all editing on a phone until the PIN is entered.
// HONEST NOTE: everyone still shares one Firebase login, so this prevents accidents - it is not
// protection against a determined person. Real per-person permissions need individual accounts.
import { updateDoc } from './db.js';
import { $, msg } from './utils.js';
import { state, on } from './state.js';
import { store } from './notifications.js';

const ukey = () => 'manger_leader_' + state.currentUid;
async function hash(pin) {
  const b = new TextEncoder().encode(state.currentUid + ':' + pin);
  const d = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export const hasPin = () => !!state.group.leaderPin;
export const isLeader = () => !hasPin() || store.get(ukey()) === state.group.leaderPin;
export function requireLeader() {
  if (isLeader()) return true;
  alert('Only a leader can do this. Unlock leader mode in Settings → Leader access.');
  return false;
}

export function applyRole() {
  document.body.classList.toggle('viewer', !!state.currentUid && !isLeader());
  const lead = isLeader(), pin = hasPin();
  $('roleStatus').textContent = !pin ? '👥 Everyone in the group can edit (no leader PIN set).'
    : lead ? '👑 This device is in Leader mode.' : '👤 This device is in Member view (read-only).';
  $('roleSetWrap').classList.toggle('hidden', !(lead));                 // set / change PIN
  $('roleSetBtn').textContent = pin ? 'Change PIN' : 'Set leader PIN';
  $('roleUnlockWrap').classList.toggle('hidden', !(pin && !lead));
  $('roleLockBtn').classList.toggle('hidden', !(pin && lead));
  $('roleRemoveBtn').classList.toggle('hidden', !(pin && lead));
}

export function initRoles() {
  $('roleSetBtn').onclick = async () => {
    const pin = $('rolePinNew').value.trim();
    if (pin.length < 4) return msg($('roleFb'), '⚠️ Use at least 4 characters.');
    try {
      const h = await hash(pin);
      await updateDoc(state.gref, { leaderPin: h });
      store.set(ukey(), h); $('rolePinNew').value = '';
      msg($('roleFb'), '✅ Leader PIN saved. This device is a leader.', true, 4000);
    } catch (e) { msg($('roleFb'), '⚠️ ' + e.message); }
  };
  $('roleUnlockBtn').onclick = async () => {
    const h = await hash($('rolePinIn').value.trim());
    if (h === state.group.leaderPin) { store.set(ukey(), h); $('rolePinIn').value = ''; msg($('roleFb'), '✅ Leader mode on.', true, 3000); applyRole(); }
    else msg($('roleFb'), '⚠️ Wrong PIN.');
  };
  $('roleLockBtn').onclick = () => { store.set(ukey(), ''); applyRole(); msg($('roleFb'), 'Switched to Member view.', true, 3000); };
  $('roleRemoveBtn').onclick = async () => {
    if (!confirm('Remove the leader PIN? Everyone will be able to edit again.')) return;
    try { await updateDoc(state.gref, { leaderPin: null }); msg($('roleFb'), '✅ PIN removed.', true, 3000); } catch (e) { msg($('roleFb'), '⚠️ ' + e.message); }
  };
  on('group', applyRole);
  on('signedOut', () => { document.body.classList.remove('viewer'); });
}
