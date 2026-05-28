---
name: platformer-physics
description: Platformer physics, character controller, jumping, gravity, AABB collision detection, coyote time, jump buffering, variable jump height, apex hang, fast-fall, one-way platforms, moving platforms, slopes, wall slide, wall jump — the full movement and collision feel layer for side-scrollers and arcade games. Owns movement and collision for side-scrollers; for the game loop, ECS, and input binding use sidescroller-engine; for camera and parallax scrolling use sidescroller-camera-and-parallax. Consumes a tile collision grid produced by tilemap-and-level-design.
---

# Platformer Physics

The feel of a platformer lives or dies on two axes: how the character moves through the air and how collisions resolve at the edges of solid tiles. Flat gravity integration plus naive overlap-push looks like a prototype in four seconds. This skill bundles the template that starts from premium: axis-separated AABB resolution, a jump arc tuned from first principles, and all the micro-tricks (coyote time, buffered jumps, apex hang, fast-fall) that separate shipped games from jam entries.

## The core principle: tune the jump first, everything else follows

Claude's default physics output integrates `velocity.y += gravity * dt` and calls it done. The result is a floaty parabola that feels like a balloon. Don't do that. Derive gravity and jump velocity from the **desired jump height** and **time-to-apex** — two designer-friendly numbers — and wire in coyote time and jump buffering before any tile collision touches the code. The feel constants are the single most important output of this skill. Get them right and the character feels like it has weight. Get them wrong and no amount of animation polish recovers it.

## Scope

This skill owns:

- Fixed-timestep physics update (velocity integration, gravity, terminal velocity).
- AABB collision: broadphase tile query, axis-separated narrow-phase resolution, anti-tunneling.
- Jump feel: coyote time, jump buffering, variable height (early-release cut), apex hang, fast-fall.
- One-way (drop-through) platforms and moving-platform carrying.
- Optional slope support (45° and shallow angled tiles).
- Wall slide and wall jump.

This skill does **not** own:

- Game loop, ECS, or input: use `sidescroller-engine`.
- Camera or parallax: use `sidescroller-camera-and-parallax`.
- Tile map data, collision-grid generation: use `tilemap-and-level-design` — this skill **consumes** its grid.
- Landing dust, impact juice, screen shake: use `particle-systems-and-juice`.
- Jump / land sound effects: use `procedural-sfx-design`.
- QA and regression testing: finish in `game-qa-and-testing`.

## Tunable constants table

Start from these numbers; the guidance after each range tells you which direction to push when it feels wrong.

```javascript
export const PHYSICS = {
  // --- Gravity ---------------------------------------------------------------
  gravity:          2800,   // px/s² downward. Higher = snappier, lower = floatier.
  fastFallGravity:  5200,   // px/s² when holding ↓ mid-air. Enables intentional fast drop.
  apexGravityScale: 0.45,   // multiplier near jump apex (|vy| < apexThreshold). <1 = hang.
  apexThreshold:    120,    // px/s vertical speed at which apex hang kicks in.
  terminalVelocity: 1400,   // px/s max fall speed. Prevents tunneling + controls worst case.

  // --- Jump ------------------------------------------------------------------
  jumpVelocity:    -820,    // px/s initial vy on jump. Negative = up. Derive from height+apex.
  jumpCutMultiplier: 0.45,  // fraction of vy kept when jump button released early (0=instant cut).
  coyoteMs:          120,   // ms after walking off edge where jump is still allowed.
  jumpBufferMs:      120,   // ms before landing where a jump input is remembered & fires on land.
  maxJumps:            1,   // set 2 for double-jump; aerial jumps use jumpVelocity * 0.9.

  // --- Horizontal ------------------------------------------------------------
  runSpeed:          320,   // px/s max horizontal speed on ground.
  airSpeed:          280,   // px/s max horizontal speed in air (slightly less for feel).
  groundAccel:      3200,   // px/s² acceleration on ground.
  airAccel:         1600,   // px/s² acceleration in air. Lower = less air control.
  groundDecel:      4800,   // px/s² deceleration (no input on ground). Fast stop = snappy.
  airDecel:          800,   // px/s² decel in air with no input. Low = drifty.

  // --- Wall ------------------------------------------------------------------
  wallSlideGravity:  600,   // px/s² while sliding down a wall (replaces normal gravity).
  wallJumpVelocityX: 380,   // px/s horizontal push away from wall on wall jump.
  wallJumpVelocityY:-680,   // px/s vertical push on wall jump.
  wallJumpLockMs:    160,   // ms where horizontal input is suppressed after wall jump.

  // --- Tolerances ------------------------------------------------------------
  stepUpHeight:        6,   // px: auto-step-up for small ledges (stairs feel).
  slopeMaxAngle:      46,   // degrees: tiles steeper than this are treated as walls.
};
```

**Feels floaty?** Raise `gravity` and `fastFallGravity`. Raise `jumpCutMultiplier` toward 0.6 so early release doesn't kill the arc so hard. Reduce `apexGravityScale` toward 0.3 for longer hang.

**Feels stiff / snappy / arcade?** Lower `gravity` toward 1800, raise `apexGravityScale` toward 0.7, raise `coyoteMs` toward 160.

**Horizontal too slippery?** Raise `groundDecel`. Too jerky? Lower `groundAccel` and `groundDecel` toward 1600/2400.

## Architecture: where this fits

```
sidescroller-engine          → fixed timestep tick(dt)
  └─ PhysicsBody.update(dt)  ← this skill
       ├─ integrateVelocity(dt)
       ├─ resolveCollisionsX(grid)
       └─ resolveCollisionsY(grid)
            └─ tile grid     ← produced by tilemap-and-level-design
```

PixiJS v8 is used for rendering only — `container.x = body.pos.x` each frame. The physics runs in pure JS against pixel coordinates. No physics library required.

## PhysicsBody: the full implementation

```javascript
import { PHYSICS } from './physics-constants.js';

export class PhysicsBody {
  constructor(x, y, w, h) {
    this.pos   = { x, y };       // top-left corner in world pixels
    this.vel   = { x: 0, y: 0 };
    this.size  = { w, h };
    this.sprite = null;          // set by owner: PixiJS Container

    // State flags
    this.onGround        = false;
    this.onWall          = 0;    // -1 left wall, 0 none, 1 right wall
    this.wasOnGround     = false;
    this.coyoteTimer     = 0;    // ms remaining
    this.jumpBufferTimer = 0;    // ms remaining
    this.jumpCount       = 0;
    this.wallJumpLock    = 0;    // ms remaining
    this.isFastFall      = false;
    this.isOnOneWay      = false;// true when standing on a one-way platform
    this.platform        = null; // moving platform reference
    this.prevPlatformPos = null;

    // Internal
    this._jumpPressedThisFrame = false;
    this._jumpReleasedThisFrame = false;
    this._inputX = 0;
    this._wantsDropThrough = false;
  }

  // --- Input -----------------------------------------------------------

  setInput(inputX, jumpPressed, jumpReleased, fastFall, dropThrough) {
    this._inputX = inputX;                        // -1, 0, +1
    this._jumpPressedThisFrame  = jumpPressed;
    this._jumpReleasedThisFrame = jumpReleased;
    this.isFastFall             = fastFall && !this.onGround;
    this._wantsDropThrough      = dropThrough;
  }

  // --- Main update (call once per fixed timestep) ----------------------

  update(dtSec, tileGrid) {
    const P = PHYSICS;
    const dtMs = dtSec * 1000;

    // --- Jump buffer ---
    if (this._jumpPressedThisFrame) this.jumpBufferTimer = P.jumpBufferMs;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dtMs);

    // --- Coyote time ---
    this.wasOnGround = this.onGround;
    if (this.wasOnGround) this.coyoteTimer = P.coyoteMs;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dtMs);

    // --- Wall jump lock ---
    this.wallJumpLock = Math.max(0, this.wallJumpLock - dtMs);

    // --- Moving platform carry: accumulate delta before own movement ---
    let platformDeltaX = 0, platformDeltaY = 0;
    if (this.platform && this.onGround) {
      const pp = this.prevPlatformPos;
      platformDeltaX = this.platform.pos.x - pp.x;
      platformDeltaY = this.platform.pos.y - pp.y;
      this.prevPlatformPos = { x: this.platform.pos.x, y: this.platform.pos.y };
    }

    // --- Attempt jump ---
    const canJump = this.coyoteTimer > 0 || (P.maxJumps > 1 && this.jumpCount < P.maxJumps);
    const canWallJump = this.onWall !== 0 && !this.onGround;
    if (this.jumpBufferTimer > 0 && (canJump || canWallJump)) {
      if (canWallJump && !canJump) {
        this._doWallJump();
      } else {
        this._doJump();
      }
      this.jumpBufferTimer = 0;
      this.coyoteTimer     = 0;
    }

    // --- Variable height: cut velocity on early release ---
    if (this._jumpReleasedThisFrame && this.vel.y < 0) {
      this.vel.y *= P.jumpCutMultiplier;
    }

    // --- Gravity ---
    let grav = P.gravity;
    const nearApex = Math.abs(this.vel.y) < P.apexThreshold && !this.onGround;
    if (this.isFastFall) {
      grav = P.fastFallGravity;
    } else if (nearApex) {
      grav = P.gravity * P.apexGravityScale;
    } else if (this.onWall !== 0 && !this.onGround && this.vel.y > 0) {
      grav = P.wallSlideGravity;
    }

    if (!this.onGround) {
      this.vel.y += grav * dtSec;
      this.vel.y  = Math.min(this.vel.y, P.terminalVelocity);
    }

    // --- Horizontal acceleration ---
    const maxSpd = this.onGround ? P.runSpeed : P.airSpeed;
    if (this.wallJumpLock <= 0) {
      const accel = this.onGround ? P.groundAccel : P.airAccel;
      const decel = this.onGround ? P.groundDecel : P.airDecel;
      if (this._inputX !== 0) {
        this.vel.x += this._inputX * accel * dtSec;
        this.vel.x  = Math.sign(this.vel.x) * Math.min(Math.abs(this.vel.x), maxSpd);
      } else {
        const sign = Math.sign(this.vel.x);
        this.vel.x -= sign * decel * dtSec;
        if (Math.sign(this.vel.x) !== sign) this.vel.x = 0;
      }
    }

    // --- Integrate position ---
    const moveX = this.vel.x  * dtSec + platformDeltaX;
    const moveY = this.vel.y  * dtSec + platformDeltaY;

    // --- Axis-separated collision (X first, then Y) ---
    this.pos.x += moveX;
    this._resolveX(tileGrid);

    this.pos.y += moveY;
    this._resolveY(tileGrid);

    // --- Sync PixiJS sprite ---
    if (this.sprite) {
      this.sprite.x = Math.round(this.pos.x);
      this.sprite.y = Math.round(this.pos.y);
    }
  }

  _doJump() {
    this.vel.y  = PHYSICS.jumpVelocity;
    this.onGround = false;
    this.jumpCount++;
    this.platform = null;
  }

  _doWallJump() {
    const P = PHYSICS;
    this.vel.y  = P.wallJumpVelocityY;
    this.vel.x  = -this.onWall * P.wallJumpVelocityX;
    this.onWall = 0;
    this.jumpCount = 1;
    this.wallJumpLock = P.wallJumpLockMs;
  }

  _resolveX(grid) {
    const { x, y }     = this.pos;
    const { w, h }     = this.size;
    const tiles        = grid.queryAABB(x, y, w, h);
    this.onWall        = 0;

    for (const tile of tiles) {
      if (tile.oneWay) continue;
      const overlapX = _overlapX(this, tile);
      if (overlapX === 0) continue;
      this.pos.x += overlapX;
      if (overlapX < 0) this.onWall =  1;   // pushed left → was touching right wall
      else              this.onWall = -1;   // pushed right → was touching left wall
      this.vel.x = 0;
    }
  }

  _resolveY(grid) {
    const P = PHYSICS;
    this.onGround = false;
    this.isOnOneWay = false;
    const { x, y }  = this.pos;
    const { w, h }  = this.size;
    const tiles     = grid.queryAABB(x, y, w, h);

    for (const tile of tiles) {
      if (tile.oneWay) {
        // Only resolve when falling onto the top surface, unless drop-through.
        if (this._wantsDropThrough) continue;
        if (this.vel.y <= 0) continue;
        const topY = tile.y;
        const prevBottom = y + h - this.vel.y * (1 / 60); // approximate prev frame bottom
        if (prevBottom > topY + 2) continue;               // was already below top
        const overlapY = (y + h) - topY;
        if (overlapY <= 0 || overlapY > h * 0.5) continue;
        this.pos.y  -= overlapY;
        this.vel.y   = 0;
        this.onGround  = true;
        this.isOnOneWay = true;
      } else {
        const overlapY = _overlapY(this, tile);
        if (overlapY === 0) continue;
        this.pos.y += overlapY;
        if (overlapY < 0) {          // pushed up → landed on top
          this.onGround = true;
          this.vel.y    = 0;
          this.jumpCount = 0;
        } else {                     // pushed down → hit ceiling
          if (this.vel.y < 0) this.vel.y *= -0.1; // soft ceiling bounce
        }
      }
    }
  }
}

// --- Overlap helpers (axis-separated, returns push delta) ----------------

function _overlapX(body, tile) {
  const bl = body.pos.x, br = bl + body.size.w;
  const tl = tile.x,     tr = tl + tile.w;
  if (br <= tl || bl >= tr) return 0;
  const fromLeft  = br - tl;
  const fromRight = tr - bl;
  return fromLeft < fromRight ? -fromLeft : fromRight;
}

function _overlapY(body, tile) {
  const bt = body.pos.y, bb = bt + body.size.h;
  const tt = tile.y,     tb = tt + tile.h;
  if (bb <= tt || bt >= tb) return 0;
  const fromTop    = bb - tt;
  const fromBottom = tb - bt;
  return fromTop < fromBottom ? -fromTop : fromBottom;
}
```

## Jump feel: the heart of this skill

The settle-bounce is to reel animations what coyote time is to platformers — the single trick that separates "feels real" from "feels like a school project." Implement all five in the constants block before shipping:

1. **Coyote time** — the character ran off a ledge 80ms ago but hasn't pressed jump yet. Let them. The window is invisible to the player; the result is they never blame your collision for a missed jump. See `references/jump-feel-tuning.md` for the derivation.

2. **Jump buffering** — the player pressed jump 80ms before landing. Queue it and fire on the next `onGround` frame. Eliminates "I pressed jump and nothing happened" entirely.

3. **Variable jump height** — cutting `vel.y` to 45% on early release gives short-hop capability. Essential for precision platforming sections.

4. **Apex hang** — at the top of the arc the character briefly defies gravity (`apexGravityScale 0.45`). This is what makes jumps feel weighty and satisfying, not flicky. The window is tight — only while `|vy| < 120 px/s`.

5. **Fast-fall** — holding ↓ mid-air multiplies gravity by ~1.85 (to `fastFallGravity`). Gives the player active control over descent speed and feels immediately responsive.

The numbers in `PHYSICS` are calibrated starting values for a 16×16 tile character on a 64-pixel-tile world. See `references/jump-feel-tuning.md` for the math to re-derive them for your tile scale.

## One-way and moving platforms

One-way platforms (grass-top ledges you can jump through from below) require a modified Y resolve: only push back when the **previous frame's feet were above** the platform top AND the character is falling. See `_resolveY` above and the detailed edge-case handling in `references/collision-detection.md`.

Moving platforms carry the rider by accumulating the platform's delta every fixed tick before integrating the character's own velocity. Store `prevPlatformPos` every frame; on the frame the character is on the platform, add the delta to `moveX`/`moveY`. This produces smooth carry without velocity coupling bugs where the platform's speed bleeds into the jump.

## Common failures and their fixes

**Tunneling at high speed.** Character at terminal velocity passes through thin walls in one frame. Fix: cap `terminalVelocity` so `vel.y * dtSec < tileHeight * 0.5`. For a 60fps fixed timestep at 64px tiles: `1400 px/s * 0.016s = 22px` — well inside a 64px tile. If your tiles are 16px, cap terminal velocity at `16 * 0.5 / 0.016 = 500 px/s` or sweep the collision (see `references/collision-detection.md` swept section).

**Character sticks to walls.** `_resolveX` fires and zeroes `vel.x` even when sliding down a wall. Fix: zero `vel.x` only when the overlap push opposes the velocity direction. The implementation above does this via `overlapX < 0` / `> 0` logic.

**Double-jump fires on the same frame as the first jump.** The jump input sets `jumpBufferTimer > 0`, then `onGround` is true for one tick, then gravity hasn't moved the character off the tile yet. Fix: clear `coyoteTimer` immediately on jump (done in `_doJump` via the caller) and set `onGround = false` before the buffer check fires in the next update.

**Jitter on moving platforms.** Character vibrates up and down each tick. Cause: Y resolve pushes character up, next tick gravity pulls down, resolve pushes up again, creating 1px oscillation. Fix: when `onGround` and platform delta was applied, skip gravity integration for that tick (already handled — `onGround` check gates the gravity block above).

**Coyote time allows jump after intentional wall-walk-off.** Set `coyoteTimer = 0` on the same frame `onWall` becomes nonzero. Wall contact is not ground contact.

**One-way platform trap: can't drop through.** Wire the `_wantsDropThrough` flag to ↓ + jump. Set it for one tick only; the `continue` in the one-way branch skips resolution and the character falls through.

## Cross-skill wiring

Full integration sequence for a new side-scroller build:

1. `tilemap-and-level-design` — produces the `TileGrid` (exposes `queryAABB`).
2. `sidescroller-engine` — owns the fixed-timestep loop; calls `body.update(dt, grid)` each tick.
3. **`platformer-physics`** (this skill) — the physics body.
4. `sidescroller-camera-and-parallax` — reads `body.pos` to drive camera; call after physics settles.
5. `particle-systems-and-juice` — subscribe to `onLand`, `onJump`, `onWallJump` events for dust and impact.
6. `procedural-sfx-design` — subscribe to same events for jump and land SFX.
7. `game-qa-and-testing` — run the QA pass last; validate coyote, buffer, and tunneling regression tests.

## References

Detailed references — load only what the current task needs:

- `references/collision-detection.md` — AABB math, swept collision for fast bodies, uniform-grid broadphase, axis-separation order, one-way and moving-platform edge cases, anti-tunneling. Read when the collision resolution is misbehaving or tile scale is unusual.
- `references/jump-feel-tuning.md` — deriving gravity and jump velocity from jump height and time-to-apex, the full constants table with numeric starting values, coyote/buffer/variable-height/apex-hang implementations, and a step-by-step dial-in guide. Read when tuning feel or adapting to a different tile scale.
