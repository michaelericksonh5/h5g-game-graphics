# Parallax Backgrounds Reference

PixiJS v8 — scroll-factor model, TilingSprite wrap mechanics, procedural layer generation (sky
gradient, silhouette mountains, rolling hills, foliage), tint/blur depth cues, and mobile
performance guidelines. Zero external assets.

---

## 1. Scroll-factor model

Each background layer scrolls at a fraction of the camera's movement. Factor 0.0 = fixed (distant
sky). Factor 1.0 = moves with the world (foreground debris). Values between give depth:

```javascript
const LAYER_CONFIG = [
  { key: 'sky',       scrollX: 0.00, scrollY: 0.00, zIndex: 0   },
  { key: 'farMtn',    scrollX: 0.10, scrollY: 0.04, zIndex: 1   },
  { key: 'midHill',   scrollX: 0.28, scrollY: 0.10, zIndex: 2   },
  { key: 'nearFoil',  scrollX: 0.60, scrollY: 0.18, zIndex: 3   },
];
```

Vertical scroll factor (`scrollY`) should be much smaller than horizontal to avoid making the
background feel like it's tilting. Values of 0 (fixed horizon) to 0.2 (slight parallax dip) are
safe for standard platformers.

---

## 2. TilingSprite for seamless horizontal wrap

`TilingSprite` repeats a texture infinitely via `tilePosition`. Update `tilePosition.x` each frame
based on how far the camera has moved, scaled by the layer's scroll factor:

```javascript
// In the update loop:
for (const layer of layers) {
  layer.sprite.tilePosition.x = -cameraX * layer.cfg.scrollX;
  layer.sprite.tilePosition.y = -cameraY * layer.cfg.scrollY;
}
```

The sprite's `width` should be `screen.width` (or a little larger to absorb sub-pixel gaps).
The underlying `RenderTexture` width must be large enough that the tile repeat isn't visible at
the maximum camera speed in a single frame:

```
minTextureWidth = screen.width + maxCameraSpeedPx * maxFrameDeltaMs / 1000 * scrollX + 2
```

For typical side-scrollers (max speed 600 px/s, scroll factor 0.65, 16ms frame):
```
600 * 0.016 * 0.65 ≈ 6.2 px/frame  →  texture width = screen.width + 16px  (safe margin)
```

In practice, matching the texture width to `screen.width` is sufficient for all layers with
`scrollX < 0.8`. For the nearest layer at full speed, add a 64px buffer.

---

## 3. Procedural sky layer

A gradient sky built entirely via `Graphics`:

```javascript
function buildSkyTexture(renderer, w, h) {
  const g = new Graphics();

  // Base deep sky colour.
  g.rect(0, 0, w, h).fill({ color: 0x0d1b3e });

  // Gradient: render thin horizontal bands blending horizon colour upward.
  const BANDS = 48;
  for (let i = 0; i < BANDS; i++) {
    const t  = i / (BANDS - 1);
    const y  = h * t;
    const bh = Math.ceil(h / BANDS) + 1;  // +1 avoids hairline gaps

    // Interpolate deep-blue at top to warm-orange horizon at bottom.
    const r = lerp(0x0d, 0xdd, t * t);      // quadratic ease toward horizon
    const gv = lerp(0x1b, 0x88, t * t);
    const b  = lerp(0x3e, 0x44, t);

    const col = (Math.round(r) << 16) | (Math.round(gv) << 8) | Math.round(b);
    g.rect(0, y, w, bh).fill({ color: col });
  }

  // Star field: small bright dots in upper 60% of sky.
  const lcg = makeLCG(0xdeadbeef);
  for (let i = 0; i < 80; i++) {
    const sx   = lcg() * w;
    const sy   = lcg() * h * 0.6;
    const size = lcg() < 0.15 ? 2 : 1;
    const brightness = Math.round(180 + lcg() * 75);
    const col  = (brightness << 16) | (brightness << 8) | brightness;
    g.circle(sx, sy, size).fill({ color: col, alpha: 0.6 + lcg() * 0.4 });
  }

  const rt = RenderTexture.create({ width: w, height: h });
  renderer.render({ container: g, target: rt });
  return rt;
}

function lerp(a, b, t) { return a + (b - a) * t; }
```

---

## 4. Procedural mountain silhouettes

Mountains are drawn as filled triangular wedges. Varying peak height and base width creates an
irregular ridge:

```javascript
function buildMountainTexture(renderer, w, h, opts) {
  const {
    count       = 7,
    minHeightFrac = 0.35,   // fraction of h for shortest peak
    maxHeightFrac = 0.62,   // fraction of h for tallest peak
    baseWidthMin  = 0.8,    // multiplier of slot width
    baseWidthMax  = 1.4,
    color         = 0x3a4f6a,
    seed          = 0xabcd1234,
  } = opts;

  const g   = new Graphics();
  const lcg = makeLCG(seed);

  // Draw rear mountains first (slightly darker).
  const slotW = w / count;
  for (let pass = 0; pass < 2; pass++) {
    const col = pass === 0 ? darken(color, 0.15) : color;
    const offsetX = pass === 0 ? slotW * 0.5 : 0;   // stagger rear layer
    const cnt = pass === 0 ? count + 1 : count;

    for (let i = 0; i < cnt; i++) {
      const cx    = offsetX + (i + 0.2 + lcg() * 0.6) * (w / cnt);
      const peakY = h * (1 - minHeightFrac - lcg() * (maxHeightFrac - minHeightFrac));
      const bw    = slotW * (baseWidthMin + lcg() * (baseWidthMax - baseWidthMin));

      g.moveTo(cx - bw / 2, h)
       .lineTo(cx, peakY)
       .lineTo(cx + bw / 2, h)
       .closePath()
       .fill({ color: col });

      // Snow cap on tallest peaks.
      if (peakY < h * 0.42) {
        const capH = (h * 0.42 - peakY) * 0.55;
        const capW = bw * 0.18;
        g.moveTo(cx - capW, peakY + capH)
         .lineTo(cx, peakY)
         .lineTo(cx + capW, peakY + capH)
         .closePath()
         .fill({ color: 0xeef4ff, alpha: 0.9 });
      }
    }
  }

  const rt = RenderTexture.create({ width: w, height: h });
  renderer.render({ container: g, target: rt });
  return rt;
}

function darken(color, amount) {
  const r = ((color >> 16) & 0xff) * (1 - amount);
  const g = ((color >>  8) & 0xff) * (1 - amount);
  const b = ( color        & 0xff) * (1 - amount);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
```

---

## 5. Procedural rolling hills

Hills use a smoother silhouette built from bezier curves:

```javascript
function buildHillTexture(renderer, w, h, opts) {
  const {
    hillCount  = 5,
    minH       = 0.18,
    maxH       = 0.36,
    color      = 0x3d7a3a,
    seed       = 0x11223344,
  } = opts;

  const g   = new Graphics();
  const lcg = makeLCG(seed);

  const slotW = w / hillCount;
  for (let i = 0; i < hillCount + 1; i++) {
    const cx    = (i + 0.1 + lcg() * 0.8) * slotW;
    const peakY = h * (1 - minH - lcg() * (maxH - minH));
    const hw    = slotW * (0.7 + lcg() * 0.6);

    // Quadratic bezier hill: flat base, curved top.
    g.moveTo(cx - hw, h)
     .quadraticCurveTo(cx, peakY, cx + hw, h)
     .closePath()
     .fill({ color });
  }

  const rt = RenderTexture.create({ width: w, height: h });
  renderer.render({ container: g, target: rt });
  return rt;
}
```

---

## 6. Procedural foliage layer

The nearest layer has individual trees drawn as trunk + layered crown ellipses:

```javascript
function buildFoliageTexture(renderer, w, h, opts) {
  const {
    density   = 1.0,  // 1.0 = roughly one tree per 48px
    color     = 0x1d4f1a,
    accent    = 0x2a6e24,
    trunkCol  = 0x3a2510,
    seed      = 0xcafebabe,
  } = opts;

  const g   = new Graphics();
  const lcg = makeLCG(seed);
  const spacing = 48 / density;
  const count   = Math.ceil(w / spacing);

  for (let i = 0; i < count; i++) {
    const x       = (i + 0.15 + lcg() * 0.7) * spacing;
    const trunkH  = 24 + lcg() * 28;
    const crownR  = 18 + lcg() * 22;
    const trunkW  = 5 + lcg() * 4;

    // Trunk.
    g.rect(x - trunkW / 2, h - trunkH, trunkW, trunkH)
     .fill({ color: trunkCol });

    // Primary crown.
    g.circle(x, h - trunkH - crownR * 0.55, crownR)
     .fill({ color });

    // Offset sub-crowns for irregular silhouette.
    const subs = 2 + Math.floor(lcg() * 2);
    for (let s = 0; s < subs; s++) {
      const ox = (lcg() - 0.5) * crownR * 1.1;
      const oy = (lcg() * 0.6) * crownR;
      const sr = crownR * (0.55 + lcg() * 0.3);
      g.circle(x + ox, h - trunkH - crownR * 0.4 + oy, sr)
       .fill({ color: accent });
    }
  }

  const rt = RenderTexture.create({ width: w, height: h });
  renderer.render({ container: g, target: rt });
  return rt;
}
```

---

## 7. Tint and blur as depth cues

Layers that are further away should appear:
- Cooler / more desaturated (atmospheric haze).
- Slightly blurred (depth of field).

Apply both at sprite construction time, not every frame:

```javascript
const DEPTH_CONFIG = [
  { key: 'sky',      tint: 0xffffff, blurStrength: 0  },
  { key: 'farMtn',   tint: 0xaabfcc, blurStrength: 1.5 }, // cool blue haze
  { key: 'midHill',  tint: 0xbbd4b0, blurStrength: 0  }, // slight cool-green
  { key: 'nearFoil', tint: 0xffffff, blurStrength: 0  }, // full saturation
];

function applyDepthFX(sprite, tint, blurStrength) {
  sprite.tint = tint;
  if (blurStrength > 0) {
    sprite.filters = [new BlurFilter({ strength: blurStrength, quality: 2 })];
  }
}
```

Avoid `BlurFilter` on the sky and nearest layers — the sky is already soft by design, and the
nearest layer should be crisp to reinforce depth contrast.

---

## 8. Full ParallaxBackground class

```javascript
import {
  Container, Graphics, TilingSprite, RenderTexture, BlurFilter
} from 'pixi.js';

export class ParallaxBackground {
  constructor(app) {
    this.app = app;
    this.container = new Container();
    this.container.sortableChildren = false;
    app.stage.addChildAt(this.container, 0);  // behind everything

    this._layers = [];
    this._init();
  }

  _init() {
    const { screen, renderer } = this.app;
    const W = screen.width;
    const H = screen.height;

    const defs = [
      {
        key: 'sky',
        scrollX: 0.00, scrollY: 0.00,
        build: () => buildSkyTexture(renderer, W, H),
        tint: 0xffffff, blur: 0,
      },
      {
        key: 'farMtn',
        scrollX: 0.10, scrollY: 0.04,
        build: () => buildMountainTexture(renderer, W, H,
          { count: 6, minHeightFrac: 0.32, maxHeightFrac: 0.58,
            color: 0x3a4f6a, seed: 0xaabbccdd }),
        tint: 0xaabfd4, blur: 1.5,
      },
      {
        key: 'midHill',
        scrollX: 0.28, scrollY: 0.10,
        build: () => buildHillTexture(renderer, W, H,
          { hillCount: 6, minH: 0.18, maxH: 0.35, color: 0x3d6e38, seed: 0x99887766 }),
        tint: 0xc8e0c0, blur: 0,
      },
      {
        key: 'nearFoil',
        scrollX: 0.62, scrollY: 0.18,
        build: () => buildFoliageTexture(renderer, W, H,
          { density: 1.2, color: 0x1d4f1a, accent: 0x2a6e24, seed: 0x12ab34cd }),
        tint: 0xffffff, blur: 0,
      },
    ];

    for (const def of defs) {
      const tex = def.build();
      const sprite = new TilingSprite({ texture: tex, width: W, height: H });
      sprite.tint = def.tint;
      if (def.blur > 0) sprite.filters = [new BlurFilter({ strength: def.blur, quality: 2 })];
      this.container.addChild(sprite);
      this._layers.push({ sprite, scrollX: def.scrollX, scrollY: def.scrollY });
    }
  }

  // Call every frame with the camera's current world-space x/y.
  update(cameraX, cameraY) {
    for (const layer of this._layers) {
      layer.sprite.tilePosition.x = -cameraX * layer.scrollX;
      layer.sprite.tilePosition.y = -cameraY * layer.scrollY;
    }
  }
}
```

---

## 9. Mobile performance guidelines

**Layer count.** Four layers (sky, far, mid, near) is the safe ceiling on mid-tier Android
(Snapdragon 665 class). Each layer is one draw call. With blur filters, each layer costs an
extra off-screen render pass — limit blurred layers to one or two.

**Resolution.** Render the `RenderTexture` at the CSS pixel size of the screen, not the
device-pixel-ratio size. The TilingSprite is already rendered at screen resolution; upscaling
via PixiJS's DPR cap handles the rest. Building a 2× texture and applying DPR costs extra VRAM
with no visible benefit for blurry background layers.

**Rebuilding on resize.** On orientation change, recreate the textures at the new dimensions.
Dispose old ones with `texture.destroy(true)`:

```javascript
window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  parallax.rebuild();
});

// In ParallaxBackground:
rebuild() {
  for (const layer of this._layers) {
    layer.sprite.texture.destroy(true);
  }
  this.container.removeChildren();
  this._layers = [];
  this._init();
}
```

**Avoid per-frame Graphics draws.** All procedural geometry is rendered once into a
`RenderTexture` at startup, then tiled cheaply. Never re-draw the `Graphics` object every tick.

**BlurFilter quality setting.** `quality: 2` (two blur passes) is sufficient for background
layers. `quality: 4` is overkill and doubles the pass count. For very subtle blur (`strength < 1`),
drop to `quality: 1`.
