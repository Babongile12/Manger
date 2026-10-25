import {
  signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'firebase/auth';
import { getDocs, writeBatch } from 'firebase/firestore';
import { updateDoc } from './db.js';
import { auth, db } from './firebase.js';
import { $, msg } from './utils.js';
import { state, on } from './state.js';
import { showPage } from './nav.js';
import { authError } from './auth.js';
import { clearForm } from './songs.js';
import { clearEventForm } from './events.js';
import { clearPracticeForm } from './practice.js';
import { requireLeader } from './roles.js';
import { exportBackup } from './share.js';
import { APP_URL } from './config.js';

async function wipe(col) {
  const snap = await getDocs(col);
  let batch = writeBatch(db), n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }
  await batch.commit();
}

/* ---------- invite message (never contains the password) ---------- */
const appLink = () => (APP_URL || (location.origin + location.pathname)).replace(/index\.html$/, '');
export const inviteLink = () => appLink() + '?group=' + encodeURIComponent(state.group.username || '');
export const inviteText = () => `🎶 Join *${state.group.name || 'our group'}* on Manger!\n\n1) Open: ${inviteLink()}\n2) Log in with our group username (${state.group.username || ''}) and the group password. Ask the leader for the password.\n\nYou'll see our songs, setlists, practices and reminders.`;

export function initSettings() {
  on('group', () => {
    if (document.activeElement !== $('setName')) $('setName').value = state.group.name || '';
    $('inviteLink').textContent = inviteLink();
  });

  $('saveNameBtn').onclick = async () => {
    if (!requireLeader()) return;
    const n = $('setName').value.trim();
    if (!n) return msg($('nameFb'), '⚠️ Group name cannot be empty.');
    try { await updateDoc(state.gref, { name: n }); msg($('nameFb'), '✅ Group name updated!', true, 3000); }
    catch (e) { msg($('nameFb'), '⚠️ ' + e.message); }
  };

  $('savePassBtn').onclick = async () => {
    if (!requireLeader()) return;
    const cur = $('pCur').value, nw = $('pNew').value, fb = $('passFb');
    if (!cur || !nw) return msg(fb, '⚠️ Fill in all password fields.');
    if (nw !== $('pNew2').value) return msg(fb, '⚠️ New passwords do not match.');
    try {
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
      await updatePassword(u, nw);
      ['pCur', 'pNew', 'pNew2'].forEach(i => $(i).value = '');
      msg(fb, '✅ Password updated!', true, 4000);
    } catch (e) {
      msg(fb, '⚠️ ' + (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'Current password is wrong.' : authError(e)));
    }
  };

  $('logoutBtn').onclick = () => signOut(auth);

  $('inviteCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(inviteText()); msg($('inviteFb'), '✅ Invite message copied.', true, 3000); }
    catch { msg($('inviteFb'), '⚠️ Could not copy. Use the WhatsApp button instead.'); }
  };
  $('inviteWa').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(inviteText()), '_blank', 'noopener');
  $('backupBtn').onclick = exportBackup;

  $('resetConfirm').oninput = () => {
    $('resetBtn').disabled = $('resetConfirm').value.trim().toLowerCase() !== (state.group.name || '').toLowerCase() || !state.group.name;
  };
  $('resetBtn').onclick = async () => {
    if (!requireLeader()) return;
    if (!navigator.onLine) return msg($('resetFb'), '⚠️ Reset needs an internet connection.');
    if (!confirm('This permanently deletes ALL songs, events, practices and polls for this group (it cannot be undone from "Recently deleted"). Continue?')) return;
    try {
      await wipe(state.songsCol); await wipe(state.eventsCol); await wipe(state.practicesCol); await wipe(state.notifCol); await wipe(state.pollsCol);
      await updateDoc(state.gref, { announcement: null, announcementAt: null });
      clearForm(); clearEventForm(); clearPracticeForm(); $('resetConfirm').value = ''; $('resetBtn').disabled = true;
      msg($('resetFb'), '✅ Group reset. You are starting afresh.', true, 4000); showPage('home');
    } catch (e) { msg($('resetFb'), '⚠️ ' + e.message); }
  };
}
