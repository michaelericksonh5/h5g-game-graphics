# Genre Audio Moods

Instrument/timbre palettes and musical settings per genre, all synthesized in Tone.js (no samples).
These pair with the stem architecture in `stem-mixing.md` and the theme tokens in
`slot-art-style-presets`. Each genre block gives: scale, tempo, lead/pad/bass timbres, and a
characteristic effect.

## How to use

Pick the block matching the theme, build each stem's synth from the timbres, and key melodies to the
scale. The `slot-art-style-presets` skill exposes an `audioGenre` tag and `musicalScale` per theme —
match this file's block to that tag.

## Egyptian

- **Scale**: Phrygian dominant / double-harmonic (E F G# A B C D#) — the "desert" sound.
- **Tempo**: 92–104 BPM.
- **Lead**: reedy `Tone.Synth` with `sawtooth`, fast attack, gentle vibrato (LFO → detune ±8 cents).
- **Pad**: `Tone.FMSynth`, low harmonicity, long release — a warm drone.
- **Bass**: plucked `Tone.MonoSynth`, `square`, short decay.
- **Percussion**: frame-drum feel — `Tone.MembraneSynth` + a hand-clap from filtered noise.
- **Character FX**: a dusty band-pass on the master (see `procedural-sfx-design` Egyptian chain).

```javascript
const egyptLead = new Tone.Synth({ oscillator:{ type:'sawtooth' },
  envelope:{ attack:0.02, decay:0.1, sustain:0.6, release:0.3 } });
new Tone.LFO({ frequency:5.5, min:-8, max:8 }).connect(egyptLead.detune).start();
```

## Cyberpunk Neon

- **Scale**: natural minor / Dorian; heavy use of fifths.
- **Tempo**: 120–132 BPM, driving.
- **Lead**: detuned dual `sawtooth` (`Tone.PolySynth` with spread) — the classic supersaw.
- **Pad**: slow-attack `sawtooth` pad through a resonant low-pass with LFO on cutoff (filter sweep).
- **Bass**: `Tone.MonoSynth`, `square`, with a touch of distortion.
- **Percussion**: tight electronic kick (`MembraneSynth`) + noise hat.
- **Character FX**: bit-crusher send, slap delay (1/8 dotted).

## Asian Prosperity

- **Scale**: major pentatonic (C D E G A) — no semitone tension, "lucky" feel.
- **Tempo**: 100–112 BPM.
- **Lead**: plucked koto/guzheng feel — `Tone.PluckSynth` or short-decay `Tone.Synth` triangle.
- **Pad**: airy `Tone.AMSynth` sustained.
- **Percussion**: taiko-style low `MembraneSynth` hits + small bell (`MetalSynth`, sparse).
- **Character FX**: bright plate reverb, gentle.

## Underwater

- **Scale**: Lydian (dreamy) or whole-tone (floaty, unresolved).
- **Tempo**: 72–88 BPM, slow.
- **Lead**: sine/triangle with slow attack; pitch drifts via subtle LFO.
- **Pad**: evolving `Tone.FMSynth` with very long attack/release; chorus for shimmer.
- **Bass**: deep sine sub.
- **Character FX**: chorus + long reverb + a low-pass that gently opens/closes (the "current").

## Dark Fantasy / Gothic Horror

- **Scale**: harmonic minor; tritones for dread.
- **Tempo**: 60–80 BPM, brooding.
- **Lead**: bowed-string feel via slow-attack saw + vibrato; sparse.
- **Pad**: choir-like `Tone.PolySynth` (triangle) with heavy reverb.
- **Bass**: low drone, octaves.
- **Character FX**: large hall reverb, occasional low boom (`MembraneSynth`, very low).

## Vegas Classic

- **Scale**: major, bluesy 7ths.
- **Tempo**: 116–128 BPM, upbeat.
- **Lead**: brassy `Tone.Synth` square/saw stab; quick.
- **Pad**: organ-ish additive.
- **Percussion**: swing hat + kick.
- **Character FX**: bright, dry, slightly compressed — "casino floor" energy.

## Irish Luck / Fairy Tale

- **Scale**: Mixolydian (Irish) / major (fairy tale).
- **Tempo**: 108–120 BPM, lilting (6/8 feel for Irish).
- **Lead**: whistle/flute feel — sine with breath noise; ornamented.
- **Pad**: warm strings.
- **Character FX**: medium hall, light.

## Sci-Fi / Retro Arcade

- **Sci-Fi**: whole-tone/minor, 110–126 BPM, FM leads, arpeggiated pads, plenty of reverb + delay.
- **Retro Arcade**: chiptune — `square`/`pulse` + `triangle` bass, 130–150 BPM, no reverb, fast arps,
  short envelopes (authentic 8-bit). Optionally bit-crush the master.

## Tempo map quick reference

| Genre | BPM | Feel |
|---|---|---|
| Dark Fantasy/Gothic | 60–80 | brooding |
| Underwater | 72–88 | floating |
| Egyptian | 92–104 | hypnotic |
| Asian | 100–112 | serene |
| Irish/Fairy Tale | 108–120 | lilting |
| Vegas | 116–128 | upbeat |
| Cyberpunk | 120–132 | driving |
| Sci-Fi | 110–126 | tense |
| Retro Arcade | 130–150 | frantic |

Use these as starting points; the `stem-mixing.md` crossfades stay the same regardless of genre.
