import './styles/main.css';

import { initThemes, setTheme } from './themes.js';
import { initNav, showPage } from './nav.js';
import { initAudio } from './audio.js';
import { initSongs, viewSong, editSong, deleteSong, playAudio, playNoteFor, toggleFav, setFilter } from './songs.js';
import { initEvents, editEvent, deleteEvent, copyEvent, toggleSong, moveSong, unpick } from './events.js';
import { initPractice, viewPractice, editPractice, deletePractice, togglePresent } from './practice.js';
import { initMembers, editMember, deleteMember } from './members.js';
import { initIcon } from './icon.js';
import { initNotifications } from './notifications.js';
import { initReminders } from './reminders.js';
import { initIdentity, pickMe } from './identity.js';
import { initRoles } from './roles.js';
import { initTrash, restoreItem } from './trash.js';
import { initStage, stageEvent } from './stage.js';
import { initCommunity, votePoll, togglePoll, deletePoll, openAnn, openPoll } from './community.js';
import { setRsvp } from './rsvp.js';
import { shareItem, calItem, printEvent } from './share.js';
import { initHome } from './home.js';
import { initSettings } from './settings.js';
import { initAuth } from './auth.js';

/* One click listener for every button the app draws dynamically.
   Markup uses data-action="name" data-id="..." data-arg="..." instead of inline onclick. */
const actions = {
  showPage, viewSong, editSong, deleteSong, playAudio, editEvent, deleteEvent, moveSong, unpick, setTheme,
  viewPractice, editPractice, deletePractice, editMember, deleteMember,
  playNote: playNoteFor, toggleFav, songFilter: setFilter, copyEvent, stageEvent,
  shareItem, calItem, printEvent, rsvp: setRsvp, pickMe, vote: votePoll, togglePoll, deletePoll, openAnn, openPoll,
  restoreTrash: id => restoreItem(id)
};
// checkboxes fire on 'change' instead of 'click'
const changeActions = { toggleSong, togglePresent };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.dataset.action in changeActions) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el.dataset.id, el.dataset.arg);
});

document.addEventListener('change', e => {
  const el = e.target.closest('[data-action]');
  const fn = el && changeActions[el.dataset.action];
  if (fn) fn(el.dataset.id, el.checked);
});

// Order matters: songs -> events -> home, so lists render in the same order as before.
initThemes();
initNav();
initAudio();
initSongs();
initEvents();
initPractice();
initMembers();
initHome();
initIcon();
initNotifications();
initReminders();
initIdentity();
initRoles();
initTrash();
initStage();
initCommunity();
initSettings();
initAuth();
