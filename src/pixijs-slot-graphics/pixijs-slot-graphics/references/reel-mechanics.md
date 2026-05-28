# Reel Mechanics: Timing, Anticipation, and Feel

A slot machine lives and dies on its reel feel. The math (RTP, hit frequency) determines the long-term economics; the *feel* of a spin determines whether a player wants to spin again. This reference documents the timing patterns real-money slot studios use.

## The "weight" of a reel

A reel that spins-then-stops linearly feels like a counter advancing — purely informational. A reel with proper weight feels like a heavy mechanical drum coming to rest. The difference is entirely in the deceleration and the settle.

The pattern:
1. **Accelerate** for ~300-500ms to a target velocity (typically 1500-2200 px/sec for symbols ~100px tall).
2. **Hold velocity** while the reel is in motion. Apply vertical-only motion blur during this phase, scaled to current velocity.
3. **Decelerate** quickly (~300ms) once the stop is triggered.
4. **Overshoot and settle.** The reel arrives at the target position with about 30-40px of overshoot, then snaps back with a `back.out` easing curve. This is the single most important detail — the overshoot is what makes the symbols feel heavy.

In GSAP:
```javascript
gsap.fromTo(symbol,
  { y: targetY + 38 },
  { y: targetY, duration: 0.5, ease: 'back.out(2.2)' }
);
```

The number 2.2 in `back.out(2.2)` controls the bounciness. 1.7 is the GSAP default and feels "fine"; 2.2-2.5 reads as "weighty"; 3+ reads as cartoonish.

## Staggered reel stops

All reels start spinning at the same time, but they don't all stop at the same time. The classic pattern:

- Reel 1 stops at T+600ms
- Reel 2 stops at T+780ms (+180ms)
- Reel 3 stops at T+960ms (+180ms)
- Reel 4 stops at T+1140ms
- Reel 5 stops at T+1320ms

The total spin time is ~1.3-1.5 seconds in the no-anticipation case. Players will lose patience if it's longer than 2s without a reason. The stagger gap (150-200ms) is wide enough to feel like distinct mechanical events but tight enough to not drag.

For cascade slots (Bejeweled-style), the stagger is shorter (~80ms) because the cells aren't physically connected.

## Anticipation: the most important trick

Anticipation is what happens when reels 1 and 2 land symbols that *could* trigger a bonus or big win if reel 3 also lands the right symbol. Real slots dramatically slow down reel 3, hold it spinning for an extra 800-1500ms, often with a separate anticipation sound stinger.

The math impact: zero. The probability of the win is fixed by the math model. The anticipation just stretches the *reveal*. But the felt experience is enormous — players report higher excitement on anticipation spins even when the third reel comes up empty.

When to trigger anticipation:
- 2+ scatter symbols already landed (the third would unlock a bonus round)
- A near-mega-win is possible (4 of 5 of the same high-value symbol)
- A jackpot trigger condition is one symbol away

Anticipation implementation:
```javascript
const stopDelay = baseStopTime + reelIndex * stagger;
if (isLastReel && anticipationActive) {
  return stopDelay + 1200; // hold an extra 1.2 seconds
}
return stopDelay;
```

During anticipation, also:
- Reduce the spin velocity by 40-50% so the player can "see" the symbols passing
- Increase the motion blur slightly to keep the sense of weight
- Trigger an anticipation audio cue (rising tone, see `tonejs-game-audio`)
- Optionally add a screen vignette or rim-light pulse on the active reel

## Reel ramp-up

When the player taps spin, all reels start moving simultaneously, BUT they should look like real drums spinning up — not instant velocity. Use `power2.in` easing on the velocity ramp:

```javascript
gsap.to(reelState, {
  velocity: targetVelocity,
  duration: 0.4,
  ease: 'power2.in',
});
```

A short stagger on the start (reel 1 at T+0, reel 2 at T+30ms, etc.) makes the start look slightly more mechanical too. Don't overdo this; 30-50ms is plenty.

## Quick-spin and stop-on-tap

Two player-comfort features that are mandatory in production:

**Quick-spin** — a setting that compresses the whole sequence to ~30% of the standard timing. The math doesn't change. Useful for players who hit dozens of spins per session.

**Stop-on-tap** — tapping the spin button while reels are still spinning immediately collapses the timing. Reels stop in order at ~80ms intervals. This MUST still preserve the anticipation pattern if it was active; otherwise players who use stop-on-tap miss the moments that matter.

## Symbol pooling

Don't destroy and recreate symbol sprites every spin — that's a guaranteed frame-rate drop on Android. Maintain a pool of symbol sprites per reel (slightly larger than the visible strip) and reuse them by changing the texture and the position. The `pixi-reels` library handles this automatically; if you're rolling your own, here's the pattern:

```javascript
class ReelStrip {
  constructor(symbolCount) {
    this.pool = Array(symbolCount).fill(null).map(() => makeSymbol('placeholder', size));
  }
  setSymbol(index, key) {
    // Update the existing symbol's appearance instead of replacing it
    this.pool[index].setKey(key); // your custom method
  }
}
```

## Cascade refills (Bejeweled-style)

For cascade slots, when winning symbols are removed:
1. Animate the winners exploding/dissolving (~300ms)
2. Symbols above the winners fall down to fill the empty cells, with stagger
3. New symbols drop from the top to fill the rest
4. Check for new wins; if any, repeat. Otherwise, end the cascade.

Use `pixi-reels` `reelSet.refill({ winners, grid })` if you can. The survivors-stay-put pattern is non-trivial to get right.

## Megaways / variable rows

Megaways slots vary the row count per reel per spin (typically 2-7). The mechanic: each reel independently picks a row count when it lands. Ways = product of all row counts. A 5-reel megaways slot with rows [4,7,7,7,5] = 4×7×7×7×5 = 6860 ways.

Visual implementation: each reel is masked to its own variable height. Reels typically expand/contract slightly on landing for visual interest. `pixi-reels` supports this via the `MultiWays` and `AdjustPhase` extensions.

## Timing constants summary

| Phase | Standard | Quick | Anticipation |
|---|---|---|---|
| Accel | 400ms | 120ms | 400ms |
| Reel 1 stop | 600ms | 200ms | 600ms |
| Stop stagger | 180ms | 60ms | 180ms |
| Final reel hold | 0 | 0 | +800-1500ms |
| Settle | 500ms | 250ms | 500ms |
| Total (5 reels) | ~1900ms | ~700ms | ~3100ms |

These are not laws — different game studios tune to slightly different feels. But they're a good calibrated starting point that has been validated by countless commercial slots.
