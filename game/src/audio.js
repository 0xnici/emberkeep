// All of EMBERKEEP's sound is synthesised with WebAudio: no audio files, no
// network. The context is created on the first user gesture (browsers refuse
// one sooner), every call is safe before that, and M toggles a mute that the
// HUD shows. Screenshot scenes never start the audio.

let context = null;
let muted = false;

export function unlockAudio() {
  if (context !== null) {
    if (context.state === 'suspended') context.resume();
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  context = new Ctor();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

/** One soft tone: a sine that swells and fades, the game's only instrument. */
function tone(freqFrom, freqTo, seconds, gainPeak, type = 'sine', delay = 0) {
  if (context === null || muted) return;
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), start + seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + seconds * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

/** Filtered noise for gusts and ash bursts: a short whoosh through a band-pass. */
function noise(seconds, freqFrom, freqTo, gainPeak, delay = 0) {
  if (context === null || muted) return;
  const start = context.currentTime + delay;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(freqFrom, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqTo), start + seconds);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + seconds * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
}

export const sfx = {
  gust() { noise(0.22, 500, 1800, 0.16); },
  feed(combo) { tone(520 + combo * 60, 880 + combo * 60, 0.16, 0.12); },
  gilded() { tone(880, 1320, 0.22, 0.13); tone(1320, 1760, 0.3, 0.08, 'sine', 0.07); },
  fiendHit() { tone(160, 55, 0.3, 0.22, 'sawtooth'); noise(0.25, 900, 200, 0.14); },
  blown() { noise(0.3, 1400, 300, 0.1); tone(300, 620, 0.14, 0.06); },
  split() { tone(240, 420, 0.1, 0.08, 'square'); },
  wave() { tone(392, 392, 0.16, 0.1); tone(523, 523, 0.22, 0.1, 'sine', 0.13); },
  dawn() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.34, 0.1, 'sine', i * 0.11)); },
  over() { [440, 349, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.32, 0.1, 'sine', i * 0.13)); },
};
