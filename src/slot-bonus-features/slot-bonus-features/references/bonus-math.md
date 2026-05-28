# Bonus Feature Math — Routing Reference

**This file deliberately contains no authoritative numbers.** Expected value, prize-pool tuning, wheel
segment weighting, hold-and-win seeding, and pick-game distributions are **owned by the `h5g-slot-math`
skill suite**. The bonus modules in `SKILL.md` provide the *mechanics*; the *odds and payouts* are a
probability problem that must be modelled and verified, not estimated in code comments.

## Why bonus EV is not computed here

Each feature is a dependent, stateful process:

- **Free spins**: total return depends on retrigger behaviour, the in-feature strips (often different
  from base), and any multiplier modifier that compounds across spins. The expected value is a sum over
  a state machine, not `spins × avg_win`.
- **Hold-and-win**: each respin's new-lock probability depends on how many cells are already locked
  (fewer open cells → different odds). Strongly dependent; resets-on-lock change the stopping time.
- **Pick-and-click**: prizes are drawn without replacement and a COLLECT can end the game early, so the
  realized number of picks is a random variable. EV must integrate over stopping time.
- **Wheel**: EV is the weighted sum over segments — and the *weights* (not the visual segment sizes)
  are what matter. Visual size ≠ probability unless you make them equal on purpose.
- **Multiplier ladder**: contribution depends on how far the ladder climbs, which depends on win
  cadence — another state-dependent quantity.

## Where to go

When asked to design, tune, balance, explain, or verify any bonus payout/odds:

1. **`h5g-slot-math:probability-model`** — build the explicit model of the feature as a state machine;
   enumerate exactly where tractable (small pick pools, fixed wheels).
2. **`h5g-slot-math:dependency-audit`** — audit the without-replacement draws, reset-on-lock dynamics,
   retrigger compounding, and cap effects. Default to dependent.
3. **`h5g-slot-math:rtp-verification`** — verify the modelled EV with Monte Carlo / Test Harness as a
   *check*, never as the primary source.
4. **`h5g-slot-math:internal-h5g-evidence`** — RMG/certification process gates for regulated features
   (especially progressive jackpots and jurisdiction-specific rules).

## Seams the verified numbers plug into

The modules already isolate the random draws behind engine methods so verified distributions drop in:

```javascript
engine.generatePickBonusPrizes(items)   // prize pool + order — model-owned distribution
engine.pickWheelSegment(segments)       // segment weights — model-owned, NOT visual size
engine.generateHoldAndWinSpin(cells)    // per-respin draw given current locked state
config.freeSpinsCount                   // award amount (structural), not a probability
```

Keep these as the injection points. The module's responsibility ends at "call the draw, animate the
result, emit `bonusWin` / `bonusComplete`." The draw's *correctness* is math-authority output.

## What you may do here

- Implement the feature flow, UI, animation, and event emission.
- Provide injectable RNG for reproducible verification runs.
- Label any placeholder prize pools or segment weights as **un-verified** until math sign-off.

## What you may not do here

- State a feature's RTP contribution, hit rate, average multiplier, or EV as fact. Report the
  probability basis, the verification status, and blockers, and defer to `h5g-slot-math`.
