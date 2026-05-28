# Game Loop and Timestep

The accumulator pattern decouples game logic from frame rate. Logic always advances in fixed-size steps; rendering happens as fast as the display allows, interpolating between the last two logical states.

## Why fixed timestep

| Approach | Physics determinism | Fast device behavior | Slow device behavior |
|---|---|---|---|
| Variable `dt` | Non-deterministic — floats accumulate differently per frame | Correct speed | Correct speed but large steps can tunnel through collisions |
| Locked `requestAnimationFrame` | Tied to display rate | 120 Hz = 2× speed | 30 Hz = half speed |
| **Fixed accumulator** | Deterministic | Logic runs in batches, render interpolates | Logic catches up in multiple sub-steps, capped to prevent spiral |

## Timestep tuning table

| `FIXED_DT` | Notes |
|---|---|
| `1/60` (~16.7 ms) | Default for action games. Matches 60 Hz displays. Lowest latency at 60 fps. |
| `1/50` (20 ms) | Slightly more headroom on slow devices. Acceptable for platformers. |
| `1/30` (~33.3 ms) | Coarse. Physics at 30 Hz is noticeable but survivable for slower games. |
| `1/120` (~8.3 ms) | Overkill for most games; doubles CPU load. Use only if physics needs sub-frame precision. |
| `MAX_DELTA = 0.25` | Cap raw delta at 250 ms (~4 missed frames). Prevents spiral-of-death on tab restore or debugger pause. |

## Full accumulator harness

```javascript
// game-loop.js
export const FIXED_DT  = 1 / 60;   // seconds per logic step
export const MAX_DELTA = 0.25;      // clamp to prevent spiral-of-death

export class GameLoop {
  /**
   * @param {(dt: number) => void}    onFixed  — called N times per frame at fixed rate
   * @param {(alpha: number) => void} onRender — called once per frame; alpha is 0..1
   */
  constructor(onFixed, onRender) {
    this._onFixed   = onFixed;
    this._onRender  = onRender;
    this._accum     = 0;
    this._last      = 0;
    this._raf       = 0;
    this._running   = false;
    this._paused    = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._paused  = false;
    this._last    = performance.now();
    this._raf     = requestAnimationFrame(ts => this._tick(ts));
  }

  /** Full stop — clears RAF and resets accumulator. */
  stop() {
    this._running = false;
    this._paused  = false;
    cancelAnimationFrame(this._raf);
    this._accum = 0;
  }

  /**
   * Pause: stops RAF but preserves world state.
   * Safe to call from a visibility-change handler.
   */
  pause() {
    if (!this._running || this._paused) return;
    this._paused = true;
    cancelAnimationFrame(this._raf);
  }

  /**
   * Resume: resets `_last` to NOW so the first delta after unpausing
   * is near-zero instead of "however long the pause lasted."
   */
  resume() {
    if (!this._running || !this._paused) return;
    this._paused = false;
    this._last   = performance.now(); // critical reset
    this._raf    = requestAnimationFrame(ts => this._tick(ts));
  }

  _tick(now) {
    if (!this._running || this._paused) return;
    this._raf = requestAnimationFrame(ts => this._tick(ts));

    // 1. Compute wall-clock delta in seconds
    let delta = (now - this._last) / 1000;
    this._last = now;

    // 2. Clamp to prevent spiral-of-death
    if (delta > MAX_DELTA) delta = MAX_DELTA;

    // 3. Accumulate and drain with fixed steps
    this._accum += delta;
    while (this._accum >= FIXED_DT) {
      this._onFixed(FIXED_DT);
      this._accum -= FIXED_DT;
    }

    // 4. Render with interpolation factor alpha ∈ [0, 1)
    //    alpha = 0  → just ran a logic tick (render at current state)
    //    alpha = 1  → almost at the next tick (render ahead by one step)
    const alpha = this._accum / FIXED_DT;
    this._onRender(alpha);
  }
}
```

## Interpolation rendering

Each entity stores both its previous and current logical position. The renderer lerps between them using alpha to produce smooth visuals at any frame rate.

```javascript
// In your fixed-update system, save previous position before integrating:
function physicsSystem(world, dt) {
  for (const e of query(world, 'pos', 'vel')) {
    e.prevPos = { x: e.pos.x, y: e.pos.y }; // snapshot before move
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;
  }
}

// In your render callback:
function renderSystem(world, alpha) {
  for (const e of query(world, 'pos', 'prevPos', 'sprite')) {
    const sprite = e.sprite; // PixiJS Sprite or Container
    sprite.x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
    sprite.y = e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha;
  }
}
```

This pattern eliminates the "physics is smooth but sprites stutter" bug that appears when you render directly from logical position.

## Max-substeps cap

Without a cap, a device that stalls for 2 seconds (debugger breakpoint, battery throttle) will run 120 logic ticks in one frame, freezing the browser. The `MAX_DELTA` clamp limits this to 15 sub-steps at 60 Hz, which takes ~4 ms.

If your game absolutely needs deterministic replay, replace the `while` drain with a `MAX_SUBSTEPS` counter:

```javascript
const MAX_SUBSTEPS = 8;

this._accum += delta;
let steps = 0;
while (this._accum >= FIXED_DT && steps < MAX_SUBSTEPS) {
  this._onFixed(FIXED_DT);
  this._accum -= FIXED_DT;
  steps++;
}
// If we hit the cap, discard remaining accumulator to avoid drift compounding
if (steps === MAX_SUBSTEPS) this._accum = 0;
```

## Pause on tab hide

Browsers throttle `requestAnimationFrame` in background tabs and may fire a huge delta on restore. Pair the loop with the Page Visibility API:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    loop.pause();
  } else {
    loop.resume(); // resets _last — no lurch
  }
});
```

## Deterministic updates

For replay, netcode, or automated testing, inject a seeded RNG and ensure all `onFixed` calls use only the injected `dt` argument — never `performance.now()` or `Date.now()` inside logic systems. A headless test looks like:

```javascript
import { GameLoop, FIXED_DT } from './game-loop.js';

// Simulate 5 seconds of game without a browser
const loop = new GameLoop(updateWorld, () => {}); // empty renderer
loop._running = true; // bypass RAF

const TICKS = Math.round(5 / FIXED_DT); // 300 ticks
for (let i = 0; i < TICKS; i++) {
  updateWorld(FIXED_DT); // call directly
}
// Inspect world state deterministically
```

## requestAnimationFrame harness notes

- Always pass the `now` timestamp from the RAF callback into `_tick`. Do not call `performance.now()` inside `_tick` — the RAF timestamp is the browser's compositor time and is more accurate.
- In PixiJS v8, call `app.renderer.render(app.stage)` inside `onRender`, not inside `onFixed`. Rendering is always driven by the RAF cycle.
- If you use PixiJS's built-in ticker (`app.ticker`), disable it and drive rendering yourself so you keep control of the timestep: `app.ticker.stop()`.

```javascript
// Disable PixiJS auto-render; drive manually
app.ticker.stop();

const loop = new GameLoop(
  (dt) => { /* logic */ },
  (alpha) => {
    renderSystem(world, alpha);
    app.renderer.render(app.stage);
  }
);
loop.start();
```

## Common loop bugs

**"Entities speed up on 120 Hz displays."** You are not using a fixed timestep — delta is twice as small, so you apply 120 velocity increments per second instead of 60. Fix: the accumulator loop.

**"After unpausing, everything teleports."** `resume()` does not reset `_last`. Add `this._last = performance.now()` as the first line of `resume()` after clearing the paused flag.

**"Sprites are one frame behind the physics."** You are rendering directly from `e.pos` without interpolation. Add `e.prevPos`, snapshot before integration, interpolate in the render callback.

**"Loop runs twice as fast after a hot-module reload."** Two loops are running. Always call `loop.stop()` before starting a new one on hot reload. Keep a module-level singleton.
