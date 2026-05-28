# pixi-reels Cheatsheet

[pixi-reels](https://pixi-reels.schmooky.dev/) is an MIT-licensed slot reel engine for PixiJS v8. Use it for any real slot project — it handles reel state machines, symbol pooling, spin phases, win spotlights, cascade refills, and megaways. Headless testing mode lets you run full spin lifecycles in Node without a canvas.

## Install

```bash
npm install pixi-reels pixi.js@^8.17.0 gsap@^3.14.0
# Optional, only if using Spine-animated symbols:
npm install @esotericsoftware/spine-pixi-v8
```

## Minimal setup

```javascript
import { Application } from 'pixi.js';
import { ReelSetBuilder, SpriteReelSymbol } from 'pixi-reels';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

const reelSet = new ReelSetBuilder()
  .withReelCount(5)
  .withVisibleRowsPerReel(3)
  .withSymbolFactory((key) => new SpriteReelSymbol(textureFor(key)))
  .withParent(app.stage)
  .withCellSize(96)
  .build();

document.getElementById('spin-btn').addEventListener('click', () => {
  reelSet.spin();
});
```

The `build()` call validates the configuration at construction time. Forgetting a required call throws with a clear error message — not at first spin.

## Forcing outcomes

For testing or scripted demos, you can pin the landing grid:

```javascript
reelSet.setResult([
  ['A', 'A', 'A', 'A', 'A'],   // top row
  ['K', 'Q', 'J', 'T', 'A'],   // middle row
  ['Q', 'J', 'T', 'A', 'K'],   // bottom row
]);
reelSet.spin();
```

The cheats utilities in `pixi-reels` (`examples/shared/cheats.ts`) expose helpers for forcing scatters, near-misses, cascade sequences, anticipation, etc:

- `forceGrid(grid)` — pin the entire landing grid
- `forceLine(reelIndices, symbol)` — pin a specific payline outcome
- `forceScatters(count)` — pin a scatter count for bonus testing
- `forceNearMiss()` — pin a near-miss for emotional pacing tests
- `forceCell(reel, row, symbol)` — pin a single cell
- `holdAndWinProgress(progress)` — for hold-and-win mechanics
- `cascadeSequence(sequence)` — pin cascade outcomes
- `forceAnticipation()` — trigger the anticipation slowdown

## Events

The engine emits typed events you can subscribe to:

```javascript
reelSet.on('spinStart', () => { /* play spin sound */ });
reelSet.on('reelStop', (reelIndex) => { /* play tick sound */ });
reelSet.on('spinEnd', (result) => { /* check for wins */ });
reelSet.on('win', (winInfo) => { /* trigger celebration */ });
reelSet.on('cascadeStep', (step) => { /* between cascade rounds */ });
reelSet.on('anticipationStart', (reelIndex) => { /* play anticipation sting */ });
```

## Cascade refills (Bejeweled-style)

```javascript
// After detecting winners, refill the cleared cells while survivors stay put
reelSet.refill({
  winners: [[0,1],[0,2],[1,1]],  // [reelIndex, rowIndex] pairs
  grid: newGrid,                  // the post-refill state
});
```

## Megaways (variable rows per reel)

```javascript
new ReelSetBuilder()
  .withReelCount(6)
  .withVariableRowsPerReel({ min: 2, max: 7 })
  // ...
```

Then each spin independently picks a row count per reel, and the engine adjusts the visible window.

## Headless testing

For CI / Node testing:

```javascript
import { createTestReelSet, spinAndLand, expectGrid, captureEvents } from 'pixi-reels/testing';

test('three matching scatters trigger bonus', async () => {
  const reelSet = createTestReelSet({ reelCount: 5, rows: 3 });
  const events = captureEvents(reelSet);
  await spinAndLand(reelSet, [
    ['A','K','Q','J','T'],
    ['SCATTER','A','SCATTER','K','SCATTER'],
    ['Q','J','T','A','K'],
  ]);
  expectGrid(reelSet).toContainScatters(3);
  expect(events).toContainEqual({ type: 'bonusTrigger' });
});
```

No canvas, no DOM — runs in Node, fast.

## Custom symbol types

Three built-in symbol types:
- `SpriteReelSymbol` — static texture
- `AnimatedSpriteReelSymbol` — frame-based animation
- `SpineReelSymbol` — skeletal animation (requires `@esotericsoftware/spine-pixi-v8`)

For procedurally drawn symbols (e.g. using our `procedural-symbol-design` patterns), extend `ReelSymbol`:

```javascript
import { ReelSymbol } from 'pixi-reels';

class ProceduralReelSymbol extends ReelSymbol {
  constructor(key) {
    super();
    this.addChild(makeProceduralSymbol(key, this.cellSize));
  }
}
```

## Extension points

The fluent builder accepts:
- `.withSpinPhases([...])` — custom spin choreography phases
- `.withSymbolPool(size)` — adjust pool size per reel
- `.withMaskFactory((width, height) => mask)` — custom viewport masks
- `.withWinSpotlight(spotlightFactory)` — custom win highlight visuals
- `.withRng(rngFn)` — inject a seeded RNG for testing

When in doubt about an API surface, the [pixi-reels site](https://pixi-reels.schmooky.dev/) has examples covering all common slot variants (classic 5-reel, cascade, megaways, hold-and-win, diamond layouts).
