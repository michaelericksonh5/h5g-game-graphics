# Feature Trigger Math — Routing Reference

**This file contains no numbers and no formulas you should treat as authoritative.** Feature-trigger
probability (scatter triggers, retriggers, hold-and-win seeding, jackpot odds) is **owned by the
`h5g-slot-math` skill suite**. This engine only *consumes* the resulting weights and counts as data
and exposes the *seams* where those numbers plug in. Its job is to route you to the right authority.

## Why this is not computed here

Feature triggers are almost never independent events, so the naive shortcuts are usually wrong:

- **Scatters share the visible window.** "P(3 scatters) = p³" assumes independence across reels and
  positions. The real model must account for per-reel strips, per-reel scatter counts, spacing rules,
  and the window read. Default to **dependent** until independence is proven.
- **Retriggers compound.** Free-spins retrigger probability interacts with the modified in-feature
  strips and with how many spins remain. It is a state problem, not a single probability.
- **Hold-and-win seeding** depends on how many money symbols triggered entry, which is itself a
  dependent draw.
- **Caps and multipliers** truncate or reshape the distribution; the mean is not the expected value
  once a cap bites.

Producing a credible number for any of these requires an explicit probability model and, where the
state space is too large to enumerate, a verified simulation — not arithmetic in a code comment.

## Where to go

When the user asks to design, tune, explain, review, or verify any feature-trigger number:

1. **`h5g-slot-math:probability-model`** — build the explicit model first. Enumerate exactly when
   tractable (small windows, fixed strips). State the symbols, weights, window, and the event.
2. **`h5g-slot-math:dependency-audit`** — before trusting any product-of-probabilities or
   "expected frequency" claim, audit independence: shared cells, scatters, retriggers, multipliers,
   caps. This is the step that catches the most common mistakes.
3. **`h5g-slot-math:rtp-verification`** — run Monte Carlo / Test Harness / SlotEngineGUI as
   *verification of the theoretical model*, never as the source of the number.
4. **`h5g-slot-math:internal-h5g-evidence`** — for RMG/certification/jurisdiction process gates.

## The engine seams these numbers plug into

The engine exposes injectable points so verified math drops in cleanly:

```javascript
// In the par-sheet config consumed by SlotEngine:
{
  reelStrips:        [...],   // counts here set trigger odds — produced by probability-model
  bonusTriggerCount: 3,       // structural rule: 3+ scatters => feature
  freeSpinsCount:    10,      // award amount, not a probability
  rng:               fn,      // injectable for seeded verification runs
}
```

```javascript
// The trigger CHECK is structural and lives in the engine:
const scatters = countSymbol(grid, 'SCATTER');
if (scatters >= config.bonusTriggerCount) emit('scatterTrigger', { count: scatters });
// HOW OFTEN this fires is determined by the strips/weights, which are math-authority output.
```

## What you may do here without the math skill

- Wire the *structural* trigger rule ("3+ scatters → free spins").
- Provide injectable RNG so verification runs are reproducible.
- Emit events the visual/audio layers consume.
- Run the smoke-test loop in `SKILL.md` to confirm the engine doesn't crash — clearly labelled as a
  smoke test, **not** RTP verification.

## What you may not do here

- Quote a trigger probability, hit frequency, retrigger rate, or RTP contribution as if it were
  correct. Always defer to `h5g-slot-math` and report the probability basis, the verification, and any
  blockers (e.g., missing source weights).
