// Group picture / icon. Stored as a small (192px) image inside the group document,
// so no extra storage service is needed and it works offline.
import { updateDoc } from 'firebase/firestore';
import { $, msg } from './utils.js';
import { state, on } from './state.js';

function toIcon(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'), m = Math.min(img.width, img.height);
      x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
      x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);   // centre-crop to a square
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that picture.')); };
    img.src = url;
  });
}

export function renderIcon() {
  const icon = state.group.icon;
  $('gIcon').classList.toggle('hidden', !icon); if (icon) $('gIcon').src = icon;
  $('gEmoji').classList.toggle('hidden', !!icon);
  $('iconPreview').classList.toggle('hidden', !icon); if (icon) $('iconPreview').src = icon;
  $('iconEmoji').classList.toggle('hidden', !!icon);
  $('iconRemove').classList.toggle('hidden', !icon);
}

export function initIcon() {
  $('iconFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return msg($('iconFb'), '⚠️ Please choose a picture file.');
    try {
      const data = await toIcon(f);
      await updateDoc(state.gref, { icon: data });
      msg($('iconFb'), '✅ Group picture updated!', true, 3000);
    } catch (err) { msg($('iconFb'), '⚠️ ' + err.message); }
  };
  $('iconRemove').onclick = async () => {
    try { await updateDoc(state.gref, { icon: null }); msg($('iconFb'), '✅ Picture removed.', true, 3000); }
    catch (err) { msg($('iconFb'), '⚠️ ' + err.message); }
  };
  on('group', renderIcon);
  on('signedOut', renderIcon);
}
