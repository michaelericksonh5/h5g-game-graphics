# SFX Mixing Guide

When a big win fires, you may have music (4 stems), a win arpeggio, a coin shower (dozens of clinks),
the counter rollup, and a fanfare all at once. Without a mix plan it turns to mud and clips. This is
the level budget and routing that keeps everything clear on a phone speaker.

## Bus topology

```
reelTick / stop / ui ─┐
coin clinks ──────────┤
win chimes / arps ────┼─→ sfxBus ──→ sfxComp ──┐
scatter / fanfare ────┘                         ├─→ master ──→ limiter ──→ destination
music stems ──────────→ musicBus ──→ musicComp ─┘
```

- **sfxBus**: all event sounds. One gentle compressor to glue + tame coin-shower peaks.
- **musicBus**: all stems (see `adaptive-game-music/references/stem-mixing.md`). Sits *under* SFX.
- **master limiter**: catches the combined peak so nothing clips on cheap speakers.

```javascript
const master  = new Tone.Limiter(-1).toDestination();          // ceiling -1 dB
const sfxBus  = new Tone.Channel({ volume: 0 }).connect(new Tone.Compressor({ threshold:-18, ratio:3 })).connect(master);
const musicBus= new Tone.Channel({ volume: -6 }).connect(new Tone.Compressor({ threshold:-20, ratio:2 })).connect(master);
```

## Level budget (relative dB)

| Layer | Level | Notes |
|---|---|---|
| Master limiter ceiling | -1 dB | never clip |
| Win fanfare / bonus trigger | 0 dB | loudest event — the payoff |
| Win arpeggio | -3 dB | |
| Scatter chimes | -4 dB | |
| Reel stop thud | -6 dB | |
| Coin clinks (each) | -10 dB | many at once → sum loud, keep individuals low |
| Reel tick (each) | -14 dB | very frequent → keep subtle |
| UI click | -16 dB | must not fatigue |
| Music stems (combined) | -6 to -8 dB | always under SFX |
| Anticipation stinger | -3 dB | + duck music (below) |

## Sidechain ducking

Duck music under big moments so wins cut through. Tone has no built-in sidechain; ramp the music bus
volume on the event and restore after:

```javascript
function duckMusic(amountDb = -8, holdS = 1.5) {
  const prev = musicBus.volume.value;
  musicBus.volume.rampTo(prev + amountDb, 0.1);
  setTimeout(() => musicBus.volume.rampTo(prev, 0.5), holdS * 1000);
}
// Call on win >= big, bonus trigger, anticipation.
```

## Voice management (coin showers)

A 200-coin shower must not trigger 200 synths. Strategies:

- **Throttle**: play a clink at most every ~40ms regardless of coin count; the eye sees 200, the ear
  hears a satisfying stream of ~25/sec.
- **Pool**: 4–6 pre-built clink synths, round-robin. Never allocate per coin.

```javascript
let lastClink = 0;
function coinClinkThrottled(now = performance.now()) {
  if (now - lastClink < 40) return;
  lastClink = now; clinkPool[clinkIdx++ % clinkPool.length].play();
}
```

## Frequency separation

Avoid masking by spreading layers across the spectrum:

- Reel ticks/clicks: high (2–6 kHz) and short.
- Coin clinks: bright metallic (4–8 kHz).
- Thuds/kicks: low (60–150 Hz).
- Win arps/fanfare: mid (300 Hz–3 kHz) — the focal range.
- Keep two layers out of the same narrow band, or one will hide the other.

## Mobile speaker reality

Phone speakers roll off below ~400 Hz — your low thuds nearly vanish on-device. Don't *rely* on sub
bass for feedback; put the informational content (tick, clink, chime) in the mids/highs that survive.
Always verify the mix on the actual phone speaker, not headphones.

## Master loudness

Target a comfortable level with headroom; the limiter at -1 dB is a safety net, not a loudness tool.
If you're constantly hitting the limiter, lower the bus levels — pumping/distortion reads as cheap.
