# Manger

Songs, events and setlists for choirs and worship groups. Vite + vanilla JS + Firebase (Auth + Firestore).

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/  (this is what Capacitor will wrap later)
npm run preview    # serve the built version locally
```
Needs Node 18+.

## Structure
```
index.html            page markup only
src/main.js           entry point, wires everything + click delegation
src/config.js         Firebase project config
src/firebase.js       initialises Firebase (auth, db)
src/state.js          shared state + tiny event bus
src/utils.js          $, esc, msg, date helpers
src/auth.js           login / sign-up / live data listeners
src/nav.js            page switching, online badge, header text
src/themes.js         the five colour themes
src/home.js           "next performance" page
src/songs.js          song library, song modal, add/edit/delete
src/audio.js          5-second key recorder  (next: make iPhone-safe)
src/events.js         events, song picker, setlist ordering
src/practice.js       practices: notes, reminders, attendance, next practice
src/members.js        group members (name, part, contact) - page not in the nav
src/icon.js           group picture (resized to 192px, stored in the group doc)
src/notifications.js  bell + toasts + 'notify()' used when events/practices change
src/reminders.js      'Practice today @14:30hrs' + birthday reminders while the app is open
src/db.js             writes that don't hang when offline (saved on device, sync later)
src/identity.js       "Who are you?" - links a phone to a member
src/roles.js          leader PIN / read-only member view (UI guard, not hacker-proof)
src/rsvp.js           Coming / Maybe / Can't replies for practices and events
src/stage.js          stage mode: big lyrics, auto-scroll, setlist navigation, wake lock
src/tone.js           plays the starting note from a song's Key
src/stats.js          last-sung, attendance %, birthdays
src/share.js          WhatsApp share, .ics calendar, print setlist, JSON backup, CSV
src/community.js      pinned announcement + polls
src/trash.js          "Recently deleted" (30 days) + Undo
public/privacy.html   privacy policy TEMPLATE - fill in the [PLACEHOLDERS]
public/manifest.webmanifest, public/sw.js, public/icons/*   makes the website installable + usable offline
src/install.js        'Install on this phone' card in Settings
src/settings.js       name, password, logout, reset group
src/styles/main.css   all styles
```

## Firestore rules
Data lives under `groups/{uid}/...` (songs, events, practices, members, notifications).
Your rules must allow the signed-in user to read/write everything under their own group, e.g.:
```
match /groups/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

## Before you publish
- Set `APP_URL` in `src/config.js` to your deployed address (used in invite messages).
- Fill in the [PLACEHOLDERS] in `public/privacy.html` and have it checked (POPIA, app stores).
- The Firestore rule above already covers polls, trash, members, practices and notifications.

## App icon
The icons in `public/icons/` are placeholders (gold M on brown). Replace them with your own logo using the SAME file names and sizes (192, 512, maskable 512, apple-touch-icon 180).
