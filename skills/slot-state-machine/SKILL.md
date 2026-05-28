---
name: slot-state-machine
description: Build the headless logic ENGINE for slot machine games — RNG seam, virtual reel-strip data structures, payline evaluation, win aggregation, feature/scatter trigger wiring, the game state machine, and free-spins state management. Use for any slot game that needs real game logic and structure beyond a visual demo. Triggers for "game logic", "slot engine", "RNG", "paylines", "payline evaluation", "scatter trigger", "free spins logic", "state machine", "event bus", or when the user needs a slot that actually works rather than just looks correct. This skill provides the engine STRUCTURE only; for probability-model, RTP, reel-strip weighting, hit-frequency, volatility, and certification CORRECTNESS defer entirely to the h5g-slot-math suite — do not derive or trust math numbers here. The headless engine connects to pixijs-slot-graphics for display and tonejs-game-audio for sound.
---

# Slot State Machine

The headless logic core. No graphics here — only state, structure, and events. Every visual system hooks into this as a data source.

## Math authority: defer to h5g-slot-math

This skill provides the engine **structure** — the RNG seam, reel-strip data shape, payline
evaluation, win aggregation, and event emission. It does **not** own math *correctness*. All
probability-model design, reel-strip weighting, RTP, hit-frequency, volatility, feature-trigger
odds, and certification evidence belong to the **h5g-slot-math** suite and must be produced there:

`probability-model` → `dependency-audit` → `rtp-verification` → `internal-h5g-evidence`.

Rules when wiring math into this engine:

- **Never invent or hardcode an RTP, hit-frequency, weighting, or odds number here.** Any number
  in this file is an illustrative *placeholder shape*, not an authoritative value.
- Define the probability model first; default to **dependent** probabilities until independence is
  proven; use **exact enumeration / state modeling** when tractable.
- Treat any in-engine simulation loop as a **smoke test only** (does the engine run, do events
  fire) — **not** RTP verification. RTP is verified in `rtp-verification`.
- If the source par-sheet / weighting data is missing, **stop and request it** — do not fabricate.

The example par sheet and the simulation loop below exist to show the engine's data *shape* and to
exercise the event wiring. The actual weighted strips and certified numbers come from h5g-slot-math.

## Game states

```javascript
export const STATE = {
  IDLE:           'IDLE',           // waiting for spin
  SPINNING:       'SPINNING',       // reels in motion
  ANTICIPATION:   'ANTICIPATION',   // last reel slowing — potential bonus
  EVALUATING:     'EVALUATING',     // checking wins
  WIN_SMALL:      'WIN_SMALL',      // < 5x bet — brief celebration
  WIN_MEDIUM:     'WIN_MEDIUM',     // 5-20x
  WIN_BIG:        'WIN_BIG',        // 20-100x
  WIN_MEGA:       'WIN_MEGA',       // 100-500x
  WIN_GRAND:      'WIN_GRAND',      // 500x+
  FREE_SPINS:     'FREE_SPINS',     // free spins mode active
  BONUS_GAME:     'BONUS_GAME',     // bonus mini-game active
  JACKPOT:        'JACKPOT',        // jackpot triggered
};
```

## The SlotEngine class

```javascript
export class SlotEngine extends EventTarget {
  constructor(config) {
    super();
    this.config = config;
    this.state  = STATE.IDLE;
    this.balance = config.startBalance ?? 1000;
    this.betAmount = config.defaultBet ?? 1;
    this.freeSpinsRemaining = 0;
    this.freeSpinsTotalWin = 0;
    this.rng = config.rng ?? Math.random;  // injectable for testing
  }

  spin() {
    if (this.state !== STATE.IDLE && this.state !== STATE.FREE_SPINS) return;

    const isFree = this.state === STATE.FREE_SPINS;
    if (!isFree) {
      this.balance -= this.betAmount;
      this.emit('balanceChange', { balance: this.balance });
    }

    this.setState(STATE.SPINNING);
    const grid = this.generateGrid();
    this.emit('spinStart', { grid });

    // Determine anticipation
    const scatters = this.countSymbol(grid, 'SCATTER');
    const anticipate = scatters >= 2;
    this.emit('anticipation', { active: anticipate, reelIndex: this.config.reelCount - 1 });

    return grid;  // visual layer uses this to know where to stop
  }

  resolve(grid) {
    this.setState(STATE.EVALUATING);
    const wins = this.evaluateWins(grid);
    const totalWin = wins.reduce((sum, w) => sum + w.payout, 0);

    if (wins.length > 0) {
      this.balance += totalWin;
      const tier = this.getWinTier(totalWin);
      this.setState(tier);
      this.emit('win', { wins, totalWin, tier });
    }

    // Check feature triggers
    const scatters = this.countSymbol(grid, 'SCATTER');
    if (scatters >= 3) {
      this.emit('scatterTrigger', { count: scatters });
      this.scheduleFreeSpins(this.config.freeSpinsCount ?? 10);
    }

    return { wins, totalWin };
  }

  generateGrid() {
    const { reelCount, visibleRows, reelStrips } = this.config;
    const grid = [];
    for (let r = 0; r < reelCount; r++) {
      const strip = reelStrips[r];
      const stop  = Math.floor(this.rng() * strip.length);
      const col   = [];
      for (let row = 0; row < visibleRows; row++) {
        col.push(strip[(stop + row) % strip.length]);
      }
      grid.push(col);
    }
    return grid;
  }

  evaluateWins(grid) {
    const wins = [];
    const { paylines, paytable, betAmount: bet } = this;

    for (const line of this.config.paylines) {
      const symbols = line.map((row, reel) => grid[reel][row]);
      const result  = this.checkLine(symbols);
      if (result) {
        const payout = (paytable[result.symbol]?.[result.count] ?? 0) * bet;
        if (payout > 0) wins.push({ line, symbol: result.symbol, count: result.count, payout });
      }
    }
    return wins;
  }

  checkLine(symbols) {
    const first = symbols[0] === 'WILD' ? symbols.find(s => s !== 'WILD') ?? 'WILD' : symbols[0];
    let count = 0;
    for (const s of symbols) {
      if (s === first || s === 'WILD') count++;
      else break;
    }
    return count >= 3 ? { symbol: first, count } : null;
  }

  getWinTier(totalWin) {
    const mult = totalWin / this.betAmount;
    if (mult >= 500) return STATE.WIN_GRAND;
    if (mult >= 100) return STATE.WIN_MEGA;
    if (mult >= 20)  return STATE.WIN_BIG;
    if (mult >= 5)   return STATE.WIN_MEDIUM;
    return STATE.WIN_SMALL;
  }

  countSymbol(grid, symbol) {
    return grid.flat().filter(s => s === symbol).length;
  }

  scheduleFreeSpins(count) {
    this.freeSpinsRemaining = count;
    this.freeSpinsTotalWin  = 0;
    this.setState(STATE.FREE_SPINS);
    this.emit('freeSpinsStart', { count });
  }

  setState(s) { this.state = s; this.emit('stateChange', { state: s }); }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
```

## Par sheet structure (data SHAPE only — numbers are placeholders)

This shows the *shape* of the config the engine consumes, not certified values. The `rtp`,
`hitFrequency`, weighted strip contents, and paytable figures below are **illustrative placeholders**
— the real, verified values are produced by the h5g-slot-math suite (see the Math authority callout).
Do not ship or trust these numbers.

```javascript
const EXAMPLE_PAR_SHEET = {
  reelCount:    5,
  visibleRows:  3,
  rtp:          0.96,        // PLACEHOLDER — authoritative value comes from rtp-verification
  hitFrequency: 0.30,        // PLACEHOLDER — comes from probability-model, not assumed here

  // Virtual reel strips — weighted per symbol. Weighting that targets a real RTP/volatility
  // is designed in h5g-slot-math (probability-model + reel-strip weighting), NOT guessed here.
  reelStrips: [
    // Reel 1: 100 stops. Symbol frequency controls RTP.
    // A=6, K=8, Q=10, J=12, T=14 (most common), WILD=2, SCATTER=3, BONUS=2
    ['T','T','Q','J','T','A','Q','T','K','J','T','Q','SCATTER','T','J','K',
     'Q','T','J','A','T','K','Q','J','T','A','Q','K','T','J',
     // ... repeat pattern to 100 stops
     'WILD','T','J','Q','K','T','A','J','T','Q','K','SCATTER','T','J','Q',
     'T','K','A','J','T','Q','K','J','T','A','Q','K','BONUS','T','J','Q',
     'K','T','J','A','Q','T','K','J','T','Q','A','K','T','J','Q','SCATTER'],
  ],

  // Paylines: each entry is [row for reel 0, row for reel 1, ..., row for reel N]
  // Standard 20-line set for 5x3:
  paylines: [
    [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2],   // horizontal
    [0,1,2,1,0], [2,1,0,1,2],                 // V shapes
    [0,0,1,2,2], [2,2,1,0,0],                 // diagonal
    // ... 13 more
  ],

  paytable: {
    'WILD':    { 3: 20, 4: 100, 5: 500  },
    'SCATTER': { 3:  5,  4:  20,  5:  100 },  // scatter pays on count, not line
    'A':       { 3:  5,  4:  20,  5:  100 },
    'K':       { 3:  4,  4:  15,  5:   75 },
    'Q':       { 3:  3,  4:  10,  5:   50 },
    'J':       { 3:  2,  4:   8,  5:   30 },
    'T':       { 3:  1,  4:   5,  5:   20 },
  },

  freeSpinsCount: 10,
  bonusTriggerCount: 3, // 3+ scatter = free spins
};
```

## Connecting to the visual layer

```javascript
// Initialize the engine
const engine = new SlotEngine(EXAMPLE_PAR_SHEET);

// Listen for events and drive the visual layer
engine.addEventListener('spinStart', ({ detail }) => {
  visualLayer.startSpin(detail.grid); // tells reels where to stop
  audioEngine.onSpinStart();
});

engine.addEventListener('anticipation', ({ detail }) => {
  if (detail.active) {
    visualLayer.triggerAnticipation(detail.reelIndex);
    audioEngine.onAnticipation();
  }
});

engine.addEventListener('win', ({ detail }) => {
  visualLayer.showWin(detail.wins, detail.tier);
  audioEngine.win(detail.tier);
  particleEngine.celebrateWin(detail.wins, detail.tier);
});

engine.addEventListener('freeSpinsStart', ({ detail }) => {
  visualLayer.enterFreeSpinsMode(detail.count);
  audioEngine.onBonusEnter();
});

// Spin button handler
spinButton.on('pointertap', async () => {
  const grid = engine.spin();
  await visualLayer.spinToGrid(grid); // waits for reels to stop
  engine.resolve(grid);
});
```

## Smoke test without graphics (NOT RTP verification)

The engine is fully headless, so you can run it in Node to confirm the wiring works — spins resolve,
wins aggregate, events fire, free-spins state transitions. This is a **smoke test of the engine
structure only.** The figures it prints are **not** an RTP or hit-frequency verification: a Monte
Carlo loop is treated as verification *evidence* only inside `rtp-verification`, run against the
certified probability model with exact enumeration where tractable. Do not quote this loop's output
as the game's RTP.

```javascript
import { SlotEngine } from './slot-engine.js';

const engine = new SlotEngine({ ...PAR_SHEET, rng: seededRandom(42) });
let wins = 0, totalBet = 0, totalWon = 0;

for (let i = 0; i < 100_000; i++) {     // smoke run — does it work, not how much it pays
  totalBet += engine.betAmount;
  const grid   = engine.spin();
  const result = engine.resolve(grid);
  totalWon += result.totalWin;
  if (result.wins.length > 0) wins++;
}

// SMOKE-TEST ONLY — sanity that the engine returns plausible output.
// Authoritative RTP / hit-frequency come from h5g-slot-math (rtp-verification), not from here.
console.log(`[smoke] observed return ~${(totalWon / totalBet * 100).toFixed(2)}% (NOT verified RTP)`);
console.log(`[smoke] observed hits ~${(wins / 100_000 * 100).toFixed(2)}% (NOT verified hit freq)`);
```

## References

- `references/reel-strip-design.md` — the *data structure* of weighted strips and how the engine consumes them; routes all weighting-for-target-RTP/volatility decisions to h5g-slot-math (no numbers derived here)
- `references/payline-patterns.md` — standard payline set *geometries* (9-line, 20-line, 40-line), all-ways (243/1024), cluster pays, Megaways — structure only
- `references/feature-trigger-math.md` — the *inputs and shape* of scatter/free-spins/hold-and-win triggers; routes all probability and frequency CALCULATION to h5g-slot-math (probability-model → dependency-audit → rtp-verification), zero example odds
