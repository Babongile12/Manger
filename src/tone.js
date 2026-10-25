// Plays the starting note for a song straight from its Key field ("Ab", "F#m", "Bb minor"...).
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
let ctx = null;

export function parseKey(k) {
  const m = /^\s*([A-Ga-g])\s*([#b♯♭]?)/.exec(k || '');
  if (!m) return null;
  let s = SEMI[m[1].toUpperCase()];
  if (m[2] === '#' || m[2] === '♯') s++;
  if (m[2] === 'b' || m[2] === '♭') s--;
  return ((s % 12) + 12) % 12;
}
export const keyFreq = k => { const s = parseKey(k); return s == null ? null : 261.6256 * Math.pow(2, s / 12); };   // octave 4

export function playNote(k) {
  const f = keyFreq(k); if (f == null) return false;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  try {
    ctx = ctx || new AC(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6); g.connect(ctx.destination);
    [[f, 1], [f * 2, 0.25]].forEach(([fr, amp]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = fr; og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.7);
    });
    return true;
  } catch { return false; }
}
