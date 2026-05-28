---
name: sidescroller-engine
description: Headless game engine STRUCTURE for 2D side-scroller, sidescroller, platformer, endless runner, and arcade game projects built with PixiJS v8 and plain JavaScript. Use for game loop, fixed timestep, game engine setup, entity component system, ECS, object pooling, spawn enemies, enemy waves, score manager, lives system, wave manager, game state machine, scene stack, input abstraction, touch controls, virtual joystick, or any non-slot arcade game that needs a runnable loop and logic core. Disambiguation: this skill owns the headless engine STRUCTURE (loop, ECS, input, scene/score state) for non-slot 2D games; for a SLOT engine use slot-state-machine; for jump/collision physics use platformer-physics; for drawing and animating characters use procedural-sprite-animation.
---

# Sidescroller Engine

The headless logic core for non-slot 2D arcade games. No visuals here — only loop, state, entities, and events. Every rendering and audio layer plugs into this as a data source.

## The core principle: structure first, pixels second

When you build a game loop from scratch, you reach for `requestAnimationFrame` with raw delta math, scatter state into globals, and call it done. Three hours later you have a broken pause, GC spikes from spawning enemies, and input that fires twice on touch. Don't do that. Start from the engine skeleton here and layer visuals on top. The structural decisions — fixed timestep, pooled entities, an event bus, a scene stack — are the ones that hurt most to retrofit.

## What this skill does NOT own

Cross-skill boundaries are hard lines. Violating them produces duplicated, contradictory code:

- Rendering characters and animated sprites → **procedural-sprite-animation**
- Level geometry, tilemaps, tile collision → **tilemap-and-level-design**
- Jump arcs, gravity, collision resolution → **platformer-physics**
- Camera follow, parallax layers, world scrolling → **sidescroller-camera-and-parallax**
- Screen shake, particle bursts, hit-flash juice → **particle-systems-and-juice**
- Audio (SFX, BGM, adaptive layers) → **tonejs-game-audio**, **procedural-sfx-design**, **adaptive-game-music**
- Post-process filters and shader effects → **game-shaders-and-effects**
- Final QA pass and sign-off checklist → **game-qa-and-testing** (always runs last)
- Repository layout, Perforce setup, build pipeline → **webgamedev-structure**

If a game adds RNG-driven loot drops or collectible odds that must be balanced or certified, defer that math to the **h5g-slot-math** suite. Most arcade titles won't need it — only mention it if the brief explicitly calls for certifiable probability.

## Game states

```javascript
export const GAME_STATE = {
  LOADING:    'LOADING',    // assets loading / first paint
  MENU:       'MENU',       // title / main menu
  PLAYING:    'PLAYING',    // active gameplay
  PAUSED:     'PAUSED',     // overlay pause
  WAVE_CLEAR: 'WAVE_CLEAR', // brief inter-wave fanfare
  GAME_OVER:  'GAME_OVER',  // lose condition reached
  VICTORY:    'VICTORY',    // final wave cleared
};
```

## The game loop (fixed timestep, interpolated render)

The loop runs physics/logic at a constant `FIXED_DT` (typically 1/60 s), accumulated against wall time, then renders at whatever rate the display allows. See `references/game-loop-and-timestep.md` for full derivation, tuning table, and pause/resume details.

```javascript
const FIXED_DT   = 1 / 60;   // seconds per logic tick
const MAX_DELTA  = 0.25;      // spiral-of-death cap (~4 frames skipped max)

export class GameLoop {
  constructor(onFixed, onRender) {
    this._onFixed   = onFixed;   // (dt: number) => void  — logic/physics
    this._onRender  = onRender;  // (alpha: number) => void — interpolated draw
    this._accum     = 0;
    this._last      = 0;
    this._raf       = 0;
    this._running   = false;
  }

  start() {
    this._running = true;
    this._last    = performance.now();
    this._raf     = requestAnimationFrame(this._tick.bind(this));
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  pause()  { this._running = false; cancelAnimationFrame(this._raf); }
  resume() {
    this._running = true;
    this._last = performance.now(); // reset to avoid large delta on unpause
    this._raf  = requestAnimationFrame(this._tick.bind(this));
  }

  _tick(now) {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._tick.bind(this));

    let delta = (now - this._last) / 1000; // ms → seconds
    this._last = now;
    if (delta > MAX_DELTA) delta = MAX_DELTA; // clamp spiral-of-death

    this._accum += delta;
    while (this._accum >= FIXED_DT) {
      this._onFixed(FIXED_DT);
      this._accum -= FIXED_DT;
    }

    const alpha = this._accum / FIXED_DT; // 0..1 interpolation factor
    this._onRender(alpha);
  }
}
```

## Entity/Component store with object pooling

A pragmatic ECS for small HTML5 games: plain objects for components, typed arrays avoided unless profiling demands them. Pooling eliminates GC spikes from rapid bullet/enemy/pickup spawning. See `references/entity-component-system.md` for pool internals, query helpers, and system iteration order.

```javascript
let _nextId = 1;

export function createEntity(world, components = {}) {
  const id = _nextId++;
  world.entities.set(id, { id, ...components });
  return id;
}

export function destroyEntity(world, id) {
  world.entities.delete(id);
  world.bus.emit('entityDestroyed', { id });
}

export function query(world, ...requiredKeys) {
  const out = [];
  for (const e of world.entities.values()) {
    if (requiredKeys.every(k => k in e)) out.push(e);
  }
  return out;
}

// Pool: recycles entities of a given archetype
export class EntityPool {
  constructor(world, factory, size = 64) {
    this._world   = world;
    this._factory = factory;  // () => component map
    this._free    = [];
    for (let i = 0; i < size; i++) this._free.push(createEntity(world, factory()));
    // pre-mark all as inactive
    for (const id of this._free) world.entities.get(id).active = false;
  }

  acquire() {
    if (this._free.length === 0) {
      const id = createEntity(this._world, this._factory());
      this._world.entities.get(id).active = false;
      this._free.push(id);
    }
    const id = this._free.pop();
    const e  = this._world.entities.get(id);
    e.active = true;
    return e;
  }

  release(entity) {
    entity.active = false;
    this._free.push(entity.id);
  }
}
```

## Event bus

A tiny synchronous bus that decouples systems. Audio and visual layers subscribe; logic systems emit.

```javascript
export class EventBus {
  constructor() { this._listeners = new Map(); }

  on(type, fn)  {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }

  off(type, fn) {
    const arr = this._listeners.get(type);
    if (arr) this._listeners.set(type, arr.filter(f => f !== fn));
  }

  emit(type, payload = {}) {
    for (const fn of this._listeners.get(type) ?? []) fn(payload);
  }
}
```

Canonical event names — agree on these across all systems:

| Event | Payload keys | Who emits | Who listens |
|---|---|---|---|
| `entityDestroyed` | `id` | ECS | renderer, audio |
| `playerHit` | `lives` | collision system | HUD, audio, juice |
| `enemyKilled` | `id, x, y, points` | combat system | score, particles, audio |
| `pickupCollected` | `id, type, value` | physics | score, audio |
| `waveStart` | `wave, count` | wave manager | HUD, audio |
| `waveClear` | `wave` | wave manager | scene stack, audio |
| `gameOver` | `score` | lives manager | scene stack, audio |
| `scoreChange` | `score, delta` | score manager | HUD |

## Score / lives / wave manager

```javascript
export class GameSession {
  constructor(bus, config = {}) {
    this.bus   = bus;
    this.score = 0;
    this.lives = config.lives ?? 3;
    this.wave  = 0;
    this._waveEnemyCount   = config.baseEnemies ?? 6;
    this._waveEnemiesAlive = 0;
  }

  addScore(delta) {
    this.score += delta;
    this.bus.emit('scoreChange', { score: this.score, delta });
  }

  hit() {
    this.lives = Math.max(0, this.lives - 1);
    this.bus.emit('playerHit', { lives: this.lives });
    if (this.lives === 0) this.bus.emit('gameOver', { score: this.score });
  }

  startWave() {
    this.wave++;
    this._waveEnemiesAlive = this._waveEnemyCount + (this.wave - 1) * 2;
    this.bus.emit('waveStart', { wave: this.wave, count: this._waveEnemiesAlive });
  }

  enemyKilled(id, x, y, points) {
    this.addScore(points);
    this.bus.emit('enemyKilled', { id, x, y, points });
    this._waveEnemiesAlive--;
    if (this._waveEnemiesAlive <= 0) {
      this.bus.emit('waveClear', { wave: this.wave });
    }
  }
}
```

## Scene / state stack

Scenes own their own update and render logic. A stack (rather than a flat switch) lets pause or gameover overlay render under them without tearing down the play scene.

```javascript
export class SceneStack {
  constructor(loop, bus) {
    this._loop   = loop;
    this._bus    = bus;
    this._stack  = [];
  }

  push(scene) {
    this._stack.at(-1)?.onPause?.();
    scene.onEnter?.();
    this._stack.push(scene);
  }

  pop() {
    const top = this._stack.pop();
    top?.onExit?.();
    this._stack.at(-1)?.onResume?.();
    return top;
  }

  replace(scene) { this.pop(); this.push(scene); }

  update(dt)    { this._stack.at(-1)?.update?.(dt); }
  render(alpha) { this._stack.at(-1)?.render?.(alpha); }
}

// Example play scene skeleton
export class PlayScene {
  constructor(world, session, loop) {
    this.world   = world;
    this.session = session;
    this.loop    = loop;
  }
  onEnter()  { this.session.startWave(); }
  onPause()  { this.loop.pause(); }
  onResume() { this.loop.resume(); }
  onExit()   { /* cleanup entities */ }
  update(dt) { /* run systems */ }
  render(alpha) { /* drive renderer */ }
}
```

## Mobile-first input (brief overview)

Input is abstracted through a single `InputState` object so systems never query hardware directly. On mobile this is a virtual joystick + action buttons drawn in PixiJS Graphics (no images). On desktop the same `InputState` is driven from keyboard events. See `references/input-and-touch-controls.md` for the full virtual joystick code, 44pt touch-target sizing, multitouch handling via pointer events, and Gamepad API note.

```javascript
export const InputState = {
  axis: { x: 0, y: 0 },  // -1..1 normalized
  jump:   false,
  attack: false,
  _jumpConsumed:   false,
  _attackConsumed: false,
  consumeJump()   { const v = this.jump   && !this._jumpConsumed;   this._jumpConsumed   = this.jump;   return v; },
  consumeAttack() { const v = this.attack && !this._attackConsumed; this._attackConsumed = this.attack; return v; },
};
```

## Wiring the engine together

```javascript
import { Application } from 'pixi.js';
import { GameLoop }    from './game-loop.js';
import { EventBus }    from './event-bus.js';
import { GameSession } from './game-session.js';
import { SceneStack }  from './scene-stack.js';

const app = new Application();
await app.init({
  resizeTo: window,
  resolution: Math.min(window.devicePixelRatio, 2),
  autoDensity: true,
  backgroundColor: 0x0a0a1a,
});
document.body.appendChild(app.canvas);

const bus     = new EventBus();
const world   = { entities: new Map(), bus };
const session = new GameSession(bus, { lives: 3, baseEnemies: 6 });
const scenes  = new SceneStack(null, bus); // loop assigned below

const loop = new GameLoop(
  (dt)    => scenes.update(dt),
  (alpha) => { scenes.render(alpha); app.renderer.render(app.stage); }
);
scenes._loop = loop;

// Wire event bus to audio, HUD, etc.
bus.on('playerHit',   ({ lives })      => hud.setLives(lives));
bus.on('scoreChange', ({ score })      => hud.setScore(score));
bus.on('waveStart',   ({ wave })       => hud.showWaveBanner(wave));
bus.on('gameOver',    ({ score })      => scenes.push(new GameOverScene(score)));

scenes.push(new MenuScene(scenes, loop));
loop.start();
```

## System update order

Run systems in this order each fixed tick to avoid one-frame-behind artifacts:

1. **Input** — flush hardware events into `InputState`
2. **Player** — apply input to player entity velocity/state
3. **AI / spawner** — enemy decisions, wave spawning
4. **Physics** — integrate velocities, resolve collisions (→ platformer-physics owns this)
5. **Combat** — hit detection, damage application, death flags
6. **Cleanup** — destroy flagged entities, return to pools
7. **Score / session** — aggregate events from this tick

## Workflow

1. **Start from the wiring block above.** Copy the `GameLoop + EventBus + GameSession + SceneStack` skeleton into your project. Do not flatten into globals.

2. **Sketch the scene transitions.** Which scenes exist? What events trigger pushes/pops? Write a comment diagram before any code.

3. **Define entity archetypes.** Player, enemy, bullet, pickup, hazard. List their component keys. Define one `EntityPool` per archetype that spawns frequently.

4. **Wire the bus before writing systems.** Drop in the canonical event table. Every system emits and subscribes through the bus — never calls another system directly.

5. **Implement systems one at a time.** Follow the update order: input → player → AI → physics → combat → cleanup → score.

6. **Add visuals last** (→ procedural-sprite-animation for characters, → sidescroller-camera-and-parallax for world scroll). The engine runs headless — test it without a renderer using `loop._onFixed(1/60)` calls in a script.

7. **QA pass** → **game-qa-and-testing** owns the sign-off checklist. Run it after all systems are stable.

## Common failures and their fixes

**"Game slows down when the tab is backgrounded, then lurches on return."** The raw delta on tab-restore is huge (seconds). The `MAX_DELTA` clamp in `GameLoop._tick` prevents the spiral-of-death. If you removed it, put it back. If the game is still lurching, also pause the loop on `document.visibilitychange`.

**"Bullets stutter visually even though physics is smooth."** You're not using the render alpha for interpolation. Pass `alpha` into the renderer and lerp each entity's display position between its previous and current logical position. See `references/game-loop-and-timestep.md` for the interpolation pattern.

**"GC pauses every few seconds during heavy enemy waves."** You're calling `createEntity` for every bullet/enemy. Use `EntityPool` and `release()` on death. Check with the browser heap profiler — you should see a flat retained size during play.

**"Touch jump fires twice."** You're listening to both `pointerdown` and `pointertap`. Pick one. For jump, listen to `pointerdown` on the button and use `consumeJump()` so the action fires once per press.

**"Pause doesn't resume correctly — entities teleport."** `GameLoop.resume()` resets `this._last` to the current timestamp before restarting. If you copy the loop without that reset, the first delta after unpause will include the entire pause duration.

**"Wave manager thinks the wave is over immediately."** `_waveEnemiesAlive` starts at zero before `startWave()` is called, or enemies are being killed during spawn. Call `startWave()` before spawning any entities for that wave. If enemies can die during the spawn animation, guard the `waveClear` check with a `waveStarted` flag.

**"Score updates stutter on the HUD."** The `scoreChange` event fires every tiny pickup. Batch by throttling HUD updates to once per render frame, or accumulate `delta` and emit a single update at the end of the fixed tick.

## References

Detailed references — load only what the current task needs:

- `references/game-loop-and-timestep.md` — full accumulator derivation, fixed vs variable timestep tradeoffs, interpolation rendering formula, delta clamping, max-substeps cap, deterministic updates, pause/resume edge cases, and a timestep tuning table with latency/jitter tradeoffs.
- `references/entity-component-system.md` — pragmatic ECS for small HTML5 games: component storage, pooled allocation in depth, spawn/despawn/recycle lifecycle, system iteration and query helpers, and how entity state feeds the PixiJS renderer.
- `references/input-and-touch-controls.md` — mobile-first input: an on-screen virtual joystick and action buttons drawn entirely in PixiJS Graphics (no external images), multitouch handling via pointer events, 44pt minimum touch targets, keyboard mapping for desktop, and a Gamepad API primer.
