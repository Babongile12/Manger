// Everything to do with the 5-second recorded key.
// iPhones record AAC in an MP4 container; Android/desktop Chrome record WebM. We pick whatever
// THIS device supports, remember the format with the clip (audioMime), and play it back with it.
// (Clips are stored as base64 inside the song - fine for 5 seconds.)
import { $ } from './utils.js';
import { toast } from './notifications.js';

let audioBlob = null, audioMime = '', recorder = null, isRec = false, recTimer = null, recSecs = 0;

export const getAudio = () => audioBlob;
export const getAudioMime = () => audioBlob ? (audioMime || (audioBlob.type || 'audio/webm').split(';')[0]) : '';

export function pickMime() {
  if (!window.MediaRecorder) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']
    .find(t => MediaRecorder.isTypeSupported(t)) || '';
}

export function setAudio(blob, mime) {
  audioBlob = blob; audioMime = blob ? (mime || (blob.type || '').split(';')[0] || 'audio/webm') : '';
  setAudioUI();
}

export function b64ToBlob(b, mime) {
  const c = atob(b), a = new Uint8Array(c.length);
  for (let i = 0; i < c.length; i++) a[i] = c.charCodeAt(i);
  return new Blob([a], { type: mime || 'audio/webm' });
}

export const blobToB64 = b => new Promise(r => {
  const f = new FileReader();
  f.onloadend = () => r(f.result.split(',')[1]);
  f.readAsDataURL(b);
});

export function playBlob(blob) {
  const a = new Audio(URL.createObjectURL(blob));
  a.play().catch(() => toast('🔇 This recording could not be played on this device (it may have been recorded in a format this phone does not support).'));
}

function setAudioUI() {
  $('playBtn').disabled = $('clearAudioBtn').disabled = !audioBlob;
  $('audioStatus').textContent = audioBlob ? '✅ Audio ready' : 'No recording';
  $('timer').textContent = '0.0s / 5s';
}

async function startRec() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      audioMime = (recorder.mimeType || mime || 'audio/webm').split(';')[0];
      audioBlob = new Blob(chunks, { type: audioMime });
      isRec = false; clearInterval(recTimer);
      $('recordBtn').textContent = '🔴 Record';
      stream.getTracks().forEach(t => t.stop());
      const t = $('timer').textContent;
      setAudioUI(); $('timer').textContent = t;
      $('audioStatus').textContent = '✅ Recording saved!';
    };
    recorder.start(); isRec = true; recSecs = 0;
    $('recordBtn').textContent = '⏹️ Stop';
    $('audioStatus').textContent = '🎤 Recording...';
    recTimer = setInterval(() => {
      recSecs += 0.1;
      $('timer').textContent = Math.min(recSecs, 5).toFixed(1) + 's / 5s';
      if (recSecs >= 5 && recorder.state === 'recording') recorder.stop();
    }, 100);
  } catch (e) {
    alert('Microphone access denied or unavailable. Please allow microphone permissions to record a key.');
  }
}

export function initAudio() {
  $('recordBtn').onclick = () => {
    if (isRec) { if (recorder.state === 'recording') recorder.stop(); }
    else startRec();
  };
  $('playBtn').onclick = () => { if (audioBlob) playBlob(audioBlob); };
  $('clearAudioBtn').onclick = () => {
    if (confirm('Remove the recorded audio?')) { audioBlob = null; audioMime = ''; setAudioUI(); }
  };
}
