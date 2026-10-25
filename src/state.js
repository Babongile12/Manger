// Shared app state + a tiny event bus so modules don't have to import each other in circles.
export const state = {
  gref: null,          // Firestore doc ref for this group
  songsCol: null,
  eventsCol: null,
  practicesCol: null,
  membersCol: null,
  notifCol: null,
  pollsCol: null,
  trashCol: null,
  currentUid: null,
  group: {},
  songs: [],
  events: [],
  practices: [],
  members: [],
  notifications: [],
  polls: [],
  trash: [],
  viewingId: null      // song currently open in the modal
};

const handlers = {};
export const on = (name, fn) => (handlers[name] ||= []).push(fn);
export const emit = (name, ...args) => (handlers[name] || []).forEach(fn => fn(...args));

/*  Events emitted:
    'group'          group document changed
    'songs'          songs list changed
    'events'         events list changed
    'practices'      practices list changed
    'members'        members list changed
    'notifications'  notification feed changed
    'polls'          polls changed
    'trash'          recently-deleted list changed
    'me'             this device's chosen member changed
    'signedOut'      user logged out (reset forms etc.)  */
