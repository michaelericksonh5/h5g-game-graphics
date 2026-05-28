# Jump Feel Tuning Reference

Deriving gravity and jump velocity from designer-friendly parameters, the complete feel-constants table with calibrated starting values, implementations of coyote time / jump buffering / variable height / apex hang / fast-fall, and a step-by-step dial-in guide. All values assume a 60fps fixed timestep and a 64px tile world.

---

## 1. Derive from jump height and time-to-apex

Never pick gravity and jump velocity by feel-and-fiddle. Derive them from two numbers a designer can reason about:

- **H** — desired maximum jump height in pixels.
- **T** — desired time from ground to apex in seconds.

```
gravity      = 2 * H / T²
jumpVelocity = -2 * H / T       (negative because Y increases downward)
```

This is the kinematic formula for constant-acceleration motion: `v² = v₀² - 2·a·H` at apex where `v = 0`, solved for `a` and `v₀`.

```javascript
// Design inputs
const JUMP_HEIGHT_PX = 160;   // pixels: how high does the character reach?
const TIME_TO_APEX_S = 0.34;  // seconds: how long to reach that height?

// Derived physics constants
const gravity      = 2 * JUMP_HEIGHT_PX / (TIME_TO_APEX_S ** 2);
const jumpVelocity = -(2 * JUMP_HEIGHT_PX / TIME_TO_APEX_S);

console.log(`gravity:      ${gravity.toFixed(0)} px/s²`);  // ~2769 → round to 2800
console.log(`jumpVelocity: ${jumpVelocity.toFixed(0)} px/s`); // ~-941 → round to -820 after tuning
```

**Why the derivation gives a different number than the table.** The derivation is a mathematical ideal. After wiring in apex hang (which reduces effective gravity near the top), the actual arc is taller than predicted. You'll reduce `jumpVelocity` by ~10–15% after adding apex hang to preserve the intended height. Start with the formula, then adjust by feel.

---

## 2. Complete constants table with calibrated starting values

```javascript
export const PHYSICS = {
  // ── Gravity ──────────────────────────────────────────────────────────────
  gravity:            2800,   // px/s²  ↑ snappier  ↓ floatier
  fastFallGravity:    5200,   // px/s²  active when holding ↓ in air
  apexGravityScale:   0.45,   // 0–1    0 = full hang, 1 = no hang
  apexThreshold:       120,   // px/s   window where apex hang is active
  terminalVelocity:   1400,   // px/s   cap prevents tunneling (64px tiles, 60fps: safe up to ~1920)

  // ── Jump ─────────────────────────────────────────────────────────────────
  jumpVelocity:       -820,   // px/s   initial upward velocity on jump
  jumpCutMultiplier:  0.45,   // 0–1    fraction of vy kept on early button release
  coyoteMs:            120,   // ms     grace window after walking off a ledge
  jumpBufferMs:        120,   // ms     remembered jump input before landing
  maxJumps:              1,   // int    set 2 for double-jump support

  // ── Horizontal ───────────────────────────────────────────────────────────
  runSpeed:            320,   // px/s
  airSpeed:            280,   // px/s   slightly less for "committed" feel
  groundAccel:        3200,   // px/s²
  airAccel:           1600,   // px/s²
  groundDecel:        4800,   // px/s²
  airDecel:            800,   // px/s²

  // ── Wall ─────────────────────────────────────────────────────────────────
  wallSlideGravity:    600,   // px/s²  replaces normal gravity on wall contact
  wallJumpVelocityX:   380,   // px/s   horizontal push away from wall
  wallJumpVelocityY:  -680,   // px/s   vertical push (slightly less than full jump)
  wallJumpLockMs:      160,   // ms     blocks horizontal input post-wall-jump

  // ── Tolerances ───────────────────────────────────────────────────────────
  stepUpHeight:          6,   // px     auto-step for sub-tile ledges
  slopeMaxAngle:        46,   // deg    steeper → treated as wall
};
```

**Calibration reference:** these values produce a character that:
- Jumps ~160px high (2.5 × a 64px tile).
- Reaches apex in ~0.34s, falls back to ground in ~0.38s (faster fall due to fast-fall gravity being available and gravity unchanged on descent by default).
- Runs at 320px/s = 5 tiles/s on the ground.
- Feels snappy and responsive, not floaty — Celeste-adjacent, not Mario-adjacent.

---

## 3. Coyote time

```javascript
// In PhysicsBody.update(dtSec):

// ① Tick coyote timer every frame
this.wasOnGround = this.onGround;
if (this.wasOnGround) {
  this.coyoteTimer = PHYSICS.coyoteMs;
} else {
  this.coyoteTimer = Math.max(0, this.coyoteTimer - dtSec * 1000);
}

// ② Jump is allowed if coyote timer is still alive
const coyoteAllowed = this.coyoteTimer > 0;

// ③ After jumping, zero the timer so it can't be consumed twice
if (jumpFired) {
  this.coyoteTimer = 0;
}
```

**Effect on play:** set `coyoteMs = 0` and notice how often players complain that the character "fell through the edge." Set it to 120ms and the complaint disappears while the window remains invisible during normal play.

**Do not apply coyote time on wall contact.** Touching a wall should not reset the coyote window — only `onGround` does.

---

## 4. Jump buffering

```javascript
// ① On the frame the jump button is pressed, store the buffer
if (jumpButtonJustPressed) {
  this.jumpBufferTimer = PHYSICS.jumpBufferMs;
}

// ② Tick down every frame
this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dtSec * 1000);

// ③ Check buffer when landing (anywhere in the update that detects onGround becoming true)
if (this.onGround && this.jumpBufferTimer > 0) {
  this._doJump();
  this.jumpBufferTimer = 0;
}
```

**Effect on play:** without buffering, jumping just before landing is ignored. With buffering, the character bounces immediately on landing, which feels like the controls "read your mind." The 120ms window is long enough to feel forgiving, short enough to never fire unexpectedly.

---

## 5. Variable jump height (early-release cut)

```javascript
// On the frame the jump button is released while ascending (vel.y < 0):
if (jumpButtonJustReleased && this.vel.y < 0) {
  this.vel.y *= PHYSICS.jumpCutMultiplier; // 0.45 → cuts to 45% of current upward speed
}
```

**Effect on play:** with `jumpCutMultiplier = 0.45`, tapping the button produces a short hop roughly 40% the height of a full jump. Holding it produces the full arc. This is the entire implementation — no extra state needed.

**Tuning:** lower values (0.2–0.3) make the short hop very low, good for precision platformers. Higher values (0.6–0.7) make variable height less pronounced, good if the level design doesn't require short hops.

---

## 6. Apex hang

```javascript
// In the gravity integration section of PhysicsBody.update():
let gravScale = 1.0;
const nearApex = !this.onGround && Math.abs(this.vel.y) < PHYSICS.apexThreshold;

if (nearApex) {
  gravScale = PHYSICS.apexGravityScale; // e.g. 0.45
}

// Apply gravity with scale
if (!this.onGround) {
  this.vel.y += PHYSICS.gravity * gravScale * dtSec;
  this.vel.y  = Math.min(this.vel.y, PHYSICS.terminalVelocity);
}
```

**Effect on play:** near the top of the arc the character decelerates more slowly and hangs briefly before gravity reasserts. The window is tight — only while `|vy| < 120 px/s`, which at standard gravity is roughly 43ms of perceived hang. This is the trick that makes jumps feel weighty and intentional rather than mechanical.

**Tuning apex threshold:** `apexThreshold = 60` gives a barely-perceptible hang (precision platformer feel). `apexThreshold = 200` produces a noticeable float (exploration platformer feel). Start at 120 and adjust.

---

## 7. Fast-fall

```javascript
// In the gravity integration section, checked before normal gravity:
if (this._isFastFall && !this.onGround) {
  this.vel.y += PHYSICS.fastFallGravity * dtSec;
  this.vel.y  = Math.min(this.vel.y, PHYSICS.terminalVelocity);
  return; // skip the apex hang / normal gravity path
}
```

```javascript
// Set in setInput():
this._isFastFall = holdingDown && !this.onGround;
```

**Effect on play:** the player actively controls descent speed. Combined with jump buffering, this pattern — jump → hold ↓ → buffer next jump on landing — creates the high-speed "bunny hop" feel used in action platformers.

---

## 8. How to dial it in: a step-by-step guide

Follow this order. Changing gravity and jump velocity at the same time is guaranteed confusion.

### Step 1: Lock jump height and apex time

Pick your desired jump height in tiles. A character should be able to jump exactly 2.5 tiles (160px at 64px tiles) to land on a platform two tiles high with comfort. Derive `gravity` and `jumpVelocity` from the formulas in section 1.

### Step 2: Add apex hang and re-check height

Add `apexGravityScale = 0.45` and `apexThreshold = 120`. The character will now jump about 10% higher than the formula predicted. Reduce `jumpVelocity` by 5–10% (make the magnitude smaller) until the peak is back to your target.

### Step 3: Set the fall speed

`gravity` controls both rise and fall. If the fall feels too slow compared to the rise, add a **fall multiplier** — slightly higher gravity when `vel.y > 0` (descending):

```javascript
const isFalling = this.vel.y > 0 && !this.onGround;
const fallGravMult = isFalling ? 1.35 : 1.0;
this.vel.y += PHYSICS.gravity * gravScale * fallGravMult * dtSec;
```

A multiplier of 1.35 makes the descent noticeably faster than the rise without changing the apex height (which is set during the ascent phase).

### Step 4: Add coyote time and jump buffer

Set both to 120ms. These should never change feel — they only eliminate frustration. If players say "the jump doesn't always work," these were either missing or set to 0.

### Step 5: Tune variable height

Press jump and immediately release. The short hop should be roughly 40% the height of the full jump. If it's too low, raise `jumpCutMultiplier` (toward 0.6). If short hop and full hop feel identical, lower it (toward 0.3).

### Step 6: Tune horizontal feel

- **Snappy stop, fast start:** raise both `groundAccel` and `groundDecel` (toward 4000/6000).
- **Slippery, momentum-based:** lower both (toward 1200/1800).
- **Air control:** `airAccel / airDecel` follows the same logic. Low air decel (400–800) creates drifty air feel; high (2000+) creates tight air control.

### Step 7: Wall slide and wall jump

Set `wallSlideGravity` to roughly 20% of `gravity` (default: 600 when gravity is 2800). If the wall slide feels too fast, lower it. Set `wallJumpVelocityY` to roughly 80% of `|jumpVelocity|` so the wall jump is slightly weaker than a ground jump. `wallJumpLockMs = 160` prevents the player from immediately reversing back onto the wall.

### Step 8: Fast-fall

`fastFallGravity = 5200` is approximately 1.85× normal gravity. Adjust until holding ↓ mid-air feels like an active power rather than a slight nudge.

---

## 9. Reference values by feel archetype

| Archetype | gravity | jumpVel | apexScale | coyoteMs | groundDecel |
|---|---|---|---|---|---|
| Celeste (tight, precise) | 3200 | -900 | 0.35 | 80 | 6000 |
| Classic Mario (floaty) | 1600 | -620 | 0.55 | 150 | 2400 |
| Hollow Knight (weighty) | 2600 | -780 | 0.40 | 100 | 4000 |
| Default (this table) | 2800 | -820 | 0.45 | 120 | 4800 |
| Arcade (snap) | 3600 | -960 | 0.25 | 60 | 8000 |

These are approximations calibrated by ear, not decompiled constants. Use as starting points.

---

## 10. Sanity-check: tunneling threshold

At 60fps (`dt = 1/60 ≈ 0.0167s`), the maximum safe terminal velocity to avoid tunneling through a tile is:

```
maxSafeVel = tileSize * 0.5 / dt
```

| Tile size | Max safe velocity |
|---|---|
| 64 px | 1920 px/s |
| 32 px | 960 px/s |
| 16 px | 480 px/s |
| 8 px  | 240 px/s |

The default `terminalVelocity = 1400` is safe for 32px and larger tiles at 60fps. For 16px tiles, cap at 480 or enable swept collision (see `references/collision-detection.md`).
