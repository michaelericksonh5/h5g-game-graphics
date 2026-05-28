# Stem Mixing

Adaptive slot music is built from independent **stems** that all play in sync and are mixed in/out by
game state. Because everything is synthesized and clocked to `Tone.Transport`, stems stay phase-locked
and crossfades never glitch. This is the architecture; `genre-audio-moods.md` supplies the timbres.

## The stem set

| Stem | Plays when | Role |
|---|---|---|
| `ambient` | always (base game) | bed/drone, sets mood |
| `rhythm` | reels spinning | pulse/energy |
| `tension` | anticipation active | rising unease |
| `melody` | free spins / bonus | the "reward" theme |
| `stinger` | one-shots (win/trigger) | accents, not looped |

All looping stems run continuously at their loop length; only their **volume** changes. Never start/
stop loops on transitions — that's what causes clicks and drift.

## Transport-locked construction

```javascript
Tone.Transport.bpm.value = 104;                 // from the genre tempo map
Tone.Transport.timeSignature = 4;

function makeStem(synthFactory, patternEvents, subdivision = '8n') {
  const synth = synthFactory().toDestination();
  synth.volume.value = -Infinity;               // start muted
  const seq = new Tone.Sequence((time, note) => {
    if (note) synth.triggerAttackRelease(note, subdivision, time);
  }, patternEvents, subdivision);
  seq.start(0);                                  // all stems start at transport 0 → phase-locked
  return { synth, seq };
}
```

Start `Tone.Transport` once at game start; stems are always running underneath, audible or not.

## State → mix matrix

Define target volumes per state and ramp to them. One source of truth:

```javascript
const MIX = {
  IDLE:        { ambient:-10, rhythm:-Infinity, tension:-Infinity, melody:-Infinity },
  SPINNING:    { ambient:-12, rhythm:-7,        tension:-Infinity, melody:-Infinity },
  ANTICIPATION:{ ambient:-14, rhythm:-9,        tension:-5,        melody:-Infinity },
  FREE_SPINS:  { ambient:-18, rhythm:-8,        tension:-Infinity, melody:-4        },
  BONUS_GAME:  { ambient:-Infinity, rhythm:-Infinity, tension:-Infinity, melody:-3  },
};

function applyMix(stems, state, fade = 0.5) {
  const target = MIX[state] ?? MIX.IDLE;
  for (const [name, vol] of Object.entries(target)) {
    stems[name].synth.volume.rampTo(vol, fade);   // rampTo = click-free
  }
}
engine.addEventListener('stateChange', ({ detail }) => applyMix(stems, detail.state));
```

`rampTo(-Infinity, t)` fades a stem fully out; `rampTo(dB, t)` brings it back. Because the loop never
stopped, fading back in is seamless and on-beat.

## Crossfade timing

- **Enter spin**: fast (0.2–0.3s) so energy snaps in with the action.
- **Enter anticipation**: medium (0.4s) tension swell.
- **Enter/exit bonus**: slow (0.8–1.2s) for a cinematic mode change.
- Quantize big transitions to the next bar for musicality:

```javascript
Tone.Transport.scheduleOnce(() => applyMix(stems, 'FREE_SPINS', 1.0), '@1m');
```

## Stinger one-shots over the bed

Stingers (win chimes, trigger fanfares) are *not* stems — fire them on top, keyed to the same scale so
they sit in the music. Route through a dedicated bus so they don't pump the loop volumes.

```javascript
function fireStinger(notes, time = Tone.now()) {
  const s = new Tone.PolySynth(Tone.Synth).connect(stingerBus);
  notes.forEach((n, i) => s.triggerAttackRelease(n, '8n', time + i * 0.12));
  setTimeout(() => s.dispose(), 2000);
}
```

(Discrete event SFX themselves live in `procedural-sfx-design`; this is just the musical accent layer.)

## Buses and headroom

```
ambient ┐
rhythm  ├─→ musicBus ─→ comp (gentle) ─→ master
tension │
melody  ┘
stinger ───→ stingerBus ─→ master
sfxBus  ───→ (procedural-sfx-design) ─→ master
```

Keep music ~6 dB under SFX peaks so wins cut through. See the volume table in
`procedural-sfx-design/references/mixing-guide.md` for the full simultaneous-layer budget.

## Avoiding the classic glitches

- **Don't** create/dispose looping synths on transitions — only ramp volume.
- **Do** start all loops at transport 0 so they share phase.
- **Do** `await reverb.generate()` before first use.
- **Do** cap polyphony on pads to avoid voice-stealing crackle on mobile.
