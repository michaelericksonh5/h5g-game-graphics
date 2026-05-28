# Camera Follow Reference

PixiJS v8 — concrete implementation details for dead-zone follow, look-ahead, critically-damped
smoothing, bounds clamping, vertical snap, and multi-target framing.

---

## 1. Dead-zone model

The dead zone is a rectangle in screen space centred on the focal point. The camera only moves when
the tracked target leaves this box.

```javascript
// Dead-zone dimensions in screen pixels (unscaled by zoom).
const DZ_W = 80;
const DZ_H = 48;

function updateDeadzone(camera, targetWorldX, targetWorldY) {
  // Convert target world position to screen position given current camera state.
  const txScreen = (targetWorldX - camera.x) * camera.zoom + camera.offsetX;
  const tyScreen = (targetWorldY - camera.y) * camera.zoom + camera.offsetY;

  const cx = camera.viewW / 2;
  const cy = camera.viewH / 2;
  const hw = DZ_W / 2;
  const hh = DZ_H / 2;

  // Horizontal: push target to the near wall of the dead zone.
  if (txScreen < cx - hw) camera._targetX -= (cx - hw) - txScreen;
  if (txScreen > cx + hw) camera._targetX += txScreen - (cx + hw);

  // Vertical: only follow when target exits a larger band (prevents jump bob).
  const dy = tyScreen - cy;
  const snap = camera.vertSnapThreshold ?? 8;
  if (Math.abs(dy) > hh + snap) {
    camera._targetY += dy > 0 ? dy - hh : dy + hh;
  }
}
```

Tuning guide:
- Fast character (run speed >300 px/s): `DZ_W = 120`, so the camera lags behind slightly and
  the player never feels pinned to centre.
- Slow/puzzle character: `DZ_W = 40` for a tighter follow feel.
- Set `DZ_H = 0` and `vertSnapThreshold = 0` to track Y exactly (top-down or no jumping).

---

## 2. Look-ahead

Look-ahead shifts the camera target toward the direction the character is facing, giving the player
more visual information ahead of them.

```javascript
// Call once per frame before the dead-zone step.
function updateLookAhead(camera, facingX, dt) {
  // facingX: +1 = right, -1 = left.  Derive from velocity sign or explicit flip flag.
  const LOOK_DIST  = 120;  // max offset in world pixels
  const LOOK_SPEED = 0.06; // lerp factor per frame at 60fps

  const goal = facingX * LOOK_DIST;
  const t    = Math.min(1, LOOK_SPEED * dt * 60);
  camera._lookX += (goal - camera._lookX) * t;
}
```

The look-ahead offset (`_lookX`) is added to `_targetX` when applying the spring:

```javascript
const effectiveTargetX = camera._targetX + camera._lookX;
```

Overshoot fix: if the character reverses quickly the look-ahead can feel snappy. Gate it:

```javascript
const speed = Math.abs(target.vx);
const gate  = Math.min(1, speed / 80); // ramp up from 0 as speed exceeds 80 px/s
const goal  = facingX * LOOK_DIST * gate;
```

---

## 3. Critically-damped spring smoothing

### Why not lerp?

Plain lerp (`x += (goal - x) * k`) produces an approach that decelerates exponentially but never
fully settles. At high frame rates it under-corrects; at low frame rates it over-corrects. It is
also frame-rate dependent unless you scale `k` by `dt`.

A critically-damped spring settles in minimum time without oscillating. It is also frame-rate
independent when integrated correctly.

### Derivation (simplified Euler integration)

A second-order critically-damped oscillator with angular frequency ω has the ODE:

```
x'' + 2ω x' + ω² (x − goal) = 0
```

Rearranging for the acceleration at each step:

```
a = −ω² · (x − goal) − 2ω · v
```

Euler integration (sufficient for 60fps game cameras):

```javascript
function springStep(x, v, goal, omega, dt) {
  const error = x - goal;
  const accel = -omega * omega * error - 2 * omega * v;
  v += accel * dt;
  x += v * dt;
  return { x, v };
}
```

`omega = 12` is a good default for a snappy-but-smooth game camera. Higher values (16–20) give a
tighter follow; lower values (6–8) give a dreamy float.

### Full camera spring step

```javascript
_springStep(dt) {
  const omega  = this.springOmega;   // default 12
  const goalX  = this._targetX + this._lookX;
  const goalY  = this._targetY + this._lookY;

  const ex = this.x - goalX;
  const ey = this.y - goalY;

  this._velX += (-omega * omega * ex - 2 * omega * this._velX) * dt;
  this._velY += (-omega * omega * ey - 2 * omega * this._velY) * dt;

  this.x += this._velX * dt;
  this.y += this._velY * dt;
}
```

### Choosing omega

| omega | Character | Settle time (~) |
|-------|-----------|----------------|
| 6     | Floaty/cinematic | 600ms |
| 10    | Standard platformer | 350ms |
| 14    | Snappy arcade | 200ms |
| 20    | Near-instant | 100ms |

---

## 4. World/level bounds clamping

Clamp after the spring so the camera never shows outside the level:

```javascript
_clampToBounds() {
  const hw = (this.viewW / 2) / this.zoom;
  const hh = (this.viewH / 2) / this.zoom;

  const prevX = this.x;
  const prevY = this.y;

  this.x = Math.max(hw, Math.min(this.worldW - hw, this.x));
  this.y = Math.max(hh, Math.min(this.worldH - hh, this.y));

  // Zero out spring velocity in a clamped axis to prevent oscillation against the wall.
  if (this.x !== prevX) this._velX = 0;
  if (this.y !== prevY) this._velY = 0;
}
```

The half-view offset (`hw = viewW/2 / zoom`) ensures the camera can't show negative world space
even when zoomed in.

---

## 5. Vertical platform snap

When a character lands on a new platform several tiles higher or lower, the camera should follow
smoothly but NOT bob with every small jump. Two mechanisms work together:

1. **Dead-zone vertical band** — `DZ_H` absorbs small vertical movements.
2. **Snap threshold** — additional pixels required before the vertical dead-zone triggers.

```javascript
// In _updateDeadzone:
const dy = tyScreen - cy;
const snap = this.vertSnapThreshold;  // default 8; raise to 20-40 for bouncy characters

if (Math.abs(dy) > hh + snap) {
  this._targetY += dy > 0 ? dy - hh : dy + hh;
}
```

For a game with very high jumps, also lock vertical tracking while the character is ascending and
only follow downward on landing:

```javascript
const isRising = target.vy < -10;   // vy is negative-up in PixiJS default coords
if (!isRising) {
  // standard vertical dead-zone update
}
```

---

## 6. Screen ↔ world coordinate conversion

Essential for placing UI over world objects, hit-testing pointer events, and spawning particles at
the correct world position.

```javascript
// World → Screen: where does a world point appear on screen right now?
worldToScreen(wx, wy) {
  return {
    x: (wx - this.x) * this.zoom + this.offsetX + this.shakeOffsetX,
    y: (wy - this.y) * this.zoom + this.offsetY + this.shakeOffsetY,
  };
}

// Screen → World: what world point is under a screen/pointer coordinate?
screenToWorld(sx, sy) {
  return {
    x: (sx - this.offsetX - this.shakeOffsetX) / this.zoom + this.x,
    y: (sy - this.offsetY - this.shakeOffsetY) / this.zoom + this.y,
  };
}
```

Usage — converting a pointer tap to world space:

```javascript
app.stage.on('pointertap', (e) => {
  const world = camera.screenToWorld(e.global.x, e.global.y);
  spawnEffect(world.x, world.y);
});
```

---

## 7. Multi-target framing (cinematic camera)

When you need to keep two or more entities (player + boss, co-op characters) in frame, compute a
bounding rect around all targets and track its centre, zooming out to fit:

```javascript
function multiTargetFrame(camera, targets) {
  if (targets.length === 0) return;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const t of targets) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x);
    maxY = Math.max(maxY, t.y);
  }

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;

  // Padding around the bounding box in world pixels.
  const PAD_X = 120;
  const PAD_Y = 80;

  const neededW = (maxX - minX) + PAD_X * 2;
  const neededH = (maxY - minY) + PAD_Y * 2;

  const zoomForW = camera.viewW / neededW;
  const zoomForH = camera.viewH / neededH;
  const targetZoom = Math.min(zoomForW, zoomForH, 1.5); // cap at 1.5× zoom in
  const minZoom    = 0.5;                                 // cap at 0.5× zoom out

  // Smooth the zoom with a spring too.
  const ZOOM_OMEGA = 6;
  camera._zoomVel = camera._zoomVel ?? 0;
  const ez = camera.zoom - Math.max(minZoom, targetZoom);
  camera._zoomVel += (-ZOOM_OMEGA * ZOOM_OMEGA * ez - 2 * ZOOM_OMEGA * camera._zoomVel) * (1/60);
  camera.zoom += camera._zoomVel * (1/60);

  // Use centreX/Y as the single tracking target, bypassing the dead zone.
  camera._targetX = centreX;
  camera._targetY = centreY;
}
```

---

## 8. Zoom integration in applyTo

```javascript
applyTo(worldContainer) {
  worldContainer.scale.set(this.zoom);
  // Shift origin so zoom is centred on the focal point (centre of screen).
  worldContainer.x = -this.x * this.zoom + this.offsetX + this.shakeOffsetX;
  worldContainer.y = -this.y * this.zoom + this.offsetY + this.shakeOffsetY;
}
```

The shake offsets (`shakeOffsetX/Y`) are set each frame by an external shake system
(`particle-systems-and-juice`) or zeroed when no shake is active. The camera class does not own
the shake curve — it only reads the current offset.
