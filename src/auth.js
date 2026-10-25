import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged
} from 'firebase/auth';
import {
  doc, collection, query, orderBy, limit, onSnapshot, setDoc, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { $, msg } from './utils.js';
import { state, emit } from './state.js';
import { listenNotifications } from './notifications.js';
import { showPage } from './nav.js';

const EMAIL_DOMAIN = '@songmanager.app';   // group username -> sign-in identity (never shown)

let mode = 'in', creating = false, unsubs = [];

function setMode(m) {
  mode = m;
  const up = m === 'up';
  $('gnWrap').classList.toggle('hidden', !up); $('cpWrap').classList.toggle('hidden', !up);
  $('authBtn').textContent = up ? 'Create group' : 'Log in';
  $('tabIn').className = 'btn ' + (up ? 'b-pri' : 'b-dk'); $('tabUp').className = 'btn ' + (up ? 'b-dk' : 'b-pri');
  $('aPass').autocomplete = up ? 'new-password' : 'current-password';
  $('authFb').textContent = '';
}

export function authError(e) {
  const c = e.code || '';
  if (c === 'auth/email-already-in-use') return 'That group username is already taken.';
  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-email'].includes(c)) return 'Wrong group username or password.';
  if (c === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (c === 'auth/too-many-requests') return 'Too many attempts. Try again in a few minutes.';
  if (c === 'auth/network-request-failed') return 'No internet connection.';
  return e.message;
}

async function submitAuth() {
  const user = $('aUser').value.trim().toLowerCase(), pass = $('aPass').value, fb = $('authFb');
  if (!/^[a-z0-9_-]{3,30}$/.test(user)) return msg(fb, 'Username: 3–30 letters, numbers, - or _ (no spaces).');
  if (!pass) return msg(fb, 'Enter your password.');
  $('authBtn').disabled = true;
  try {
    if (mode === 'in') {
      await signInWithEmailAndPassword(auth, user + EMAIL_DOMAIN, pass);
    } else {
      const name = $('aName').value.trim();
      if (!name) { $('authBtn').disabled = false; return msg(fb, 'Enter a group name.'); }
      if (pass !== $('aPass2').value) { $('authBtn').disabled = false; return msg(fb, 'Passwords do not match.'); }
      creating = true;
      const cred = await createUserWithEmailAndPassword(auth, user + EMAIL_DOMAIN, pass);
      await setDoc(doc(db, 'groups', cred.user.uid), { name, username: user, theme: 'brown', created: serverTimestamp() });
      creating = false;
      enterApp(cred.user);
    }
  } catch (e) { creating = false; msg(fb, authError(e)); }
  $('authBtn').disabled = false;
}

function enterApp(user) {
  if (state.currentUid === user.uid) return;
  state.currentUid = user.uid;
  state.gref = doc(db, 'groups', user.uid);
  state.songsCol = collection(state.gref, 'songs');
  state.eventsCol = collection(state.gref, 'events');
  state.practicesCol = collection(state.gref, 'practices');
  state.membersCol = collection(state.gref, 'members');
  state.notifCol = collection(state.gref, 'notifications');
  state.pollsCol = collection(state.gref, 'polls');
  state.trashCol = collection(state.gref, 'trash');
  $('auth').classList.add('hidden'); $('app').classList.remove('hidden');

  unsubs.push(onSnapshot(state.gref, d => {
    state.group = d.data() || {};
    emit('group');
  }));
  unsubs.push(onSnapshot(query(state.songsCol, orderBy('created', 'desc')), s => {
    state.songs = s.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('songs');
  }, e => msg($('songFb'), '⚠️ ' + e.message)));
  unsubs.push(onSnapshot(query(state.eventsCol, orderBy('date', 'asc')), s => {
    state.events = s.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('events');
  }, e => msg($('eventFb'), '⚠️ ' + e.message)));
  unsubs.push(onSnapshot(query(state.practicesCol, orderBy('date', 'asc')), s => {
    state.practices = s.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('practices');
  }, e => msg($('practiceFb'), '⚠️ ' + e.message)));
  unsubs.push(onSnapshot(query(state.membersCol, orderBy('created', 'asc')), s => {
    state.members = s.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('members');
  }, e => msg($('mbFb'), '⚠️ ' + e.message)));
  unsubs.push(onSnapshot(state.pollsCol, s => {
    state.polls = s.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('polls');
  }, e => console.warn('Polls unavailable:', e.message)));
  unsubs.push(onSnapshot(query(state.trashCol, orderBy('deleted', 'desc'), limit(100)), s => {
    state.trash = s.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('trash');
  }, e => console.warn('Recently-deleted unavailable:', e.message)));
  unsubs.push(listenNotifications());

  showPage(location.hash.replace('#', '') || 'home');
}

function leaveApp() {
  unsubs.forEach(u => u()); unsubs = [];
  state.currentUid = null;
  state.gref = state.songsCol = state.eventsCol = state.practicesCol = state.membersCol = state.notifCol = state.pollsCol = state.trashCol = null;
  state.songs = []; state.events = []; state.practices = []; state.members = []; state.notifications = []; state.polls = []; state.trash = [];
  state.group = {}; state.viewingId = null;
  emit('signedOut');
  ['aPass', 'aPass2', 'pCur', 'pNew', 'pNew2', 'resetConfirm'].forEach(id => $(id).value = '');
  setMode('in');   // always come back to the Log in tab (was stuck on Create group after signing up)
  $('app').classList.add('hidden'); $('auth').classList.remove('hidden');
}

export function initAuth() {
  $('tabIn').onclick = () => setMode('in');
  $('tabUp').onclick = () => setMode('up');
  $('authBtn').onclick = submitAuth;
  ['aUser', 'aPass', 'aPass2', 'aName'].forEach(id =>
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); }));

  // invite links look like  https://your-app/?group=thegroupusername
  const g = new URLSearchParams(location.search).get('group');
  if (g && /^[a-z0-9_-]{3,30}$/i.test(g)) $('aUser').value = g.toLowerCase();

  onAuthStateChanged(auth, user => {
    if (creating) return;
    if (user) enterApp(user); else leaveApp();
  });
}
