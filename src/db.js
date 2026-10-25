// With offline mode on, Firestore only confirms a write once the server has it, so a save made
// without signal would "hang". These wrappers wait up to 4 seconds; after that the change is
// treated as saved-on-this-device (it syncs by itself later) and we tell the user.
import * as fs from 'firebase/firestore';
import { toast } from './notifications.js';

const WAIT = 4000;
function settle(p) {
  p.catch(() => {});   // never leave an unhandled rejection if it fails after we stopped waiting
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { toast('📴 Saved on this device. It will sync when you are back online.'); resolve(undefined); }, WAIT);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
export const addDoc = (...a) => settle(fs.addDoc(...a));
export const setDoc = (...a) => settle(fs.setDoc(...a));
export const updateDoc = (...a) => settle(fs.updateDoc(...a));
export const deleteDoc = (...a) => settle(fs.deleteDoc(...a));
