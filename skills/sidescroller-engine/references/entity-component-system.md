# Entity Component System

A pragmatic ECS for small HTML5 games. No typed arrays, no archetype shuffling — just plain JavaScript objects in a `Map`, a pool per archetype, and explicit system functions. This matches how most H5G-scale games actually work: a few hundred entities at peak, not millions.

## Core world structure

```javascript
// world.js
import { EventBus } from './event-bus.js';

export function createWorld() {
  return {
    entities: new Map(), // id → entity object
    bus: new EventBus(),
  };
}
```

Entities are plain objects. Their "components" are just named properties. No classes, no decorators:

```javascript
// A bullet entity:
{
  id: 42,
  active: true,
  pos:     { x: 120, y: 300 },
  prevPos: { x: 115, y: 300 }, // interpolation snapshot
  vel:     { x: 800, y: 0 },
  damage:  10,
  team:    'player',
  ttl:     2.0,              // time-to-live in seconds
  sprite:  <PixiJS Sprite>,  // renderer handle
}
```

## Entity lifecycle

```javascript
let _nextId = 1;

export function createEntity(world, components = {}) {
  const id = _nextId++;
  const entity = { id, active: true, ...components };
  world.entities.set(id, entity);
  return entity;
}

export function destroyEntity(world, entity) {
  entity.active = false;
  entity._pendingDestroy = true;
  // Actual removal deferred to cleanup system to avoid mutating the Map mid-iteration
}

// Run once per fixed tick at end of system list
export function cleanupSystem(world) {
  for (const [id, e] of world.entities) {
    if (e._pendingDestroy) {
      if (e.sprite) {
        e.sprite.destroy(); // remove from PixiJS scene graph
      }
      world.entities.delete(id);
      world.bus.emit('entityDestroyed', { id });
    }
  }
}
```

## Query helper

```javascript
/**
 * Returns all active entities that have ALL of the given component keys.
 * Allocation-free if you reuse the array (pass a pre-allocated out array).
 */
export function query(world, ...keys) {
  const result = [];
  for (const e of world.entities.values()) {
    if (e.active && keys.every(k => k in e)) result.push(e);
  }
  return result;
}

// Tag-based query: entity.tags is a Set<string>
export function queryTag(world, tag) {
  const result = [];
  for (const e of world.entities.values()) {
    if (e.active && e.tags?.has(tag)) result.push(e);
  }
  return result;
}
```

For performance-critical loops (many bullets), cache the query result and invalidate it when entities are added/removed. For typical arcade entity counts (<300), raw iteration is fast enough.

## Object pool

Pools eliminate GC pauses from rapid spawn/despawn cycles. One pool per archetype (bullet, enemy, pickup, explosion).

```javascript
export class EntityPool {
  /**
   * @param {object}     world
   * @param {() => object} factory — returns a fresh component map each call
   * @param {number}     initialSize
   */
  constructor(world, factory, initialSize = 64) {
    this._world   = world;
    this._factory = factory;
    this._free    = [];

    for (let i = 0; i < initialSize; i++) {
      const e = createEntity(world, factory());
      e.active = false;
      this._free.push(e);
    }
  }

  /**
   * Acquire an inactive entity from the pool.
   * If the pool is empty, allocates a new entity (pool grows).
   */
  acquire(overrides = {}) {
    let e;
    if (this._free.length > 0) {
      e = this._free.pop();
    } else {
      e = createEntity(this._world, this._factory());
    }
    Object.assign(e, overrides);
    e.active           = true;
    e._pendingDestroy  = false;
    return e;
  }

  /**
   * Return entity to pool. Caller must hide the sprite before releasing.
   */
  release(entity) {
    if (!entity) return;
    entity.active          = false;
    entity._pendingDestroy = false;
    if (entity.sprite) entity.sprite.visible = false;
    this._free.push(entity);
  }

  get available() { return this._free.length; }
}
```

### Pool usage example — bullets

```javascript
// Bullet factory: defines component shape for the pool
function bulletFactory() {
  const sprite = new Sprite(bulletTexture);
  sprite.anchor.set(0.5);
  sprite.visible = false;
  app.stage.addChild(sprite);

  return {
    pos:     { x: 0, y: 0 },
    prevPos: { x: 0, y: 0 },
    vel:     { x: 0, y: 0 },
    damage:  0,
    ttl:     0,
    team:    'player',
    tags:    new Set(['bullet']),
    sprite,
  };
}

const bulletPool = new EntityPool(world, bulletFactory, 128);

// Spawn a bullet from the player position
export function fireBullet(world, pool, origin, vx, vy) {
  const b = pool.acquire({
    pos:    { x: origin.x, y: origin.y },
    prevPos:{ x: origin.x, y: origin.y },
    vel:    { x: vx, y: vy },
    damage: 10,
    ttl:    1.5,
  });
  b.sprite.position.set(origin.x, origin.y);
  b.sprite.visible = true;
  return b;
}
```

## System definitions

Systems are plain functions; they receive `(world, dt)` and iterate via `query`. No base classes.

```javascript
// systems/bullet-system.js
export function bulletSystem(world, dt, pool) {
  const bullets = query(world, 'vel', 'ttl', 'pos', 'prevPos');
  for (const b of bullets) {
    b.prevPos.x = b.pos.x;
    b.prevPos.y = b.pos.y;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.ttl   -= dt;

    if (b.ttl <= 0 || isOffScreen(b.pos)) {
      pool.release(b);
    }
  }
}

// systems/enemy-system.js
export function enemySystem(world, dt) {
  const enemies = queryTag(world, 'enemy');
  for (const e of enemies) {
    e.prevPos.x = e.pos.x;
    e.prevPos.y = e.pos.y;
    // Simple left-scroll: enemies move left
    e.pos.x -= e.speed * dt;
    if (e.pos.x < -100) {
      world.bus.emit('enemyEscaped', { id: e.id });
      destroyEntity(world, e);
    }
  }
}

// systems/combat-system.js — AABB hit detection
export function combatSystem(world) {
  const bullets = query(world, 'damage', 'pos', 'team');
  const enemies = queryTag(world, 'enemy');

  for (const b of bullets) {
    if (b.team !== 'player') continue;
    for (const e of enemies) {
      if (overlaps(b.pos, b.hitbox ?? 8, e.pos, e.hitbox ?? 24)) {
        e.hp -= b.damage;
        world.bus.emit('bulletHit', { bulletId: b.id, enemyId: e.id });
        bulletPool.release(b); // recycle bullet immediately on hit
        if (e.hp <= 0) {
          world.bus.emit('enemyKilled', { id: e.id, x: e.pos.x, y: e.pos.y, points: e.points });
          destroyEntity(world, e);
        }
        break;
      }
    }
  }
}

function overlaps(aPos, aR, bPos, bR) {
  const dx = aPos.x - bPos.x;
  const dy = aPos.y - bPos.y;
  const r  = aR + bR;
  return dx * dx + dy * dy < r * r; // circle approximation
}

function isOffScreen(pos, margin = 200) {
  return pos.x > window.innerWidth  + margin
      || pos.x < -margin
      || pos.y > window.innerHeight + margin
      || pos.y < -margin;
}
```

## System update order

Call systems in this sequence every fixed tick:

```javascript
export function updateWorld(world, dt, pools) {
  // 1. Input is flushed by the input layer before this call
  playerSystem(world, dt);          // apply input → player vel/state
  aiSystem(world, dt);              // enemy decisions
  spawnerSystem(world, dt, pools);  // wave spawning
  bulletSystem(world, dt, pools.bullets); // move bullets, TTL
  enemySystem(world, dt);           // move enemies
  combatSystem(world, pools.bullets);     // hit detection, damage
  cleanupSystem(world);             // remove flagged entities, emit events
  // Score/session updates happen via bus listeners in cleanupSystem events
}
```

## Render sync — feeding PixiJS

The render callback runs outside the fixed loop (see `game-loop-and-timestep.md`). It reads entity state and drives PixiJS sprite positions using interpolation.

```javascript
// systems/render-system.js
export function renderSystem(world, alpha) {
  // All entities with a sprite and position
  for (const e of query(world, 'pos', 'prevPos', 'sprite')) {
    if (!e.sprite.visible && !e.active) continue;
    e.sprite.visible = e.active;
    if (!e.active) continue;

    // Interpolate between last fixed tick's position and current
    e.sprite.x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
    e.sprite.y = e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha;

    // Optional: sync rotation if entities rotate
    if ('angle' in e && 'prevAngle' in e) {
      e.sprite.rotation = e.prevAngle + (e.angle - e.prevAngle) * alpha;
    }
  }
}
```

## Wave spawner

```javascript
// systems/spawner-system.js
export class WaveSpawner {
  constructor(world, enemyPool, config) {
    this._world     = world;
    this._pool      = enemyPool;
    this._config    = config;   // [{ count, speed, hp, interval }] per wave
    this._wave      = 0;
    this._spawned   = 0;
    this._total     = 0;
    this._timer     = 0;
    this._interval  = 0;
    this._active    = false;
  }

  startWave(waveIndex) {
    const cfg = this._config[waveIndex] ?? this._config.at(-1);
    this._wave     = waveIndex;
    this._spawned  = 0;
    this._total    = cfg.count + waveIndex * 2; // escalate
    this._timer    = 0;
    this._interval = cfg.interval ?? 0.8;
    this._active   = true;
    this._speed    = cfg.speed ?? 80;
    this._hp       = cfg.hp ?? 20;
  }

  update(dt) {
    if (!this._active) return;
    this._timer -= dt;
    if (this._timer > 0 || this._spawned >= this._total) return;

    this._spawnEnemy();
    this._spawned++;
    this._timer = this._interval;

    if (this._spawned >= this._total) this._active = false;
  }

  _spawnEnemy() {
    const e = this._pool.acquire({
      pos:     { x: window.innerWidth + 60, y: 100 + Math.random() * (window.innerHeight - 200) },
      prevPos: { x: window.innerWidth + 60, y: 0 },
      vel:     { x: 0, y: 0 },
      speed:   this._speed,
      hp:      this._hp,
      points:  10 * (this._wave + 1),
      hitbox:  24,
      tags:    new Set(['enemy']),
    });
    e.prevPos.x = e.pos.x;
    e.prevPos.y = e.pos.y;
    e.sprite.position.set(e.pos.x, e.pos.y);
    e.sprite.visible = true;
    return e;
  }
}
```

## Performance notes

- For ~300 entities, plain `Map` iteration is fast (~0.1 ms per frame). No optimization needed.
- If the query function becomes a bottleneck (hundreds of calls per tick), cache results tagged with a generation counter and invalidate on entity create/destroy.
- Avoid allocating arrays inside hot system loops. Use a module-level scratch array and `length = 0` to reset it.
- PixiJS sprite `visible = false` is cheap; `destroy()` is expensive. Always pool sprites and toggle visibility rather than creating/destroying them.

```javascript
// Scratch array pattern for hot paths
const _scratch = [];
export function queryInto(world, ...keys) {
  _scratch.length = 0;
  for (const e of world.entities.values()) {
    if (e.active && keys.every(k => k in e)) _scratch.push(e);
  }
  return _scratch; // caller must NOT store this reference across ticks
}
```
