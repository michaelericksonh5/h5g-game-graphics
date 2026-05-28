# Reel Strip Design

A reel strip is the ordered list of symbols a reel can land on. The engine picks a random stop index
per reel and reads `visibleRows` symbols from that point. This file covers the *data structure and
mechanics* of strips. **It does not derive RTP or symbol weights** — that is math-authority work; see
the "Math authority" note below.

## What a strip is

```javascript
// One reel = one array. Length is the number of virtual stops.
const reel1 = ['T','T','Q','J','T','A','Q','T','K','J', /* ... */ 'WILD','SCATTER'];
```

- **Stop count** = `reel.length`. Larger strips give finer weighting granularity.
- **Symbol frequency** on a strip = how many cells hold that symbol. A symbol appearing on 14 of 100
  cells lands far more often than one on 2 of 100.
- **Per-reel strips differ.** Real slots use a different strip for each reel so that, e.g., the
  top-paying symbol is rare on reels 2–4 (so 5-of-a-kind is hard) but present on reel 1.

## The grid read

```javascript
function readColumn(strip, stop, visibleRows) {
  const col = [];
  for (let row = 0; row < visibleRows; row++) {
    col.push(strip[(stop + row) % strip.length]);   // wraps around
  }
  return col;
}
```

The modulo wrap means the strip is a loop — position `length-1` is adjacent to position `0`. Keep
that in mind when placing symbols: a symbol at the end and one at the start are neighbours.

## Banding and stacking

- **Stacked symbols**: place 2–3 identical symbols consecutively so they tend to land as a block in
  the visible window. Common for premium/wild symbols to create big-win moments.
- **Spacing rules**: many studios forbid two scatters within `visibleRows` of each other on the same
  strip so a single reel can never show two scatters. Encode this as a validation pass over the strip.
- **Padding rows**: strips usually include one extra row above and below the visible window so the
  symbols sliding in/out are real strip entries, not blanks.

```javascript
function validateStrip(strip, { minScatterGap = 3 } = {}) {
  const idx = strip.map((s, i) => s === 'SCATTER' ? i : -1).filter(i => i >= 0);
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] - idx[i-1] < minScatterGap) return false;   // too close
  }
  // also check wrap-around gap
  const wrap = (strip.length - idx[idx.length-1]) + idx[0];
  return idx.length < 2 || wrap >= minScatterGap;
}
```

## Generating strips from a target distribution

You usually start from a desired *count per symbol per reel* (a column of the PAR sheet) and shuffle
into a strip that satisfies spacing rules:

```javascript
function buildStrip(countsBySymbol, rng, rules) {
  // countsBySymbol: { T: 14, J: 12, Q: 10, K: 8, A: 6, WILD: 2, SCATTER: 3 }
  let pool = [];
  for (const [sym, n] of Object.entries(countsBySymbol)) pool.push(...Array(n).fill(sym));
  // Fisher–Yates with injectable rng, then re-roll until validateStrip passes
  for (let attempt = 0; attempt < 1000; attempt++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    if (validateStrip(pool, rules)) return [...pool];
  }
  throw new Error('Could not satisfy strip spacing rules — relax counts or rules');
}
```

The **counts** (`countsBySymbol`) are the lever that sets RTP and volatility. Choosing those numbers
is a probability problem, not a rendering problem.

## Math authority — do not derive RTP here

> The symbol counts that determine RTP, hit frequency, and volatility are **owned by the
> `h5g-slot-math` skill suite**, not by this engine. When a user asks "what weights give 96% RTP?",
> "is this volatility right?", or "verify the math":
>
> 1. `h5g-slot-math:probability-model` — build the explicit model (symbols, weights, paytable, lines),
>    dependent-by-default, exact enumeration when tractable.
> 2. `h5g-slot-math:dependency-audit` — check independence assumptions (shared windows, scatters,
>    retriggers) before trusting any product-of-probabilities shortcut.
> 3. `h5g-slot-math:rtp-verification` — Monte Carlo / Test Harness as *verification only* against the
>    theoretical model.
>
> This engine consumes the resulting counts as data. It is not the source of truth for whether they
> are correct. See `feature-trigger-math.md` for the same boundary applied to feature triggers.

## Practical defaults to start prototyping (visual only)

For a visual prototype *before math sign-off*, any strip that reads cleanly is fine — just label it
clearly as un-verified. Replace with math-authority-produced counts before any RTP claim, eval, or
certification.
