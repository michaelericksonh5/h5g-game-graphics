---
name: sidescroller-camera-and-parallax
description: Build smooth 2D side-scroller camera systems and procedurally generated parallax backgrounds with PixiJS v8. Use for camera, follow camera, deadzone, look-ahead, camera smoothing, camera bounds, scrolling background, parallax layers, background layers, parallax scroll, screen-to-world, world-to-screen, and depth-layered environments. Disambiguation: this skill owns the camera transform and scrolling background rendering for side-scrollers; game loop, input handling, and update scheduling belong to sidescroller-engine; character movement and collision response belong to platformer-physics; screen-shake curves can also be sourced from particle-systems-and-juice (this skill exposes the per-frame shake-offset hook so both integrate cleanly). Also use for procedural backgrounds, tiling backgrounds, and infinite scrolling scenery with zero external image assets.
---

# Sidescroller Camera and Parallax

Production-quality camera and scrolling background systems for mobile-first side-scrollers built on PixiJS v8. Zero external assets — every layer is drawn in code.

## The core principle: camera is an inverse transform on a world container

In PixiJS v8, there is no built-in camera. The idiomatic pattern is a `Container` that holds
everything in your world. Moving the camera right means moving that container left. The camera's
position in world-space maps directly to a negative offset applied to the container's `x` and `y`:

```javascript
// worldContainer is a Container added to the stage.
// All game objects (tiles, enemies, player) are children of worldContainer.
function applyCamera(worldContainer, camera) {
  worldContainer.x = -camera.x + camera.offsetX;
  worldContainer.y = -camera.y + camera.offsetY;
}
```

`offsetX` and `offsetY` hold the screen-space focal point (usually half the canvas width/height so
the tracked target appears centered) plus the current shake offset.

## Camera class skeleton

```javascript
export class Camera2D {
  constructor({ viewW, viewH, worldW, worldH }) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.worldW = worldW;
    this.worldH = worldH;

    // Current position (world-space, at the focal point)
    this.x = viewW / 2;
    this.y = viewH / 2;

    // Smooth target
    this._targetX = this.x;
    this._targetY = this.y;
    this._velX = 0;   // for critically-damped spring
    this._velY = 0;

    // Look-ahead accumulator
    this._lookX = 0;
    this._lookY = 0;

    // Shake state (offset injected per frame by the shake system)
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Zoom (1 = no zoom; >1 zooms in, <1 zooms out)
    this.zoom = 1;

    // Settings
    this.deadzoneW  = 80;    // px of horizontal dead zone
    this.deadzoneH  = 48;    // px of vertical dead zone
    this.lookAheadDist = 120; // max look-ahead offset in px
    this.lookSmooth = 0.06;  // lerp factor for look-ahead
    this.springOmega = 12;   // critically-damped spring angular frequency
    this.vertSnapThreshold = 8; // ignore vertical deltas smaller than this
  }

  get offsetX() { return this.viewW / 2; }
  get offsetY() { return this.viewH / 2; }

  // Call once per frame with the tracked entity and the frame delta in SECONDS.
  update(target, dt) {
    this._updateLookAhead(target, dt);
    this._updateDeadzone(target);
    this._springStep(dt);
    this._clampToBounds();
  }

  _updateLookAhead(target, dt) {
    const facingX = target.facingX ?? 1; // +1 right, -1 left
    const facingY = 0; // disable vertical look-ahead for standard platformers
    const goalX = facingX * this.lookAheadDist;
    const goalY = facingY * this.lookAheadDist;
    this._lookX += (goalX - this._lookX) * Math.min(1, this.lookSmooth * dt * 60);
    this._lookY += (goalY - this._lookY) * Math.min(1, this.lookSmooth * dt * 60);
  }

  _updateDeadzone(target) {
    const txScreen = target.x - this._targetX + this.offsetX + this._lookX;
    const tyScreen = target.y - this._targetY + this.offsetY + this._lookY;

    const hw = this.deadzoneW / 2;
    const hh = this.deadzoneH / 2;
    const cx = this.viewW / 2;
    const cy = this.viewH / 2;

    if (txScreen < cx - hw) this._targetX -= (cx - hw) - txScreen;
    if (txScreen > cx + hw) this._targetX += txScreen - (cx + hw);

    // Vertical snap: only move camera if target leaves a larger band
    const dy = tyScreen - cy;
    if (Math.abs(dy) > hh + this.vertSnapThreshold) {
      this._targetY += dy > 0 ? dy - hh : dy + hh;
    }
  }

  _springStep(dt) {
    // Critically-damped spring: no oscillation, fastest settle.
    // Formula: v' = v - omega^2*(x-goal)*dt - 2*omega*v*dt
    //          x' = x + v*dt
    const omega = this.springOmega;
    const ex = this.x - (this._targetX + this._lookX);
    const ey = this.y - (this._targetY + this._lookY);
    this._velX += (-omega * omega * ex - 2 * omega * this._velX) * dt;
    this._velY += (-omega * omega * ey - 2 * omega * this._velY) * dt;
    this.x += this._velX * dt;
    this.y += this._velY * dt;
  }

  _clampToBounds() {
    const hw = (this.viewW / 2) / this.zoom;
    const hh = (this.viewH / 2) / this.zoom;
    this.x = Math.max(hw, Math.min(this.worldW - hw, this.x));
    this.y = Math.max(hh, Math.min(this.worldH - hh, this.y));
  }

  // Apply to the world container each frame.
  applyTo(worldContainer) {
    worldContainer.scale.set(this.zoom);
    worldContainer.x = -this.x * this.zoom + this.offsetX + this.shakeOffsetX;
    worldContainer.y = -this.y * this.zoom + this.offsetY + this.shakeOffsetY;
  }

  // Coordinate conversion helpers.
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.offsetX + this.shakeOffsetX,
      y: (wy - this.y) * this.zoom + this.offsetY + this.shakeOffsetY,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.offsetX - this.shakeOffsetX) / this.zoom + this.x,
      y: (sy - this.offsetY - this.shakeOffsetY) / this.zoom + this.y,
    };
  }
}
```

Full dead-zone math, look-ahead tuning, critically-damped spring formula derivation, multi-target
framing, and vertical snap details are in `references/camera-follow.md`.

## Parallax backgrounds: all drawn in code

```javascript
import { Application, Container, Graphics, TilingSprite, RenderTexture, BlurFilter } from 'pixi.js';

// Scroll factors: 0 = stationary (sky), 1 = moves with world.
const LAYER_CONFIG = [
  { key: 'sky',      scrollX: 0.0,  scrollY: 0.0,  blurPx: 0, tint: 0xffffff },
  { key: 'farMtn',   scrollX: 0.10, scrollY: 0.05, blurPx: 2, tint: 0xbbccdd },
  { key: 'midHill',  scrollX: 0.30, scrollY: 0.10, blurPx: 0, tint: 0xaabbaa },
  { key: 'nearFoil', scrollX: 0.65, scrollY: 0.20, blurPx: 0, tint: 0x44773a },
];

export class ParallaxBackground {
  constructor(app, camera) {
    this.app = app;
    this.camera = camera;
    this.container = new Container();
    this.container.zIndex = -100;
    app.stage.addChild(this.container);

    this._layers = {};
    this._buildLayers();
  }

  _buildLayers() {
    const { screen } = this.app;
    for (const cfg of LAYER_CONFIG) {
      const tex = this._renderLayerTexture(cfg.key, screen.width, screen.height);
      const sprite = new TilingSprite({
        texture: tex,
        width: screen.width,
        height: screen.height,
      });
      if (cfg.blurPx > 0) sprite.filters = [new BlurFilter({ strength: cfg.blurPx })];
      sprite.tint = cfg.tint;
      this.container.addChild(sprite);
      this._layers[cfg.key] = { sprite, cfg };
    }
  }

  update(cameraX, cameraY) {
    for (const { sprite, cfg } of Object.values(this._layers)) {
      sprite.tilePosition.x = -cameraX * cfg.scrollX;
      sprite.tilePosition.y = -cameraY * cfg.scrollY;
    }
  }

  _renderLayerTexture(key, w, h) {
    const g = new Graphics();
    if (key === 'sky')      this._drawSky(g, w, h);
    if (key === 'farMtn')   this._drawMountains(g, w, h, { count: 6, minH: 0.35, maxH: 0.60, color: 0x6688aa });
    if (key === 'midHill')  this._drawMountains(g, w, h, { count: 10, minH: 0.20, maxH: 0.40, color: 0x557744 });
    if (key === 'nearFoil') this._drawFoliage(g, w, h);
    const rt = RenderTexture.create({ width: w, height: h });
    this.app.renderer.render({ container: g, target: rt });
    return rt;
  }

  _drawSky(g, w, h) {
    g.rect(0, 0, w, h).fill({ color: 0x1a2a4a });
    // Horizon gradient band
    for (let i = 0; i < 32; i++) {
      const t = i / 31;
      const y = h * (0.5 + t * 0.5);
      const band = Math.round(h / 32);
      const r = Math.round(0x1a + t * (0x88 - 0x1a));
      const gb = Math.round(0x44 + t * (0xbb - 0x44));
      g.rect(0, y, w, band).fill({ color: (r << 16) | (gb << 8) | gb });
    }
  }

  _drawMountains(g, w, h, { count, minH, maxH, color }) {
    const seed = color;
    const lcg = makeLCG(seed);
    for (let i = 0; i < count; i++) {
      const peakX = (i + lcg() * 0.5) * (w / count);
      const peakY = h * (1 - minH - lcg() * (maxH - minH));
      const baseW = w / count * (1.2 + lcg() * 0.6);
      g.moveTo(peakX - baseW / 2, h)
       .lineTo(peakX, peakY)
       .lineTo(peakX + baseW / 2, h)
       .closePath()
       .fill({ color });
    }
  }

  _drawFoliage(g, w, h) {
    const lcg = makeLCG(0xf011a9e);
    const treeCount = Math.ceil(w / 48);
    for (let i = 0; i < treeCount; i++) {
      const x = (i + 0.3 + lcg() * 0.4) * (w / treeCount);
      const trunkH = 28 + lcg() * 20;
      const crownR = 20 + lcg() * 18;
      // trunk
      g.rect(x - 4, h - trunkH, 8, trunkH).fill({ color: 0x3a2510 });
      // crown (two overlapping circles for silhouette)
      g.circle(x, h - trunkH - crownR * 0.6, crownR).fill({ color: 0x1e5c1a });
      g.circle(x - crownR * 0.4, h - trunkH - crownR * 0.3, crownR * 0.75).fill({ color: 0x27701f });
    }
  }
}

// Deterministic LCG for reproducible procedural content.
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}
```

Full layer-construction code, seamless wrap mechanics, blur/tint depth cues, and mobile performance
guidelines are in `references/parallax-backgrounds.md`.

## Game loop integration

```javascript
// Bootstrap
const app = new Application();
await app.init({ resizeTo: window, antialias: false, resolution: Math.min(devicePixelRatio, 2) });
document.body.appendChild(app.canvas);

const worldContainer = new Container();
app.stage.addChild(worldContainer);

const camera = new Camera2D({ viewW: app.screen.width, viewH: app.screen.height,
                               worldW: 8000, worldH: 600 });
const parallax = new ParallaxBackground(app, camera);

app.ticker.add(({ deltaMS }) => {
  const dt = deltaMS / 1000;

  // 1. Update game world (sidescroller-engine / platformer-physics)
  player.update(dt);

  // 2. Inject shake offset (from particle-systems-and-juice if loaded)
  camera.shakeOffsetX = shakeSystem?.offsetX ?? 0;
  camera.shakeOffsetY = shakeSystem?.offsetY ?? 0;

  // 3. Update camera
  camera.update(player, dt);
  camera.applyTo(worldContainer);

  // 4. Update parallax (uses raw camera world position, not the spring output,
  //    so backgrounds feel grounded even while the spring is still settling)
  parallax.update(camera.x, camera.y);
});
```

## Workflow

1. **Set world bounds** from your level data and pass them to `Camera2D` at construction.
2. **Tune deadzone** to match your character's movement speed — wider deadzone for fast characters, tighter for slow ones.
3. **Tune look-ahead** by playing at design resolution. Overshoot means `lookAheadDist` is too large or `lookSmooth` is too high. Undershooting means increase `lookAheadDist`.
4. **Build parallax layers** using `LAYER_CONFIG` scroll factors. Start with the defaults; adjust `scrollX` until depth feels natural.
5. **Mobile check** at 390x844. Confirm parallax layers fill the screen fully with no gap at edges. Confirm frame rate stays at 60fps — reduce blur passes or layer count if needed.
6. **Wire shake** from `particle-systems-and-juice`: that skill fires a per-frame callback; set `camera.shakeOffsetX/Y` from it.
7. **QA pass** with `game-qa-and-testing` for edge cases: level start/end bound clamping, rapid direction reversal, zoom in/out during play.

## Cross-skill connections

| Need | Skill |
|---|---|
| Game loop, input, entity update | `sidescroller-engine` |
| Character movement, gravity, collision | `platformer-physics` |
| Screen-shake curves, trauma decay | `particle-systems-and-juice` |
| Procedural rock/terrain textures | `procedural-textures-and-materials` |
| Final QA and edge-case testing | `game-qa-and-testing` |

## Common failures and their fixes

**Camera jitter on moving platforms.** The target's `x/y` flickers between physics steps. Smooth the target position itself — use the platform's interpolated render position, not its physics body position. Alternatively, widen the dead zone slightly.

**Parallax seams visible at layer edges.** The `TilingSprite` width must equal or exceed `screen.width + 2 * maxTilePositionX`. If the camera moves faster than expected, seams appear. Fix: make the render texture at least `1.5 * screen.width` wide, or increase the `TilingSprite` width to `screen.width * 2`.

**Look-ahead overshoot when reversing.** `lookSmooth` is too high. Lower it to `0.04` or less, or add a velocity-magnitude gate: only apply look-ahead when `|target.vx| > threshold`.

**Shake that never settles.** The shake system (from `particle-systems-and-juice`) uses a trauma decay model. If shake offsets accumulate faster than they decay, check that only one system is adding trauma per frame. The camera itself does not manage decay — it only reads `shakeOffsetX/Y`.

**Camera snaps hard at world bounds.** The spring is still carrying velocity when it hits the clamp. After clamping position, zero out velocity in that axis: after `_clampToBounds()`, check if `this.x` changed and set `this._velX = 0`.

**Vertical bob every jump.** Vertical snap threshold is too small. Increase `vertSnapThreshold` to 20–40px so the camera ignores small vertical movements and only follows large platform transitions.

## References

- `references/camera-follow.md` — dead-zone math, critically-damped spring derivation, look-ahead tuning, multi-target framing, screen-to-world conversion
- `references/parallax-backgrounds.md` — layer scroll-factor model, TilingSprite wrap mechanics, procedural layer generation, tint/blur depth, mobile performance
