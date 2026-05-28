# Synth Patches: Every Slot Sound in Tone.js

Every sound is a function that returns a configured Tone.js synth or plays immediately and disposes. Fire-and-forget sounds use `dispose()` after the envelope ends. Sustained sounds return the synth for external control.

## Reel tick (per-reel stop sound)

Short metallic click, different pitch per reel for variety:

```javascript
import * as Tone from 'tone';

function playReelTick(reelIndex = 0) {
  const pitches = ['G4', 'A4', 'B4', 'D5', 'E5'];
  const synth = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).toDestination();
  synth.volume.value = -14;
  synth.triggerAttackRelease(pitches[reelIndex % 5], '16n');
  setTimeout(() => synth.dispose(), 300);
}
```

## Reel stop thud

Heavier, more substantial landing sound:

```javascript
function playReelStop(reelIndex = 0) {
  const membrane = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
  }).toDestination();
  membrane.volume.value = -10;
  membrane.triggerAttackRelease('C2', '8n');

  // High tick layered on the low thud
  const tick = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  }).toDestination();
  tick.volume.value = -18;
  tick.triggerAttackRelease(['C5', 'D5', 'E5', 'G5', 'A5'][reelIndex], '32n');

  setTimeout(() => { membrane.dispose(); tick.dispose(); }, 400);
}
```

## Anticipation stinger (last reel slowing down)

Rising tension tone that builds and holds:

```javascript
function playAnticipation() {
  const osc = new Tone.Oscillator({
    type: 'sawtooth',
    frequency: 200,
  });
  const filter = new Tone.Filter(300, 'lowpass').toDestination();
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.3, decay: 0.1, sustain: 0.8, release: 0.5,
  }).connect(filter);
  osc.connect(env);

  // Rise in pitch and filter cutoff over 1 second
  osc.frequency.rampTo(600, 1.2);
  filter.frequency.rampTo(2000, 1.2);
  env.volume.value = -16;

  osc.start();
  env.triggerAttack();

  // Returns a stop function
  return function stopAnticipation() {
    env.triggerRelease();
    setTimeout(() => { osc.stop(); osc.dispose(); filter.dispose(); env.dispose(); }, 600);
  };
}
```

## Near-miss deflation

The "close but no" sound — a brief descending tone:

```javascript
function playNearMiss() {
  const synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0, release: 0.1 },
  }).toDestination();
  synth.volume.value = -20;
  synth.frequency.setValueAtTime(600, Tone.now());
  synth.frequency.rampTo(200, 0.4);
  synth.triggerAttackRelease('C4', '4n');
  setTimeout(() => synth.dispose(), 800);
}
```

## Coin clink (multiple variants for natural randomness)

```javascript
function playCoinClink() {
  const freq = 800 + Math.random() * 800;  // randomize pitch
  const synth = new Tone.MetalSynth({
    frequency: freq,
    envelope: { attack: 0.001, decay: 0.15, release: 0.05 },
    harmonicity: 3.1 + Math.random() * 2,
    modulationIndex: 16,
    resonance: freq * 2,
    octaves: 1,
  }).toDestination();
  synth.volume.value = -16 + Math.random() * 4;
  synth.triggerAttackRelease(freq, '16n');
  setTimeout(() => synth.dispose(), 400);
}

// Burst of coins for win celebrations
function playCoinShower(count = 20, spread = 1.5) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => playCoinClink(), i * (spread * 1000 / count) + Math.random() * 50);
  }
}
```

## Scatter land (builds with each scatter)

```javascript
const SCATTER_PITCHES = [['E5', 'G5'], ['G5', 'B5', 'D6'], ['E5', 'G5', 'B5', 'E6']];

function playScatterLand(scatterCount) {
  const pitches = SCATTER_PITCHES[Math.min(scatterCount - 1, 2)];
  const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.4 }).toDestination();
  await reverb.generate();

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.8 },
  }).connect(reverb);
  synth.volume.value = -12;

  synth.triggerAttackRelease(pitches, '4n');

  // Shimmer layer
  const shimmer = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.05, decay: 0.6, sustain: 0, release: 0.3 },
  }).connect(reverb);
  shimmer.volume.value = -20;
  shimmer.triggerAttackRelease(pitches[pitches.length - 1], '2n',
    Tone.now() + 0.1);

  setTimeout(() => { synth.dispose(); shimmer.dispose(); reverb.dispose(); }, 2500);
}
```

## Win chimes by tier

```javascript
function playWinChime(tier) {
  const reverb = new Tone.Reverb({ decay: 2.0, wet: 0.3 }).toDestination();
  reverb.generate(); // async but ok — ready by the time chimes play

  if (tier === 'small') {
    // Single bright note
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.2 },
    }).connect(reverb);
    s.volume.value = -14;
    s.triggerAttackRelease('E6', '8n');
    setTimeout(() => { s.dispose(); reverb.dispose(); }, 1500);

  } else if (tier === 'medium') {
    // Ascending 3-note
    const s = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.3 },
    }).connect(reverb);
    s.volume.value = -12;
    const notes = ['C5', 'E5', 'G5'];
    notes.forEach((note, i) => {
      s.triggerAttackRelease(note, '8n', Tone.now() + i * 0.18);
    });
    setTimeout(() => { s.dispose(); reverb.dispose(); }, 2500);

  } else if (tier === 'big') {
    // Full ascending arpeggio + sustained chord
    const s = new Tone.PolySynth(Tone.Synth).connect(reverb);
    s.volume.value = -10;
    const arpNotes = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'];
    arpNotes.forEach((note, i) => {
      s.triggerAttackRelease(note, '8n', Tone.now() + i * 0.12);
    });
    // Final chord swell
    setTimeout(() => {
      s.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], '2n');
    }, arpNotes.length * 120);
    setTimeout(() => { s.dispose(); reverb.dispose(); }, 4000);
  }
}
```

## Bonus trigger fanfare

The most important sound in the game — must feel unmistakably celebratory:

```javascript
async function playBonusFanfare(genre = 'generic') {
  const reverb = new Tone.Reverb({ decay: 3.0, wet: 0.4 }).toDestination();
  await reverb.generate();

  const dist = new Tone.Distortion(0.1).connect(reverb);
  const poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.5 },
  }).connect(dist);
  poly.volume.value = -8;

  const fanfare = [
    { notes: ['C4', 'E4', 'G4'],       time: 0,    dur: '4n' },
    { notes: ['E4', 'G4', 'B4'],       time: 0.3,  dur: '4n' },
    { notes: ['G4', 'B4', 'D5'],       time: 0.6,  dur: '4n' },
    { notes: ['C4', 'E4', 'G4', 'C5'], time: 0.9,  dur: '2n' },
  ];

  fanfare.forEach(({ notes, time, dur }) => {
    poly.triggerAttackRelease(notes, dur, Tone.now() + time);
  });

  // Coin shower audio
  setTimeout(() => playCoinShower(40, 2.0), 800);

  setTimeout(() => { poly.dispose(); dist.dispose(); reverb.dispose(); }, 5000);
}
```

## Spin button click

Satisfying, premium, brief:

```javascript
function playSpinClick() {
  const s = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
  }).toDestination();
  s.volume.value = -22;
  s.triggerAttackRelease('C4', '32n');
  setTimeout(() => s.dispose(), 200);
}
```

## Applying genre flavor

The patches above are genre-neutral. To theme them:
- **Egyptian**: Filter all synths through `Tone.Filter(800, 'lowpass')` for a dusty, muffled quality. Use `AMSynth` oscillators for a reed instrument feel.
- **Cyberpunk**: Add a `Tone.BitCrusher(8)` in the chain for digital grit. Use detuned `sawtooth` oscillators in pairs.
- **Asian**: Use pentatonic note sets only (C D E G A). Add `Tone.PitchShift` vibrato effect.
- **Underwater**: Heavy reverb, chorus (`Tone.Chorus`), slow modulation. Pitch everything down one octave.
- **Fantasy**: Use `triangle` oscillators for warmth. Add a `Tone.Chorus` with slow rate for shimmer.

See `genre-audio-moods.md` for complete per-genre sound design specifications.
