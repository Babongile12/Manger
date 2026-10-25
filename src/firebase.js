import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from './config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline mode: songs, events etc. are cached on the device so lyrics and setlists open
// without signal. Changes made offline are saved on the device and sync automatically later.
let _db;
try {
  _db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  console.warn('Offline cache unavailable, using online-only mode:', e.message);
  _db = getFirestore(app);
}
export const db = _db;
