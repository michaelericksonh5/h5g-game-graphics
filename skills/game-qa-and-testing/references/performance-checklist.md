# Performance Checklist: Hitting and Proving 60fps

A slot must hold 60fps on the phone a real player owns, not on a dev laptop. This file is how you
*measure* performance (not guess), what the numbers must be, and the order to attack problems when the
frame rate drops. The engine/render-side techniques live in the producing skills
(`pixijs-slot-graphics/references/performance-mobile.md`, `threejs-game-3d/references/mobile-optimization.md`);
this file is the QA gate that verifies them.

## Measure, never assume

"It feels smooth" is not a measurement. Get a number:

- **PixiJS**: read `app.ticker.FPS` live, or overlay a frame-time graph. Better, sample
  `performance.now()` deltas across 300 frames and report min/avg/max frame time.
- **Three.js**: `Stats.js` panel, plus `renderer.info.render.calls` and `.triangles` printed during play.
- **The number that matters is the *worst* frame**, not the average. A 60fps average with a 120ms hitch
  on every big win feels broken. Always capture the worst-case moment (see below).

```javascript
// Drop-in frame-time sampler — log min/avg/max over a window.
let frames = [], last = performance.now();
function sample() {
  const now = performance.now(); frames.push(now - last); last = now;
  if (frames.length === 300) {
    const avg = frames.reduce((a,b)=>a+b,0)/frames.length;
    console.log(`frame ms  avg ${avg.toFixed(1)}  max ${Math.max(...frames).toFixed(1)}  ~${(1000/avg).toFixed(0)}fps`);
    frames = [];
  }
  requestAnimationFrame(sample);
}
sample();
```

## Capture the worst frame

The big-win celebration is almost always the worst frame: win arpeggio + coin shower particles +
counter rollup + screen shake + bloom all at once. **QA must trigger a max-tier win and measure during
it**, not just measure an idle reel. Force a guaranteed big win in a debug build (seeded RNG, see
`slot-state-machine` smoke test) so you can profile it repeatably.

## Targets

| Metric | Target (mid-range phone) | Fail |
|---|---|---|
| Steady-state FPS (idle, base spin) | 60 | sustained < 55 |
| Worst-frame FPS (max win + particles) | ≥ 50 | dips < 40 or a visible stutter |
| Any single frame during normal play | ≤ 16.6 ms | > 20 ms |
| Draw calls (PixiJS or Three) | < 100, stable | climbing over a session = leak |
| Time to first interaction | < 3 s | > 5 s |
| Memory (5-min auto-spin session) | flat line | rising = texture/synth/particle leak |

"Mid-range phone" = throttle to roughly a 3-year-old Android. In Chrome DevTools: CPU 4–6× slowdown +
a mobile device profile. Numbers from an un-throttled desktop are meaningless for sign-off.

## Leak checks (the silent killers)

A slot runs hundreds of spins per session, so per-spin leaks compound:

- **Symbol sprites**: confirm the reel uses a *pool* and reuses sprites — draw calls and node count must
  be flat after 50 spins, not rising (see `pixijs-slot-graphics/reel-mechanics.md` pooling).
- **Particles**: emitters must be returned to a pool/destroyed; watch the PixiJS object count.
- **Audio**: pooled synths persist; ad-hoc `new Tone.Synth()` per event without `dispose()` leaks voices
  and eventually crackles (see `procedural-sfx-design`).
- **GSAP tweens**: killed on completion; orphaned repeating tweens (idle glow pulses) must pause when
  off-screen.
- Run 200 auto-spins and watch `performance.memory.usedJSHeapSize` (Chrome) — it should plateau.

## Triage order when frames drop

Attack in this order; the first one usually recovers the most:

1. **Pixel ratio** — cap at 2 (`renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`). Highest impact.
2. **Draw calls** — if > 100, something stopped batching/instancing. Find the un-pooled or un-instanced
   thing. (Three: `InstancedMesh`; Pixi: shared texture atlas, avoid filter-per-sprite.)
3. **Filters/post-FX** — a `BlurFilter` or bloom pass per object is brutal on mobile. Halve bloom
   resolution; share filters; remove decorative filters that don't survive a phone speaker/screen.
4. **Particle count** — cap concurrent particles; throttle coin showers (the eye can't count 200).
5. **Shadow maps (3D)** — one caster only, 1024 map (see `threejs-game-3d/mobile-optimization.md`).
6. **Texture memory** — compress (KTX2); the live PixiJS-in-Three hybrid texture stays small.

## Load-time performance

- All synths/reverbs built during the loading screen, not on first trigger (frame stall on first spin).
- Reverb IRs `await`ed before play.
- Textures decoded during load, not on first appearance.
- First-interaction-ready under 3s; if the loading screen lingers, profile asset/synth init.

## Sign-off statement

QA passes only when you can write a concrete line like:
`"60fps idle/spin, worst frame 52fps during max-win on 4× CPU throttle; draw calls 38 stable over 200
spins; first interaction 1.9s; heap flat."` If any number is missing because you couldn't run it, say
so — do not assert a number you didn't observe.
