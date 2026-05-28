# Easing Library

The vocabulary of motion. Picking the right easing is the difference between "tween" and "juice".
This is a practical map of GSAP easings to game moments, with the numbers that matter. Pairs with the
celebration orchestration in `SKILL.md` and the timings in
`slot-symbol-animation-states/references/animation-timing-table.md`.

## The core five

| Easing | Curve feel | Use for |
|---|---|---|
| `back.out(n)` | overshoots then settles | landings, pop-ins, button release — the workhorse |
| `elastic.out(a,p)` | springy oscillation | celebratory pop-ins, big-win reveals |
| `power2.in` | slow→fast | wind-ups, things leaving the screen |
| `power2.out` | fast→slow | most UI feedback, decelerations |
| `power4.out` | very sharp decel | snappy stops, impactful arrivals |

## back.out — the overshoot

`back.out(n)`: the `n` controls overshoot amount.

- `1.7` — GSAP default, "fine".
- `2.2–2.5` — reads as *weighty/premium* (reel settle, symbol landing).
- `3+` — cartoonish; use for playful themes only.

```javascript
gsap.fromTo(node.scale, { x:0.6, y:0.6 }, { x:1, y:1, duration:0.35, ease:'back.out(2.4)' });
```

## elastic.out — the spring

`elastic.out(amplitude, period)`:

- amplitude `1`, period `0.3` — lively but controlled (good default for win pop-ins).
- larger period → slower, looser oscillation.

```javascript
gsap.from(winBanner.scale, { x:0, y:0, duration:0.8, ease:'elastic.out(1, 0.35)' });
```

Don't use elastic on functional UI (bet +/-) — it feels imprecise. Reserve for celebration.

## Anticipation hold (wind-up → release)

The "juice" trick: a small reverse move *before* the main move makes the main move read as powerful.

```javascript
const tl = gsap.timeline();
tl.to(node.scale, { x:0.85, y:0.85, duration:0.12, ease:'power2.in' })   // wind up (anticipation)
  .to(node.scale, { x:1.15, y:1.15, duration:0.18, ease:'back.out(3)' }) // release (overshoot)
  .to(node.scale, { x:1,    y:1,    duration:0.2,  ease:'power2.out' }); // settle
```

This three-beat (anticipation → action → settle) is the single most reusable juice pattern.

## Bounce (gravity) for coins/objects landing

`bounce.out` for things hitting a floor; or simulate real gravity (see `particle-presets.md`) when you
need physical arcs.

```javascript
gsap.to(coin, { y: floorY, duration: 0.9, ease: 'bounce.out' });
```

## Stagger — choreography across many elements

The biggest perceived-quality win for cheap. Never animate a group simultaneously; offset them.

```javascript
gsap.from(symbols, {
  y: -40, alpha: 0, duration: 0.4, ease: 'back.out(2)',
  stagger: { each: 0.05, from: 'start' },     // 'center' / 'edges' / 'random' also great
});
```

- Reels: `from:'start'` (left-to-right reveal).
- Win cells: `from:'center'` (radiates out).
- Grid intros: `from:'random'` (organic).

## Curated easing map by moment

| Moment | Easing | Duration |
|---|---|---|
| Reel settle | `back.out(2.2)` | 0.5s |
| Symbol landing | `back.out(2.4)` | 0.34s |
| Button press | `power2.in` | 0.08s |
| Button release | `back.out(2.5)` | 0.2s |
| Small win pop | `back.out(2)` | 0.3s |
| Big win reveal | `elastic.out(1,0.35)` | 0.8s |
| Win counter rollup | `power2.out` | 1.5–2.5s |
| Coin shower | gravity (custom) | physics |
| Overlay in | `back.out(1.8)` | 0.5s |
| Overlay out | `power2.in` | 0.4s |
| Multiplier reveal | `back.out(2.5)` | 0.5s |

## Custom eases

For motion not covered by named eases, use `CustomEase` or a raw cubic-bezier:

```javascript
gsap.to(node, { y: 0, duration: 0.6, ease: CustomEase.create('c', 'M0,0 C0.2,1 0.3,1 1,1') });
```

## Reduced motion

On `prefers-reduced-motion`, collapse the three-beat to a single `power2.out`, halve durations, and
drop elastic/bounce to plain `out` curves. Keep the change instant-feeling but un-bouncy.
