# SFX Synth Patches

Tone.js patches for every discrete slot sound effect. These are *event* sounds (one-shots), distinct
from the looping music stems in the `adaptive-game-music` skill and the audio setup/transport in
`tonejs-game-audio`. Build these once at load (see the `tonejs-game-audio` init pattern) and trigger
on game events.

## Pattern: factory + trigger

Each patch is a factory returning `{ play(...) }`. Build all at load; never `new` a synth on first
trigger (causes a frame stall).

```javascript
function makeReelTick() {
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.008, octaves: 2,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  }).connect(sfxBus);
  return { play(t = Tone.now()) { synth.triggerAttackRelease('C3', '64n', t); } };
}
```

## Reel tick (per-symbol pass)

Short metallic click as symbols pass during spin. Slightly randomize pitch so a run of ticks isn't
robotic.

```javascript
function makeReelTickVaried() {
  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.03, release: 0.01 }, harmonicity: 5.1, resonance: 4000,
  }).connect(sfxBus);
  return { play(t = Tone.now()) { synth.frequency.value = 380 + Math.random()*60; synth.triggerAttackRelease('32n', t); } };
}
```

## Reel stop thud

Lower, weightier — the drum coming to rest. Pair with the visual settle bounce.

```javascript
function makeReelStop() {
  const synth = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 3,
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1 } }).connect(sfxBus);
  return { play(t = Tone.now()) { synth.triggerAttackRelease('G1', '8n', t); } };
}
```

## Anticipation stinger

Rising tone that *slows* — heightens the last-reel hold. Use a pitch ramp.

```javascript
function makeAnticipation() {
  const synth = new Tone.Synth({ oscillator:{ type:'sawtooth' },
    envelope:{ attack:0.05, decay:0.1, sustain:0.7, release:0.4 } }).connect(sfxBus);
  return { play(dur = 1.2, t = Tone.now()) {
    synth.triggerAttack('A3', t);
    synth.frequency.exponentialRampTo('E5', dur, t);
    synth.triggerRelease(t + dur);
  }};
}
```

## Near-miss deflation

Brief descending tone when the bonus *just* misses — players read it as "so close".

```javascript
function makeNearMiss() {
  const synth = new Tone.Synth({ oscillator:{ type:'triangle' },
    envelope:{ attack:0.01, decay:0.2, sustain:0, release:0.2 } }).connect(sfxBus);
  return { play(t = Tone.now()) { synth.triggerAttack('E5', t); synth.frequency.rampTo('A3', 0.35, t);
                                  synth.triggerRelease(t + 0.4); } };
}
```

## Coin clink (variants)

Pool 3–4 slightly different pitches and pick randomly so a shower doesn't sound like one repeated
sample.

```javascript
function makeCoinClink() {
  const synth = new Tone.MetalSynth({ harmonicity:8, resonance:6000, modulationIndex:20,
    envelope:{ attack:0.001, decay:0.12, release:0.05 } }).connect(sfxBus);
  const notes = ['C6','E6','G6','A6'];
  return { play(t = Tone.now()) { synth.frequency.value = Tone.Frequency(notes[Math.floor(Math.random()*notes.length)]).toFrequency();
                                  synth.triggerAttackRelease('32n', t); } };
}
```

## Scatter build (1st / 2nd / 3rd)

Each successive scatter lands higher and richer; the 3rd (trigger) adds a confirming chord.

```javascript
function makeScatterChimes() {
  const synth = new Tone.PolySynth(Tone.Synth, { oscillator:{ type:'triangle' },
    envelope:{ attack:0.005, decay:0.3, sustain:0.2, release:0.6 } }).connect(sfxBus);
  const steps = [['C5'], ['E5','G5'], ['C5','E5','G5','C6']];   // 1st, 2nd, 3rd
  return { play(index, t = Tone.now()) { synth.triggerAttackRelease(steps[Math.min(index,2)], '4n', t); } };
}
```

## Win tier arpeggio

Length/brightness scales with tier. Small = 2 notes; grand = full ascending run + sustain.

```javascript
function makeWinChime() {
  const synth = new Tone.PolySynth(Tone.Synth, { oscillator:{ type:'sawtooth' },
    envelope:{ attack:0.005, decay:0.2, sustain:0.3, release:0.5 } }).connect(sfxBus);
  const runs = { small:['C5','E5'], medium:['C5','E5','G5'], big:['C5','E5','G5','C6'],
                 mega:['C5','E5','G5','C6','E6'], grand:['C5','E5','G5','C6','E6','G6','C7'] };
  return { play(tier='small', t = Tone.now()) {
    runs[tier].forEach((n,i)=> synth.triggerAttackRelease(n, '8n', t + i*0.09)); } };
}
```

## Bonus fanfare

The big trigger moment — layered chord swell. Route through the hall reverb (see `tonejs-game-audio`).

```javascript
function makeBonusFanfare(hallReverb) {
  const synth = new Tone.PolySynth(Tone.Synth, { oscillator:{ type:'fatsawtooth' },
    envelope:{ attack:0.02, decay:0.3, sustain:0.6, release:1.2 } }).connect(hallReverb);
  return { play(t = Tone.now()) {
    synth.triggerAttackRelease(['C4','E4','G4'], '4n', t);
    synth.triggerAttackRelease(['G4','B4','D5'], '4n', t+0.25);
    synth.triggerAttackRelease(['C5','E5','G5','C6'], '2n', t+0.5); } };
}
```

## Button click (UI)

Subtle, low priority — must not fatigue over a long session.

```javascript
function makeUIClick() {
  const synth = new Tone.Synth({ oscillator:{ type:'square' },
    envelope:{ attack:0.001, decay:0.03, sustain:0, release:0.01 } }).connect(sfxBus);
  return { play(t = Tone.now()) { synth.triggerAttackRelease('C6', '64n', t); } };
}
```

## Genre flavor chains

Add a master send on `sfxBus` per theme so all SFX share a sonic identity:

- **Egyptian**: `new Tone.Filter(2200,'bandpass')` (dusty) + light reverb.
- **Cyberpunk**: `new Tone.BitCrusher(6)` + slap delay.
- **Underwater**: `new Tone.Chorus(2,3,0.5)` + low-pass at 1.2k.
- **Retro arcade**: `new Tone.BitCrusher(4)`, no reverb.

```javascript
const sfxBus = new Tone.Channel().toDestination();
// per-theme: sfxBus.chain(new Tone.Filter(2200,'bandpass'), Tone.Destination);
```

## Disposal

For polyphonic one-shots created ad hoc (rare — prefer pooled factories), `dispose()` after the tail.
Pooled factory synths persist for the session. Mix levels are in `mixing-guide.md`.
