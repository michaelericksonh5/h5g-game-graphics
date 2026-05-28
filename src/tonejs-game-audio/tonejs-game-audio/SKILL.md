---
name: tonejs-game-audio
description: The Tone.js audio FOUNDATION for slot and casino games — Web Audio unlock/resume, the AudioContext lifecycle, Tone.Transport, the master bus and effects chain, load-time synth initialization, and the audio event-map that wires every game event to a sound. Use this FIRST to stand up the audio layer of a game, or for "web audio", "audio setup", "audio unlock", "mobile audio", "Tone.js", "audio context". This skill owns setup and routing, NOT the sounds themselves: for individual event sound effects (reel ticks, win chimes, coin clinks, stingers) use procedural-sfx-design; for adaptive background music and stems use adaptive-game-music. Load alongside pixijs-slot-graphics or threejs-game-3d when building a complete game.
---

# Tone.js Game Audio

Build all slot machine audio in code — no MP3s, no licensing, no loading delays. Every sound synthesized from Tone.js primitives.

## Critical: mobile audio unlock

Web Audio requires a user gesture before it can play. Handle this at game startup or it silently fails on every mobile device:

```javascript
import * as Tone from 'tone';

// Wire this to your first user interaction — the spin button tap,
// a "tap to start" overlay, or any pointertap event.
async function unlockAudio() {
  await Tone.start();
  console.log('Audio context running:', Tone.context.state);
}
spinButton.addEventListener('pointertap', unlockAudio, { once: true });
```

This is not optional. On iOS Safari specifically, audio context creation requires a direct user gesture. The `{ once: true }` means you only unlock once and the game handles the rest.

## Decode all sounds at load time

Don't synthesize on first trigger — that causes a frame stall. Initialize all synths and effects during the loading screen:

```javascript
const sfx = {};

async function initAudio() {
  await Tone.start();
  sfx.reelTick  = makeReelTick();
  sfx.reelStop  = makeReelStop();
  sfx.winSmall  = makeWinChime('small');
  sfx.winBig    = makeWinChime('big');
  sfx.scatter   = makeScatterLand();
  sfx.anticipation = makeAnticipationStinger();
  sfx.bonusTrigger = makeBonusFanfare();
  // etc.
}
```

## The audio event map

Every game event has a sound. Wire all of these:

| Event | Sound | Priority |
|---|---|---|
| Spin button press | Short click/tap | High |
| Reel spin start | Whoosh/whir start | High |
| Per-reel stop tick | Metallic click per reel | High |
| Anticipation (last reel slow) | Rising tone, slowing | High |
| Near-miss deflation | Brief descending tone | Medium |
| Small win | 1-3 coin clinks + single chime | High |
| Medium win | Ascending 3-note phrase | High |
| Big win | Arpeggio + sustained note | High |
| Mega win | Full orchestral swell entry | High |
| Win counter rolling | Rapid tick accelerating | High |
| Scatter land (1st) | Sparkle chime | High |
| Scatter land (2nd) | Higher sparkle + harmonic | High |
| Scatter land (3rd = trigger) | Swell + confirmation chord | High |
| Wild land | Magical shimmer burst | Medium |
| Bonus trigger | Fanfare + theme sting | High |
| Free spins each spin | Lighter version of base spin | Medium |
| Bet up/down | Short click tones | Medium |
| Button press | Subtle UI click | Low |

Read `references/synth-patches.md` for the Tone.js implementation of each.

## Background music architecture

Slot music has two layers that crossfade on state change:

```javascript
class SlotMusicEngine {
  constructor() {
    // Base ambient loop — always playing at low volume in base game
    this.baseDrone   = new Tone.Player({ loop: true }).toDestination();
    // Spin loop — rhythmic, enters when reels are spinning
    this.spinLayer   = new Tone.Player({ loop: true }).toDestination();
    // Bonus loop — enters during free spins / bonus mode
    this.bonusLayer  = new Tone.Player({ loop: true }).toDestination();

    this.spinLayer.volume.value = -Infinity;  // muted to start
    this.bonusLayer.volume.value = -Infinity;
  }

  enterSpin() {
    this.spinLayer.volume.rampTo(-6, 0.3);  // fade in over 300ms
  }
  exitSpin() {
    this.spinLayer.volume.rampTo(-Infinity, 0.5);
  }
  enterBonus() {
    this.baseDrone.volume.rampTo(-Infinity, 1.0);
    this.bonusLayer.volume.rampTo(-3, 1.0);
  }
  exitBonus() {
    this.bonusLayer.volume.rampTo(-Infinity, 1.0);
    this.baseDrone.volume.rampTo(-12, 1.0);
  }
}
```

For fully synthesized (no sampled audio files) music, use Tone.Transport + sequenced patterns. The sequenced-pattern architecture per genre is owned by the `adaptive-game-music` skill — defer to it for stem mixing, state transitions, and generative loops rather than building music here.

## Win counter audio

The win counter rollup sound is crucial — it's what makes players feel like they're accumulating money:

```javascript
function playWinCounter(totalWin, duration) {
  const metro = new Tone.Sequence(
    (time) => {
      const click = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
      }).toDestination();
      click.triggerAttackRelease('C5', '32n', time);
      click.dispose();  // dispose after use
    },
    [null],  // single hit per step
    '32n'
  );

  // Accelerate then decelerate
  Tone.Transport.bpm.value = 120;
  Tone.Transport.bpm.rampTo(280, duration * 0.6);
  Tone.Transport.bpm.rampTo(80, duration * 0.4);

  metro.start();
  setTimeout(() => metro.stop(), duration * 1000);
}
```

## Effects chain: reverb and spatial feel

Raw synths sound cheap without a reverb tail. Two presets:

```javascript
// Small space — for UI clicks, reel stops (tight, precise)
const roomReverb = new Tone.Reverb({ decay: 0.4, wet: 0.2 }).toDestination();

// Large space — for win fanfares, bonus triggers (epic, spatial)
const hallReverb = new Tone.Reverb({ decay: 3.5, wet: 0.35 }).toDestination();

// Reverb takes a moment to generate its IR — await it before use
await roomReverb.generate();
await hallReverb.generate();

// Stereo widener for richness on headphones
const widener = new Tone.StereoWidener(0.6).toDestination();
```

## References

- `references/synth-patches.md` — Tone.js implementation of every slot sound: reel tick, stop thud, scatter chimes, win tier arpeggio, anticipation stinger, bonus fanfare, coin clinks
- For sequenced/generative background music, stem mixing, and state transitions → the `adaptive-game-music` skill (its stem-mixing and genre-audio-moods references)
- For instrument/timbre palettes per genre (Egyptian reed synths, cyberpunk pads, Asian pentatonic, underwater ambience) → the `adaptive-game-music` skill's genre-audio-moods reference
- `references/mobile-audio-quirks.md` — iOS unlock patterns, AudioContext resumption after backgrounding, decoding performance
