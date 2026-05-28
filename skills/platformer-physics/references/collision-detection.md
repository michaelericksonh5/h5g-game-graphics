# Collision Detection Reference

AABB resolution, swept collision, uniform-grid broadphase, one-way platforms, moving-platform carry, axis-separation order, and anti-tunneling techniques. All code targets 60fps fixed timestep; tile size is a parameter, not hardcoded.

---

## 1. AABB fundamentals

An axis-aligned bounding box is defined by a top-left corner `(x, y)` and dimensions `(w, h)`. Two AABBs overlap when they intersect on **both** axes simultaneously.

```javascript
// Returns true if two AABBs overlap (touching edges = no overlap)
function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw &&
         ax + aw > bx &&
         ay < by + bh &&
         ay + ah > by;
}

// Returns the minimum translation vector to push A out of B.
// Returns { dx, dy } where one axis is 0 (the non-dominant axis).
function aabbMTV(ax, ay, aw, ah, bx, by, bw, bh) {
  if (!aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh)) return null;

  const overlapLeft   = (ax + aw) - bx;  // A right edge into B
  const overlapRight  = (bx + bw) - ax;  // B right edge into A
  const overlapTop    = (ay + ah) - by;  // A bottom edge into B
  const overlapBottom = (by + bh) - ay;  // B bottom edge into A

  const minX = Math.min(overlapLeft, overlapRight);
  const minY = Math.min(overlapTop, overlapBottom);

  if (minX < minY) {
    return { dx: overlapLeft < overlapRight ? -overlapLeft : overlapRight, dy: 0 };
  } else {
    return { dx: 0, dy: overlapTop < overlapBottom ? -overlapTop : overlapBottom };
  }
}
```

---

## 2. Axis-separation order matters

Resolving X then Y (not the simultaneous MTV) eliminates the "corner snagging" bug where a character moving diagonally into a wall gets lifted upward as if there's an invisible step.

**Why it works:** resolving X first detects and corrects horizontal penetration before the Y pass even runs. When the body slides along a wall, the X pass zeros out the horizontal component and the Y pass sees a clean vertical query with no diagonal artifact.

```javascript
// Correct order — always X first, then Y
function resolveBody(body, grid) {
  // Step 1: apply horizontal movement only
  body.pos.x += body.vel.x * body.dt;
  resolveAxis(body, grid, 'x');

  // Step 2: apply vertical movement only
  body.pos.y += body.vel.y * body.dt;
  resolveAxis(body, grid, 'y');
}

function resolveAxis(body, grid, axis) {
  const tiles = grid.queryAABB(
    body.pos.x, body.pos.y, body.size.w, body.size.h
  );
  for (const tile of tiles) {
    if (tile.oneWay && axis === 'y') continue; // handled separately
    const mtv = aabbMTV(body.pos.x, body.pos.y, body.size.w, body.size.h,
                        tile.x,     tile.y,     tile.w,      tile.h);
    if (!mtv) continue;
    if (axis === 'x' && mtv.dx !== 0) {
      body.pos.x += mtv.dx;
      body.vel.x  = 0;
    }
    if (axis === 'y' && mtv.dy !== 0) {
      body.pos.y += mtv.dy;
      if (mtv.dy < 0) { body.onGround = true; body.vel.y = 0; body.jumpCount = 0; }
      if (mtv.dy > 0 && body.vel.y < 0) body.vel.y *= -0.1; // soft ceiling
    }
  }
}
```

---

## 3. Uniform-grid broadphase

Iterating every tile in the level every frame is O(n). A uniform spatial grid reduces collision queries to O(1) for typical character sizes.

```javascript
export class TileGrid {
  constructor(tileW, tileH, mapCols, mapRows) {
    this.tileW   = tileW;
    this.tileH   = tileH;
    this.cols    = mapCols;
    this.rows    = mapRows;
    this.tiles   = new Array(mapCols * mapRows).fill(null);
    // Tile record shape: { x, y, w, h, solid, oneWay, slopeAngle, platform }
  }

  setTile(col, row, tileData) {
    this.tiles[row * this.cols + col] = tileData;
  }

  getTile(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      return { solid: true, oneWay: false }; // treat out-of-bounds as solid wall
    }
    return this.tiles[row * this.cols + col];
  }

  // Returns all solid/one-way tiles whose AABB overlaps the query rectangle.
  queryAABB(x, y, w, h) {
    const tw = this.tileW, th = this.tileH;
    const c0 = Math.floor(x / tw);
    const c1 = Math.floor((x + w - 1) / tw);
    const r0 = Math.floor(y / th);
    const r1 = Math.floor((y + h - 1) / th);

    const result = [];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const tile = this.getTile(c, r);
        if (tile && (tile.solid || tile.oneWay)) {
          result.push({
            x: c * tw, y: r * th, w: tw, h: th,
            oneWay:     tile.oneWay  ?? false,
            slopeAngle: tile.slopeAngle ?? 0,
            platform:   tile.platform  ?? null,
          });
        }
      }
    }
    return result;
  }
}
```

**Query cost:** for a 32×48px character on 16px tiles, `queryAABB` checks at most 3×4 = 12 cells regardless of map size.

---

## 4. Swept AABB for fast-moving bodies

At high fall speed on small tiles, a body can pass through a tile entirely in one frame (tunneling). The swept test finds the earliest time-of-impact along the trajectory.

```javascript
// Swept AABB: returns time-of-impact [0,1] and normal, or null if no hit.
// body moves from (bx,by) by (vx*dt, vy*dt). tile is static.
function sweptAABB(bx, by, bw, bh, vx, vy, tx, ty, tw, th) {
  // Expand tile by body size (Minkowski sum)
  const ex = tx - bw * 0.5;
  const ey = ty - bh * 0.5;
  const ew = tw + bw;
  const eh = th + bh;
  const cx = bx + bw * 0.5;  // body center
  const cy = by + bh * 0.5;

  // Ray from body center against expanded tile
  let tEnterX = -Infinity, tExitX = Infinity;
  let tEnterY = -Infinity, tExitY = Infinity;

  if (vx !== 0) {
    tEnterX = (ex - cx) / vx;
    tExitX  = (ex + ew - cx) / vx;
    if (tEnterX > tExitX) [tEnterX, tExitX] = [tExitX, tEnterX];
  } else if (cx <= ex || cx >= ex + ew) return null;

  if (vy !== 0) {
    tEnterY = (ey - cy) / vy;
    tExitY  = (ey + eh - cy) / vy;
    if (tEnterY > tExitY) [tEnterY, tExitY] = [tExitY, tEnterY];
  } else if (cy <= ey || cy >= ey + eh) return null;

  const tEnter = Math.max(tEnterX, tEnterY);
  const tExit  = Math.min(tExitX,  tExitY);

  if (tEnter > tExit || tEnter >= 1 || tExit <= 0) return null;

  const nx = tEnterX > tEnterY ? (vx < 0 ? 1 : -1) : 0;
  const ny = tEnterY > tEnterX ? (vy < 0 ? 1 : -1) : 0;

  return { t: Math.max(0, tEnter), nx, ny };
}

// Integrate using swept test when terminal velocity approaches tile height.
function integrateSwept(body, grid, dt) {
  const { x, y } = body.pos;
  const { w, h } = body.size;
  const vx = body.vel.x, vy = body.vel.y;
  const dx = vx * dt, dy = vy * dt;

  const broadTiles = grid.queryAABB(
    Math.min(x, x + dx) - 1, Math.min(y, y + dy) - 1,
    w + Math.abs(dx) + 2,    h + Math.abs(dy) + 2
  );

  let earliest = { t: 1, nx: 0, ny: 0 };
  for (const tile of broadTiles) {
    if (tile.oneWay) continue;
    const hit = sweptAABB(x, y, w, h, dx, dy, tile.x, tile.y, tile.w, tile.h);
    if (hit && hit.t < earliest.t) earliest = hit;
  }

  body.pos.x = x + dx * earliest.t;
  body.pos.y = y + dy * earliest.t;

  if (earliest.nx !== 0) { body.vel.x = 0; }
  if (earliest.ny !== 0) {
    if (earliest.ny > 0) { body.onGround = true; body.jumpCount = 0; }
    body.vel.y = 0;
  }
}
```

**When to use swept vs. discrete:** use discrete (the default `PhysicsBody`) when `terminalVelocity * fixedDt < tileSize * 0.4`. Switch to swept only for projectiles, fast enemies, or very small tiles.

---

## 5. One-way platform logic

One-way platforms are solid only from the top. A character can jump through from below and drop through by pressing ↓.

```javascript
// Called during the Y-axis resolve pass only.
function resolveOneWayY(body, tile, prevBottomY) {
  const bodyBottom = body.pos.y + body.size.h;
  const tileTop    = tile.y;

  // Must be falling (vel.y > 0) and feet must have been above tile top last frame.
  if (body.vel.y <= 0) return false;
  if (body._wantsDropThrough) return false;
  if (prevBottomY > tileTop + 1) return false; // was already inside or below

  const overlap = bodyBottom - tileTop;
  if (overlap <= 0 || overlap > body.size.h * 0.55) return false;

  body.pos.y   -= overlap;
  body.vel.y    = 0;
  body.onGround = true;
  body.isOnOneWay = true;
  body.jumpCount  = 0;
  return true;
}
```

**Drop-through implementation:** bind ↓ + jump (or ↓ held for 150ms) to set `body._wantsDropThrough = true` for one physics frame. The `if (body._wantsDropThrough) return false` line skips resolution, and the character falls through. Clear the flag immediately after the Y pass.

**Edge case: standing exactly on the tile boundary.** A character whose feet land exactly at `tileTop` has `overlap = 0` and the check returns false — they pass through. Add 1px of fudge: change the check to `overlap < -0.5` for "above" instead of `<= 0`.

---

## 6. Moving platform carry

The safest pattern is delta-accumulation: each frame, compute how far the platform moved and add that delta to the character's position **before** the character's own velocity is integrated. No velocity coupling — the character is not given the platform's velocity, only its displacement.

```javascript
class MovingPlatform {
  constructor(startX, startY, endX, endY, period) {
    this.startX = startX; this.startY = startY;
    this.endX   = endX;   this.endY   = endY;
    this.period = period; // seconds for one full cycle
    this.t      = 0;
    this.pos    = { x: startX, y: startY };
    this.prevPos = { x: startX, y: startY };
  }

  update(dtSec) {
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.t = (this.t + dtSec / this.period) % 1;
    // Smooth step for non-jarring motion
    const f = smoothstep(this.t < 0.5 ? this.t * 2 : (1 - this.t) * 2);
    const half = this.t < 0.5;
    this.pos.x = half
      ? this.startX + (this.endX - this.startX) * f
      : this.endX   + (this.startX - this.endX) * f;
    this.pos.y = half
      ? this.startY + (this.endY - this.startY) * f
      : this.endY   + (this.startY - this.endY) * f;
  }

  get deltaX() { return this.pos.x - this.prevPos.x; }
  get deltaY()  { return this.pos.y - this.prevPos.y; }
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

// In PhysicsBody.update(), before velocity integration:
if (body.platform && body.onGround) {
  body.pos.x += body.platform.deltaX;
  body.pos.y += body.platform.deltaY;
}

// Detect platform landing: after Y resolve, check if the tile resolved against has a platform ref.
// When yes, store it: body.platform = tile.platform.
// When body leaves the ground (onGround becomes false), clear body.platform = null.
```

**Jitter fix:** do not add platform delta AND let gravity also pull the character down on the same frame. Gate gravity integration with `if (!body.onGround)`. The Y resolve will place the character exactly on the platform surface each frame.

---

## 7. Slope support

Slopes are tiles where the collision surface is angled rather than flat. For 45° slopes, the walkable surface is a diagonal; the character's feet follow it.

```javascript
// Slope tile has: { slopeAngle, slopeDir } where slopeDir = 1 (rising right) or -1 (rising left).
// Simplified treatment: after Y resolve, snap feet to slope surface.

function resolveSlope(body, tile) {
  const { x, y, w, h } = body.size;
  const bodyX = body.pos.x + w * 0.5; // body center X
  const tileLocalX = bodyX - tile.x;
  const slopeY = tile.slopeDir === 1
    ? tile.y + tile.h - tileLocalX * Math.tan(tile.slopeAngle * Math.PI / 180)
    : tile.y + tileLocalX * Math.tan(tile.slopeAngle * Math.PI / 180);

  const bodyFeet = body.pos.y + body.size.h;
  if (bodyFeet >= slopeY - 2 && bodyFeet <= slopeY + body.vel.y * 0.02 + 4) {
    body.pos.y  = slopeY - body.size.h;
    body.vel.y  = 0;
    body.onGround = true;
    body.jumpCount = 0;
  }
}
```

**Practical note:** slopes steeper than `PHYSICS.slopeMaxAngle` (default 46°) are treated as vertical walls by `_resolveX`. Don't implement arbitrary-angle slopes unless the level design requires them — 30° and 45° cover 95% of platformer levels and are far simpler.

---

## 8. Corner and edge cases

**Inner corner trap.** Character moving right and down simultaneously, hits a corner where a horizontal floor tile and a vertical wall tile meet. Axis-separated resolution handles this correctly: X pass pushes character left (wall), then Y pass sees the floor and pushes character up. No extra code needed.

**Thin tile tunneling.** See swept AABB section. For 8px tiles at 60fps: `maxSafeVelocity = 8 * 0.5 / (1/60) = 240 px/s`. Set `terminalVelocity` at or below this, or switch to swept.

**Two adjacent one-way platforms at different heights.** If a character stands at the seam, the overlap check may fire for both. Only apply the first (earliest in the tile list, typically upper one) by breaking out of the loop after the first successful one-way resolution.

**Moving platform at map edge.** If the platform tile briefly leaves the broadphase query region (integer rounding), the character loses the platform reference for one frame and falls. Fix: expand the `queryAABB` call by 1px on each side.

```javascript
// Safe query: pad 1px to catch edge-of-query platform tiles
const tiles = grid.queryAABB(x - 1, y - 1, w + 2, h + 2);
```

**Ceiling scrape.** Character jumps into a ceiling at high speed. Discrete resolution pushes them down; if they're moving fast enough, they may clip one frame inside the ceiling then get resolved next frame. Fix: check whether `body.pos.y < 0` (absolute ceiling) after Y resolve and clamp.
