# Animation Timing Table

Calibrated durations and easings for every symbol animation state. These values are tuned to read as
"premium casino" rather than "tween demo". They pair with the five-state model in `SKILL.md`.

## Master table

| State | Property | Duration | Easing | Notes |
|---|---|---|---|---|
| Idle breathing | scale 1.0↔1.03 | 1.6–2.2s loop | `sine.inOut` yoyo | Tier-scaled amplitude; stagger phase per symbol |
| Idle glow | alpha 0.4↔0.7 | 2.0s loop | `sine.inOut` yoyo | Premiums only; lows stay flat |
| Landing bounce | squash→settle | 280–420ms | `back.out(2.2)` | Triggered on reel stop, per-symbol |
| Landing dust | particle | 200ms | `power2.out` | Optional; one-shot at impact |
| Win highlight | scale 1.0↔1.12 | 0.5s loop | `power2.inOut` yoyo | Runs during win presentation |
| Win glow ramp | glow alpha →1 | 200ms in | `power2.out` | Then loops with the pulse |
| Win colormatrix | brightness →1.4 | 150ms | linear | Hold during highlight, release on end |
| Dimmed | alpha →0.35, sat →0 | 250ms | `power2.out` | Non-winning symbols during a win |
| Wild expand | scale →fill cell | 350ms | `back.out(1.8)` | + glow burst at apex |
| Scatter beam | line draw | 300ms/segment | `power1.inOut` | Connects scatter positions in sequence |
| Walking wild | x translate | 450ms/step | `power2.inOut` | Arc with slight vertical hop |
| Multiplier reveal | scale 0→1 +spin | 500ms | `back.out(2.5)` | Number punches in, then settles |

## Tier-scaled idle amplitude

Higher-value symbols breathe more so the eye is drawn to them:

```javascript
const IDLE_AMP = { LOW: 0.0, MID: 0.02, HIGH: 0.03, WILD: 0.04, SCATTER: 0.045 };

function startIdle(symbol, tier) {
  const amp = IDLE_AMP[tier] ?? 0.02;
  if (amp === 0) return;                       // low symbols don't breathe
  symbol._idle = gsap.to(symbol.scale, {
    x: 1 + amp, y: 1 + amp,
    duration: 2.0 - amp * 6,                   // bigger amp = slightly faster
    yoyo: true, repeat: -1, ease: 'sine.inOut',
    delay: Math.random() * 1.5,                // de-sync the grid
  });
}
```

De-syncing the start delay is what stops a grid of symbols pulsing in lockstep (which looks robotic).

## Landing bounce (squash and stretch)

```javascript
function landingBounce(symbol) {
  const tl = gsap.timeline();
  tl.set(symbol.scale, { x: 1.15, y: 0.85 })           // squash on impact
    .to(symbol.scale, { x: 0.93, y: 1.08, duration: 0.12, ease: 'power2.out' })  // stretch
    .to(symbol.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(2.4)' });    // settle
  return tl;
}
```

Fire this per symbol as its reel stops, offset by the reel's stop time so the bounce cascades across
the row. Total per-symbol time ~340ms keeps it under the next reel's stop.

## Win presentation sequence

```javascript
function presentWin(winningSymbols, losingSymbols) {
  losingSymbols.forEach(s => gsap.to(s, { alpha: 0.35, pixi: { saturation: 0 }, duration: 0.25 }));
  winningSymbols.forEach((s, i) => {
    gsap.to(s.glow, { alpha: 1, duration: 0.2, delay: i * 0.04 });
    s._winPulse = gsap.to(s.scale, {
      x: 1.12, y: 1.12, duration: 0.5, yoyo: true, repeat: -1, ease: 'power2.inOut', delay: i * 0.04,
    });
  });
}
function clearWin(all) {
  all.forEach(s => { s._winPulse?.kill(); gsap.to(s, { alpha: 1, pixi:{ saturation:1 }, duration:0.2 });
                     gsap.to(s.scale, { x:1, y:1, duration:0.2 }); gsap.to(s.glow, { alpha:0, duration:0.2 }); });
}
```

## Reduced motion

On `prefers-reduced-motion`, drop idle breathing and walking-wild arcs; keep win highlight (functional
feedback) but at lower amplitude (1.06 instead of 1.12) and no infinite glow pulse. Gate on the same
flag used by `slot-hud-and-ui` and `particle-systems-and-juice`.

## Performance

- Cap simultaneous infinite tweens: kill idle tweens on symbols entering a win state, restart on clear.
- Prefer animating `scale`/`alpha` (cheap) over redrawing Graphics each frame.
- For Spine-rigged symbols, drive these states as named animations instead — see `spine-integration.md`.
