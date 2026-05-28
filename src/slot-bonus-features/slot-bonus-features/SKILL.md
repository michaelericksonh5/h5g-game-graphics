---
name: slot-bonus-features
description: "Build all bonus feature modes for slot machines — free spins mode, hold-and-win/lock-and-spin, pick-and-click reveal games, wheel of fortune, multiplier ladders, expanding wild free spins, and gamble/double-up feature. Each feature is a complete self-contained module with its own UI, animations, audio hooks, and state transitions. Use when implementing any feature beyond the base spinning reels: \"free spins\", \"bonus game\", \"pick and click\", \"wheel of fortune\", \"hold and win\", \"multiplier\", \"bonus round\", \"mini game\", or when a slot needs more than just basic spinning."
---

# Slot Bonus Features

Each bonus feature is an independently reusable module. They share a common interface: `enter(data)` → play → `exit()` → return to base game.

## Common interface

```javascript
class BonusFeature extends EventTarget {
  async enter(data = {}) { /* Override */ }
  async exit()           { /* Override */ }
  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
```

All features fire `bonusWin` events with `{ amount }` that the main game handles for balance updates.

---

## Feature 1: Free Spins Mode

The most common feature. Modified base game — different background, music, spin counter, win accumulator.

```javascript
class FreeSpinsFeature extends BonusFeature {
  constructor(engine, visualLayer, audioEngine) {
    super();
    this.engine  = engine;
    this.visual  = visualLayer;
    this.audio   = audioEngine;
  }

  async enter({ count = 10, multiplier = 1, modifier = null }) {
    this.spinsRemaining = count;
    this.totalWin       = 0;
    this.multiplier     = multiplier;
    this.modifier       = modifier; // 'sticky_wilds' | 'expanding_wilds' | null

    // Visual transition
    await this.visual.transitionToFreeSpins();
    this.audio.onBonusEnter();

    // Show counter overlay
    this.visual.showFreeSpinsCounter(count);
    this.visual.showFreeSpinsAccumulator(0);

    // Run the spins
    while (this.spinsRemaining > 0) {
      await this.runOneSpin();
    }

    // End
    await this.showTotalWinSummary();
    await this.visual.transitionFromFreeSpins();
    this.audio.onBonusExit();
    this.emit('bonusComplete', { totalWin: this.totalWin });
  }

  async runOneSpin() {
    const grid = this.engine.spin();
    await this.visual.spinToGrid(grid);
    const result = this.engine.resolve(grid);

    const win = result.totalWin * this.multiplier;
    this.totalWin += win;
    this.spinsRemaining--;

    this.visual.updateFreeSpinsCounter(this.spinsRemaining);
    this.visual.updateFreeSpinsAccumulator(this.totalWin);

    if (result.wins.length > 0) {
      this.emit('bonusWin', { amount: win });
    }

    // Check retrigger (3+ scatter in free spins = +5 more)
    const scatters = this.engine.countSymbol(grid, 'SCATTER');
    if (scatters >= 3) {
      const bonus = 5;
      this.spinsRemaining += bonus;
      this.visual.showRetrigger(bonus);
      this.audio.playRetriggerSound();
    }

    // Wait for win animations to complete
    await delay(win > 0 ? 1800 : 800);
  }

  async showTotalWinSummary() {
    this.visual.showFreeSpinsTotalWin(this.totalWin);
    await delay(3000);
  }
}
```

---

## Feature 2: Hold and Win / Lock & Spin

Money symbols land and lock in place. 3 respins, reset on each new lock. Collects until no new symbols land.

```javascript
class HoldAndWinFeature extends BonusFeature {
  async enter({ triggerSymbols, initialGrid }) {
    const cells   = Array(15).fill(null); // 5×3 grid
    const respins = { count: 3 };

    // Place triggering symbols
    for (const sym of triggerSymbols) {
      const idx = sym.reel * 3 + sym.row;
      cells[idx] = sym.value;
    }

    this.visual.showHoldAndWinOverlay();
    this.visual.highlightLockedCells(cells);
    this.audio.playHoldAndWinEntry();

    while (respins.count > 0) {
      respins.count--;
      this.visual.updateRespinCounter(respins.count);

      // Spin only unlocked cells
      const newSymbols = this.engine.generateHoldAndWinSpin(cells);
      await this.visual.playHoldAndWinSpin(newSymbols, cells);

      let newLocks = 0;
      for (const sym of newSymbols) {
        const idx = sym.reel * 3 + sym.row;
        if (sym.value !== null && cells[idx] === null) {
          cells[idx] = sym.value;
          this.visual.lockCell(sym.reel, sym.row, sym.value);
          this.audio.playCellLock();
          newLocks++;
        }
      }

      if (newLocks > 0) {
        respins.count = 3; // Reset on any new lock
        this.visual.flashRespinReset();
      }

      await delay(1200);
    }

    const totalWin = cells.reduce((s, v) => s + (v ?? 0), 0);
    this.visual.showHoldAndWinTotal(totalWin);
    this.audio.playHoldAndWinComplete(totalWin);
    await delay(3000);

    this.emit('bonusComplete', { totalWin });
  }
}
```

---

## Feature 3: Pick and Click / Pick Me Bonus

Player selects from a grid of items. Each reveals a prize. Feature ends when "COLLECT" is revealed.

```javascript
class PickAndClickFeature extends BonusFeature {
  async enter({ items, maxPicks = 5 }) {
    this.prizes = this.engine.generatePickBonusPrizes(items);
    this.picks  = 0;
    this.totalWin = 0;

    const overlay = this.visual.showPickAndClickOverlay(items.length);
    this.audio.playBonusEntry();

    return new Promise(resolve => {
      overlay.onItemPicked = async (index) => {
        if (this.picks >= maxPicks) return;
        const prize = this.prizes[index];
        this.picks++;

        await this.visual.revealPickItem(index, prize);
        this.audio.playRevealSound(prize.type);

        if (prize.type === 'coins') {
          this.totalWin += prize.amount;
          this.visual.updatePickTotal(this.totalWin);
          this.emit('bonusWin', { amount: prize.amount });
        } else if (prize.type === 'multiplier') {
          this.visual.showMultiplierApplied(prize.multiplier);
          this.totalWin *= prize.multiplier;
        } else if (prize.type === 'collect' || this.picks >= maxPicks) {
          await delay(1500);
          await this.visual.hidePickAndClickOverlay();
          resolve(this.totalWin);
        }
      };
    });
  }
}
```

---

## Feature 4: Wheel of Fortune

Spinning pointer wheel with prize segments. Dramatic slowdown and reveal.

```javascript
class WheelFeature extends BonusFeature {
  async enter({ segments }) {
    const wheel    = this.visual.showWheelOverlay(segments);
    const result   = this.engine.pickWheelSegment(segments);
    const targetAngle = this.calculateTargetAngle(segments.indexOf(result));

    this.audio.playWheelSpin();

    // Animate wheel: fast spin → slow → stop on segment
    await this.visual.spinWheel({
      totalRotations: 4 + Math.random() * 2,
      finalAngle: targetAngle,
      duration: 4.5,
      easing: 'power2.out',  // starts fast, slows dramatically at end
    });

    this.audio.playWheelStop();
    await this.visual.revealWheelResult(result);
    await delay(2000);
    this.visual.hideWheelOverlay();

    this.emit('bonusComplete', { totalWin: result.amount ?? 0 });
  }

  calculateTargetAngle(segmentIndex) {
    const segments = this.engine.config.wheelSegments;
    const segAngle = 360 / segments.length;
    // Add 4 full rotations + offset to land on segment
    return (4 * 360) + (segmentIndex * segAngle) + (segAngle / 2);
  }
}
```

---

## Feature 5: Multiplier Ladder

A persistent side-panel meter that climbs with each cascade or win. Common in crash-style and Megaways games.

```javascript
class MultiplierLadder {
  constructor(visualLayer) {
    this.visual    = visualLayer;
    this.level     = 0;
    this.values    = [1, 2, 3, 5, 8, 10, 15, 25, 50, 100]; // ladder rungs
    this.currentMultiplier = 1;
  }

  onWin(baseWin) {
    if (this.level < this.values.length - 1) {
      this.level++;
      this.currentMultiplier = this.values[this.level];
      this.visual.advanceMultiplierLadder(this.level, this.currentMultiplier);
    }
    return baseWin * this.currentMultiplier;
  }

  reset() {
    this.level = 0;
    this.currentMultiplier = 1;
    this.visual.resetMultiplierLadder();
  }
}
```

---

## Visual layer requirements per feature

Each feature needs these display components (implement in `slot-hud-and-ui`):

| Feature | Required visuals |
|---|---|
| Free Spins | Mode transition animation, spin counter badge, accumulator display, retrigger flash |
| Hold and Win | Grid overlay with cell-lock animation, respin counter, total win display |
| Pick and Click | Item grid with cover sprites, reveal animation, running total |
| Wheel | Spinning wheel mesh, pointer indicator, segment labels |
| Multiplier Ladder | Side-panel with rungs, rung highlight on advance, glow on max |

## References

- `references/bonus-ui-patterns.md` — visual templates and transition animations for each bonus overlay
- `references/bonus-math.md` — expected value calculations for each feature type; how to tune pick game prize pools; wheel segment weighting
