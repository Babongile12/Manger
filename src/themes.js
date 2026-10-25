import { updateDoc } from 'firebase/firestore';
import { $, esc } from './utils.js';
import { state, on } from './state.js';

export const THEMES = {
  brown:  {n:'Brown & Gold', bg:'#F9F6F0',cd:'#F3EBE1',bd:'#D4C5B2',mu:'#5C4A3A',tx:'#1A1A1A',inp:'#FFFFFF',hd:'#4A2C2A',d1:'#4A2C2A',d2:'#2A1A18',ac:'#A67B5B'},
  ocean:  {n:'Ocean Blue',   bg:'#F2F7FB',cd:'#E4EEF6',bd:'#BFD3E4',mu:'#3E5468',tx:'#14202B',inp:'#FFFFFF',hd:'#15405F',d1:'#15405F',d2:'#0B2438',ac:'#4A9BD1'},
  forest: {n:'Forest Green', bg:'#F4F8F2',cd:'#E6EFE1',bd:'#C3D5BB',mu:'#41563C',tx:'#15200F',inp:'#FFFFFF',hd:'#1F4D2B',d1:'#1F4D2B',d2:'#12301A',ac:'#6BAF5B'},
  purple: {n:'Royal Purple', bg:'#F7F4FB',cd:'#ECE5F5',bd:'#D3C7E4',mu:'#54416B',tx:'#1D1426',inp:'#FFFFFF',hd:'#4B2A75',d1:'#4B2A75',d2:'#2D1848',ac:'#9B72CF'},
  night:  {n:'Night',        bg:'#15171C',cd:'#1F232B',bd:'#3A4050',mu:'#B3B8C4',tx:'#EEEEEE',inp:'#2A2F3A',hd:'#E8D9B5',d1:'#2D3342',d2:'#0E1014',ac:'#D9B15C'}
};

export function applyTheme(k) {
  const t = THEMES[k] || THEMES.brown;
  for (const a in t) if (a !== 'n') document.documentElement.style.setProperty('--' + a, t[a]);
}

export function renderThemes() {
  const cur = state.group.theme || 'brown';
  $('themeList').innerHTML = Object.entries(THEMES).map(([k, t]) =>
    `<button class="sw ${k === cur ? 'on' : ''}" data-action="setTheme" data-id="${k}"><i style="background:linear-gradient(90deg,${t.d1} 60%,${t.ac} 60%)"></i>${esc(t.n)}</button>`).join('');
}

export async function setTheme(k) {
  applyTheme(k);
  try { await updateDoc(state.gref, { theme: k }); } catch (e) { alert(e.message); }
}

export function initThemes() {
  on('group', () => { applyTheme(state.group.theme); renderThemes(); });
  on('signedOut', () => applyTheme('brown'));
  renderThemes();
}
