---
name: procedural-sfx-design
description: "Synthesize all slot machine and casino game sound effects in code using Tone.js — reel ticks, stop thuds, scatter chimes, win tier audio, button clicks, coin clinks, bonus stingers. No MP3 files needed. Use when the user needs individual sound effects for specific game events: button presses, reel interactions, symbol landings, win sounds. Distinct from adaptive-game-music which handles background music and stems. Triggers for \"sound effects\", \"reel sounds\", \"click sounds\", \"coin sounds\", \"win sound\", \"button feedback\", \"sfx\", or any request to add reactive audio to specific game events."
---

# Procedural SFX Design

Every slot machine sound effect synthesized in Tone.js. No files, no loading, fully themeable.

## Core mobile unlock (always first)

```javascript
import * as Tone from 'tone';
// Wire to first user interaction
document.addEventListener('pointerdown', () => Tone.start(), { once: true });
```

## The SFX manager pattern

Initialize all sounds at load time. Never create synths inside event handlers:

```javascript
class SlotSFX {
  constructor() {
    this.roomReverb = new Tone.Reverb({ decay: 0.5, wet: 0.2 });
    this.hallReverb = new Tone.Reverb({ decay: 3.0, wet: 0.35 });

    Promise.all([
      this.roomReverb.generate(),
      this.hallReverb.generate(),
    ]).then(() => { this.ready = true; });
  }

  spinClick()  { /* short UI click — see synth-patches.md */ }
  reelTick(i)  { /* per-reel metallic click */ }
  reelStop(i)  { /* thud + tick layer */ }
  anticipation() { /* returns a stop() function */ }
  scatter(n)   { /* builds with count */ }
  win(tier)    { /* delegates to tonejs-game-audio win chimes */ }
  coinClink()  { /* randomized pitch clunk */ }
  bonusTrigger() { /* fanfare — delegates to tonejs-game-audio */ }
}

export const sfx = new SlotSFX();
```

See `tonejs-game-audio` references/synth-patches.md for the implementation of each method. This skill focuses on the architecture; `tonejs-game-audio` has the actual synthesis recipes.

## Genre flavor application

Every sound can be themed via effects chain:

```javascript
const GENRE_CHAIN = {
  egyptian: () => [
    new Tone.Filter(1200, 'lowpass'),     // dusty, muffled
    new Tone.Reverb({ decay: 1.8, wet: 0.3 }),
  ],
  cyberpunk: () => [
    new Tone.BitCrusher(6),               // digital grit
    new Tone.Distortion(0.15),
  ],
  underwater: () => [
    new Tone.Chorus(2, 3.5, 0.7).start(), // watery shimmer
    new Tone.Reverb({ decay: 4.0, wet: 0.5 }),
    new Tone.Filter(1800, 'lowpass'),
  ],
  fantasy: () => [
    new Tone.Chorus(1.5, 2, 0.5).start(),
    new Tone.Reverb({ decay: 2.5, wet: 0.4 }),
  ],
};

function buildChain(genre) {
  const nodes = GENRE_CHAIN[genre]?.() ?? [];
  // Connect in series, return input node
  if (!nodes.length) return Tone.getDestination();
  nodes.reduce((a, b) => { a.connect(b); return b; });
  nodes[nodes.length - 1].toDestination();
  return nodes[0];
}
```

## Volume mixing guide

All slot sounds must coexist. These relative volumes prevent any one layer from dominating:

| Sound | Volume (dBFS) | Notes |
|---|---|---|
| Spin button click | -22 | Near-silent — just tactile feedback |
| Reel tick (per-reel) | -14 | Prominent but brief |
| Reel stop thud | -10 | Satisfying weight |
| Anticipation stinger | -16 | Subtle — builds slowly |
| Small win chime | -14 | Clear |
| Medium win arpeggio | -12 | Present |
| Big win fanfare | -8 | Feature sound |
| Coin clinks | -16 per coin | Many simultaneous — they sum |
| Background music | -20 to -18 | Always under SFX |
| Win counter tick | -20 | Rapid — many at once |
| Bonus fanfare | -6 | This is the climax — can be louder |

## References

See `tonejs-game-audio` skill for complete synthesis implementations.
- `references/mixing-guide.md` — full frequency spectrum management, mobile speaker EQ, headphone vs speaker balancing
