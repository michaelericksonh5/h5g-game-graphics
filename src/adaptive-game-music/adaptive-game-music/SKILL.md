---
name: adaptive-game-music
description: Compose and synthesize adaptive background music for slot machines and casino games that reacts to game state — base game ambient, spin intensity layer, bonus round music, anticipation builds, jackpot swell. All synthesized in code with Tone.js. Use when the user wants background music, a game soundtrack, music that changes during free spins or bonus, or theme-matched musical mood. Triggers for "background music", "game music", "adaptive music", "casino soundtrack", "bonus music", "free spins music", or any request for music that responds to gameplay. Works alongside procedural-sfx-design (which handles event sounds) to form a complete audio layer.
---

# Adaptive Game Music

Layered synthesized music that changes with game state. No MP3s. Stems add and drop on state transitions.

## Architecture: stems, not tracks

Never play a single loop. A stem-based architecture crossfades layers:

```javascript
class SlotMusicEngine {
  #stems = {};
  #transport = Tone.getTransport();

  constructor(genre = 'generic') {
    this.genre = genre;
    this.buildStems();
  }

  buildStems() {
    // Each stem is a Tone.js pattern/sequence playing through the same effects chain
    const reverb = new Tone.Reverb({ decay: 2.0, wet: 0.25 }).toDestination();
    const limiter = new Tone.Limiter(-2).connect(reverb);

    this.#stems = {
      ambient: this.buildAmbientStem(limiter),  // always playing, low
      rhythm:  this.buildRhythmStem(limiter),   // enters during spin
      melody:  this.buildMelodyStem(limiter),   // enters during bonus
      tension: this.buildTensionStem(limiter),  // enters during anticipation
    };

    // Start transport — all stems sync to it
    this.#transport.bpm.value = GENRE_TEMPO[this.genre] || 120;
    this.#transport.start();

    // Only ambient plays at start
    this.#stems.ambient.volume = -12;
    this.#stems.rhythm.volume  = -Infinity;
    this.#stems.melody.volume  = -Infinity;
    this.#stems.tension.volume = -Infinity;
  }

  // State transition methods — call these from the game state machine
  onSpinStart()      { this.fadeStem('rhythm', -8, 0.3); }
  onSpinEnd()        { this.fadeStem('rhythm', -Infinity, 0.5); }
  onAnticipation()   { this.fadeStem('tension', -10, 0.4); }
  onAnticipationEnd(){ this.fadeStem('tension', -Infinity, 0.6); }
  onBonusEnter()     { this.fadeStem('ambient', -Infinity, 1.0); this.fadeStem('melody', -6, 1.0); this.#transport.bpm.rampTo(GENRE_TEMPO[this.genre] * 1.15, 2); }
  onBonusExit()      { this.fadeStem('melody', -Infinity, 1.5); this.fadeStem('ambient', -12, 1.5); this.#transport.bpm.rampTo(GENRE_TEMPO[this.genre], 3); }

  fadeStem(name, targetVol, duration) {
    const stem = this.#stems[name];
    if (!stem) return;
    Tone.getTransport().scheduleOnce(time => {
      stem.volume.rampTo(targetVol, duration, time);
    }, '+0');
  }
}
```

## Genre tempo map

```javascript
const GENRE_TEMPO = {
  egyptian:   96,
  cyberpunk: 128,
  asian:     104,
  fantasy:    88,
  underwater: 80,
  vegas:     120,
  scifi:     116,
  retro:     140,
};
```

## Building the ambient stem (per genre)

The ambient stem is always on. It establishes the mood before any interaction.

**Egyptian — droning reeds over sustained strings:**
```javascript
function buildEgyptianAmbient(output) {
  const drone = new Tone.Synth({
    oscillator: { type: 'custom', partials: [1, 0.5, 0.25, 0.1] },
    envelope: { attack: 2, decay: 0, sustain: 1, release: 3 },
  }).connect(output);

  // Sustained tonic drone
  drone.triggerAttack('C2');

  // Slow pentatonic phrase
  const melody = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.3, decay: 0.8, sustain: 0.4, release: 1.0 },
  }).connect(output);
  melody.volume.value = -20;

  const pattern = new Tone.Pattern(
    (time, note) => melody.triggerAttackRelease(note, '2n', time),
    ['C4', 'D4', 'F4', 'G4', 'A4', 'G4', 'F4', 'D4'],
    'random'
  );
  pattern.interval = '2n';
  pattern.start(0);

  return { volume: drone.volume, pattern };
}
```

**Cyberpunk — detuned pad with LFO:**
```javascript
function buildCyberpunkAmbient(output) {
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.5 },
    portamento: 0.1,
  });

  const chorus  = new Tone.Chorus(0.3, 3, 0.7).start();
  const filter  = new Tone.Filter(800, 'lowpass');
  const lfo     = new Tone.LFO(0.08, 400, 1600).start();
  lfo.connect(filter.frequency);
  pad.chain(chorus, filter, output);

  // Minor 7 chord drone
  pad.triggerAttack(['C3', 'Eb3', 'G3', 'Bb3']);

  return { volume: pad.volume };
}
```

**Underwater — slow evolving ambience:**
```javascript
function buildUnderwaterAmbient(output) {
  const osc1 = new Tone.Oscillator({ type: 'sine', frequency: 110 }).start();
  const osc2 = new Tone.Oscillator({ type: 'sine', frequency: 111.5 }).start(); // slight detune
  const gain  = new Tone.Gain(0.2);
  const reverb = new Tone.Reverb({ decay: 8.0, wet: 0.7 }).connect(output);
  const filter = new Tone.Filter(600, 'lowpass').connect(reverb);
  const lfo    = new Tone.LFO(0.05, 400, 800).start();
  lfo.connect(filter.frequency);

  osc1.chain(gain, filter);
  osc2.chain(gain, filter);

  return { volume: gain.gain };
}
```

## Building the rhythm stem

Enters when reels spin. Gives the sense of motion:

```javascript
function buildRhythmStem(genre, output) {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05, octaves: 5,
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
  }).connect(output);
  kick.volume.value = -14;

  // 4-on-the-floor at genre tempo
  const pattern = new Tone.Sequence(
    time => kick.triggerAttackRelease('C1', '8n', time),
    [0, null, null, null, 0, null, null, null],
    '8n'
  );
  pattern.start(0);
  return { volume: kick.volume, pattern };
}
```

## Tension stem (anticipation)

A rising, unresolved tone that builds when the last reel slows:

```javascript
function buildTensionStem(output) {
  const osc = new Tone.Oscillator({ type: 'sawtooth', frequency: 220 });
  const filter = new Tone.Filter(400, 'bandpass');
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.3, decay: 0, sustain: 1, release: 0.8,
  });
  const reverb = new Tone.Reverb({ decay: 1.0, wet: 0.4 }).connect(output);

  osc.chain(filter, env, reverb);
  osc.start();
  env.triggerAttack();

  // Rising frequency for tension
  osc.frequency.rampTo(440, 1.5);
  filter.frequency.rampTo(2000, 1.5);

  return {
    volume: env.volume,
    release: () => { env.triggerRelease(); osc.frequency.rampTo(220, 0.8); },
  };
}
```

## References

- `references/genre-audio-moods.md` — instrument palettes, scale choices, tempo ranges, and pattern recipes for all 10 genres
- `references/stem-mixing.md` — frequency management so stems don't clash, EQ patterns, sidechain compression for dynamic mixing
