// "Coming / Maybe / Can't make it" for upcoming practices and events.
import { updateDoc } from './db.js';
import { doc } from 'firebase/firestore';
import { esc, todayStr } from './utils.js';
import { state } from './state.js';
import { getMeId } from './identity.js';

export function rsvpHtml(kind, item) {
  if (!item || item.date < todayStr()) return '';
  const me = getMeId(), r = item.rsvp || {}, ms = state.members, mine = me ? r[me] : null;
  const names = a => ms.filter(m => r[m.id] === a).map(m => m.name);
  const yes = names('yes'), maybe = names('maybe'), no = names('no'), none = ms.filter(m => !r[m.id]).map(m => m.name);
  const btn = (a, label) => `<button class="btn sm ${mine === a ? 'b-ok' : 'b-dk'}" data-action="rsvp" data-id="${kind}|${esc(item.id)}|${a}">${label}</button>`;
  const top = !ms.length ? '<span class="mu">Add members first to collect replies.</span>'
    : me ? `<div class="acts">${btn('yes', '✅ Coming')}${btn('maybe', '❓ Maybe')}${btn('no', "❌ Can't")}</div>`
    : `<button class="btn b-pri sm" data-action="pickMe">🙋 Who are you? (needed to reply)</button>`;
  const list = (t, a) => a.length ? `<div><strong>${t} (${a.length}):</strong> ${a.map(esc).join(', ')}</div>` : '';
  return `<div class="rsvp"><strong>Will you be there?</strong>
    <div class="rsvpsum">✅ ${yes.length} coming • ❓ ${maybe.length} maybe • ❌ ${no.length} can't • ⏳ ${none.length} not replied</div>${top}
    ${ms.length ? `<details><summary>See who</summary>${list('Coming', yes)}${list('Maybe', maybe)}${list("Can't", no)}${list('Not replied', none)}</details>` : ''}</div>`;
}

export async function setRsvp(arg) {
  const [kind, id, ans] = (arg || '').split('|'), me = getMeId();
  if (!me || !['yes', 'maybe', 'no'].includes(ans)) return;
  const col = kind === 'practice' ? state.practicesCol : state.eventsCol;
  try { await updateDoc(doc(col, id), { ['rsvp.' + me]: ans }); } catch (e) { alert('Could not save your reply: ' + e.message); }
}
