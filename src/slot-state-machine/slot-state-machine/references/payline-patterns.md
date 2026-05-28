# Payline Patterns

A payline is a path across the reels. The engine reads one symbol per reel along the path and checks
for a left-to-right match. This file is the structural catalogue — line definitions, all-ways, cluster,
and Megaways evaluation. Payout *values* live in the paytable; payout *correctness* (RTP contribution)
is math-authority work (`h5g-slot-math`).

## Line encoding

A line is one row index per reel: `[row_reel0, row_reel1, ..., row_reelN]`. For a 5×3 grid rows are
0 (top), 1 (middle), 2 (bottom).

```javascript
const LINE_MIDDLE   = [1, 1, 1, 1, 1];
const LINE_TOP      = [0, 0, 0, 0, 0];
const LINE_BOTTOM   = [2, 2, 2, 2, 2];
const LINE_V        = [0, 1, 2, 1, 0];
const LINE_CARET    = [2, 1, 0, 1, 2];
```

## Standard line sets (5×3)

**9-line** (classic):
```javascript
const LINES_9 = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
  [0,1,2,1,0],[2,1,0,1,2],
  [1,0,0,0,1],[1,2,2,2,1],
  [0,0,1,2,2],[2,2,1,0,0],
];
```

**20-line** (most common modern set): the 9 above plus zig-zags that touch every cell roughly evenly.
**40-line**: dense set; most cells participate in 8+ lines. Generate programmatically and de-dupe.

Keep line sets in the PAR data, not hardcoded in eval, so the same engine runs any set.

## Left-to-right line evaluation (with wild)

```javascript
function checkLine(symbols, { wild = 'WILD', minRun = 3 } = {}) {
  // The matched symbol is the first non-wild; all-wild run pays as wild.
  const base = symbols[0] === wild ? (symbols.find(s => s !== wild) ?? wild) : symbols[0];
  let count = 0;
  for (const s of symbols) {
    if (s === base || s === wild) count++;
    else break;
  }
  return count >= minRun ? { symbol: base, count } : null;
}
```

Notes:
- **Left-to-right only** is the standard. Some games pay both ways — evaluate the reversed array too
  and take the higher, but never double-count the same line.
- **Scatters do not use lines.** They pay on total count anywhere in the window — evaluate separately.
- **Highest win per line** — if a line could match two ways (rare with wilds), keep the larger payout.

## All-ways / 243 / 1024

No fixed lines. A win is any same-symbol (or wild) appearing on consecutive reels starting at reel 0,
counting *positions per reel* as a multiplier.

```javascript
function evaluateAllWays(grid, paytable, bet, { wild = 'WILD' } = {}) {
  const wins = [];
  const symbols = new Set(grid.flat().filter(s => s !== wild && s !== 'SCATTER'));
  for (const sym of symbols) {
    let ways = 1, reelsHit = 0;
    for (const col of grid) {
      const matches = col.filter(s => s === sym || s === wild).length;
      if (matches === 0) break;
      ways *= matches; reelsHit++;
    }
    if (reelsHit >= 3) {
      const pay = (paytable[sym]?.[reelsHit] ?? 0) * bet * ways;
      if (pay > 0) wins.push({ symbol: sym, reels: reelsHit, ways, payout: pay });
    }
  }
  return wins;
}
// 5 reels of 3 rows with all reels hitting = 3^5 = 243 ways.
```

## Cluster pays

Win = a connected group (orthogonally adjacent) of N+ identical symbols anywhere in the grid. Used in
cascade/grid games. Flood-fill from each unvisited cell:

```javascript
function findClusters(grid, minSize = 5) {
  const W = grid.length, H = grid[0].length, seen = Array.from({length:W},()=>Array(H).fill(false));
  const clusters = [];
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    if (seen[x][y]) continue;
    const sym = grid[x][y], stack = [[x,y]], cells = [];
    while (stack.length) {
      const [cx,cy] = stack.pop();
      if (cx<0||cy<0||cx>=W||cy>=H||seen[cx][cy]||grid[cx][cy]!==sym) continue;
      seen[cx][cy] = true; cells.push([cx,cy]);
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
    if (cells.length >= minSize) clusters.push({ symbol: sym, cells });
  }
  return clusters;
}
```

## Megaways (variable rows)

Each reel independently lands 2–7 rows per spin. Ways = product of per-reel row counts. Evaluate as
all-ways but with the spin's actual row counts.

```javascript
const rowsThisSpin = [4, 7, 7, 7, 5];          // ways = 4*7*7*7*5 = 6860
const grid = rowsThisSpin.map((rows, reel) => readColumn(strips[reel], stops[reel], rows));
```

## Math authority

The *shape* of evaluation lives here; whether a given line set + paytable + weighting hits a target
RTP/volatility is **owned by `h5g-slot-math`** (`probability-model` → `dependency-audit` →
`rtp-verification`). Lines that share cells are **not independent** — never multiply line hit
probabilities without a dependency audit. See `feature-trigger-math.md`.
