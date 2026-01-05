// Web Audio API Synthesizer with Lookahead Scheduler

let audioCtx: AudioContext | null = null;
let isMuted = false;

// Scheduling state
let nextNoteTime = 0.0;
let timerID: number | null = null;
let current16thNote = 0;
const notesInQueue: { note: number; time: number }[] = [];
const lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
const scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)

// Music Patterns (8-bit style)
// Simple repeating bassline
const BASS_LINE = [
  110, 0, 110, 0, 110, 0, 130.81, 0, // A2 -> C3
  98, 0, 98, 0, 98, 0, 87.31, 0      // G2 -> F2
];

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// --- Scheduler Logic ---

function nextNote() {
  const secondsPerBeat = 60.0 / 220.0; // 220 BPM (Fast 8-bit tempo)
  nextNoteTime += 0.25 * secondsPerBeat; // Advance 16th note
  current16thNote++;
  if (current16thNote === 16) {
    current16thNote = 0;
  }
}

function scheduleNote(beatNumber: number, time: number) {
  if (!audioCtx || isMuted) return;
  notesInQueue.push({ note: beatNumber, time: time });

  // Play Bass
  const freq = BASS_LINE[beatNumber];
  if (freq > 0) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = freq;
    
    // Short, punchy envelope
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 0.12);
  }

  // Random High Arpeggios (Bleeps)
  if (beatNumber % 4 === 0 && Math.random() > 0.4) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    // Pentatonic-ish random notes
    const arps = [440, 523.25, 659.25, 783.99, 880]; 
    const note = arps[Math.floor(Math.random() * arps.length)];
    
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.04, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
  }
}

function scheduler() {
  if (!audioCtx) return;
  // while there are notes that will need to play before the next interval, 
  // schedule them and advance the pointer.
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote(current16thNote, nextNoteTime);
    nextNote();
  }
  timerID = window.setTimeout(scheduler, lookahead);
}

export const startMusic = () => {
  const ctx = initAudio();
  if (!ctx || isMuted || timerID) return; // Already playing or muted

  if (ctx.state === 'suspended') ctx.resume();

  current16thNote = 0;
  nextNoteTime = ctx.currentTime + 0.05;
  scheduler();
};

export const stopMusic = () => {
  if (timerID) {
    window.clearTimeout(timerID);
    timerID = null;
  }
};

export const updateMusicIntensity = (intensity: number) => {
  // Can be used to change tempo or add layers in future
};

// --- Sound Effects ---

export const playBlastSound = () => {
  const ctx = initAudio();
  if (!ctx || isMuted) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // "Pew" sound - fast pitch drop
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.08, ctx.currentTime); 
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

export const playPowerUpSound = () => {
  const ctx = initAudio();
  if (!ctx || isMuted) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1);
  osc.frequency.linearRampToValueAtTime(1760, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
};

export const playBiteSound = () => {
  const ctx = initAudio();
  if (!ctx || isMuted) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Distinct "Uh oh" / Damage buzzer
  osc.type = 'sawtooth';
  // Drop pitch sharply from mid-low to low
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

  // Harder attack, louder volume than before
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

export const toggleMute = () => {
  isMuted = !isMuted;
  const ctx = initAudio();
  if (ctx) {
      if (isMuted) {
        ctx.suspend();
        stopMusic();
      } else {
        ctx.resume();
        // If we were supposed to be playing (e.g. game active), the engine will call startMusic,
        // but we can't easily know strictly from here. 
        // Best to let the UI toggle handle logic or just resume context.
      }
  }
  return isMuted;
};