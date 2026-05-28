---
name: procedural-textures-and-materials
description: Generate realistic surface textures entirely in code — brushed metal, marble, velvet, sandstone, holographic film, wood grain, corroded copper — for use in both PixiJS (as sprite textures) and Three.js (as material maps). Use whenever a game needs textured surfaces without external image files. Triggers for "realistic surface", "textured background", "material texture", "brushed metal", "marble", "velvet felt", "wood grain", "holographic", "chrome finish", or any request to make a surface look like a real material. Should be combined with procedural-symbol-design for symbols and pixijs-slot-graphics or threejs-game-3d for the rendering layer.
---

# Procedural Textures and Materials

Generate every surface material in code. No external PNG textures needed. Works for both PixiJS (generates a `Texture` from an offscreen canvas) and Three.js (generates a `CanvasTexture`).

## The generation pattern

All procedural textures follow the same pipeline:

1. Create an offscreen `OffscreenCanvas` (or regular `canvas` for compatibility)
2. Draw the texture using 2D Canvas API with noise functions
3. Convert to PixiJS `Texture` or Three.js `CanvasTexture`
4. Bake it once at load time — never regenerate per frame

```javascript
function generateTexture(width, height, drawFn) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);

  // For PixiJS:
  return Texture.from(canvas);

  // For Three.js:
  // return new THREE.CanvasTexture(canvas);
}
```

## Simplex-style noise (no dependency)

All procedural textures need noise. This is a fast value noise implementation — not true simplex but visually equivalent for textures:

```javascript
function valueNoise(x, y, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const hash = (a, b) => {
    let n = (a * 1619 + b * 31337 + seed * 6791) & 0x7fffffff;
    n = (n >> 13) ^ n;
    return ((n * (n * n * 60493 + 19990303) + 1376312589) & 0x7fffffff) / 0x7fffffff;
  };

  return hash(i, j) * (1-ux) * (1-uy) +
         hash(i+1, j) * ux * (1-uy) +
         hash(i, j+1) * (1-ux) * uy +
         hash(i+1, j+1) * ux * uy;
}

function fbm(x, y, octaves = 4, seed = 0) {
  let value = 0, amplitude = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * freq, y * freq, seed + i) * amplitude;
    amplitude *= 0.5;
    freq *= 2.1;
  }
  return value;
}
```

## Brushed metal

```javascript
function drawBrushedMetal(ctx, w, h, baseHex = '#8a93a1', lightDir = 0) {
  // Base color fill
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, w, h);

  // Horizontal brush streaks (or rotate canvas for different brush direction)
  for (let y = 0; y < h; y++) {
    const n = fbm(y * 0.05, 0, 3) * 0.35 - 0.175;
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, n)})`;
    ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, -n)})`;
    ctx.fillRect(0, y, w, 1);
  }

  // Specular highlight band (light reflection)
  const grd = ctx.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
}
```

## Marble

```javascript
function drawMarble(ctx, w, h, veinColor = '#8080a0', baseColor = '#e8e0d8') {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);

  // Veins using domain-warped fbm
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < h; y += 2) {
      const nx = x / w * 4, ny = y / h * 4;
      // Domain warp: offset the noise lookup by another noise value
      const warpX = fbm(nx + 0.5, ny + 0.3, 4, 10);
      const warpY = fbm(nx + 2.1, ny + 1.7, 4, 20);
      const v = fbm(nx + warpX * 1.2, ny + warpY * 1.2, 6, 0);
      const vein = Math.pow(Math.sin(nx * 2 + v * 8), 6);

      if (vein > 0.1) {
        const alpha = vein * 0.6;
        ctx.fillStyle = veinColor + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
}
```

## Velvet / felt

```javascript
function drawVelvet(ctx, w, h, color = '#1a3a2a') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);

  // Micro fiber noise — fine, high frequency
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const n = valueNoise(x * 0.2, y * 0.2, 42);
      const alpha = (n - 0.5) * 0.3;
      if (alpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      } else {
        ctx.fillStyle = `rgba(0,0,0,${-alpha})`;
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Sheen highlight diagonal
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
}
```

## Sandstone

```javascript
function drawSandstone(ctx, w, h) {
  // Warm base with fbm grain
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < h; y += 2) {
      const n = fbm(x / w * 6, y / h * 6, 5, 7);
      const r = 200 + n * 55;
      const g = 160 + n * 45;
      const b = 100 + n * 30;
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
}
```

## Holographic film (animated)

Returns a draw function you call per-frame with a time parameter:

```javascript
function makeHolographicDrawer(w, h) {
  return function drawHolographic(ctx, time) {
    for (let x = 0; x < w; x += 2) {
      for (let y = 0; y < h; y += 2) {
        const hue = (x / w * 360 + y / h * 120 + time * 60) % 360;
        const sat = 80 + fbm(x / w * 3, y / h * 3 + time * 0.1) * 20;
        const lit = 55 + fbm(x / w * 5, y / h * 5 + time * 0.15, 3) * 25;
        ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  };
}
// For animated holographic in PixiJS: use a RenderTexture that you redraw each frame.
// For static: call at time = 0 and bake.
```

## Dark wood grain

```javascript
function drawWoodGrain(ctx, w, h, ringScale = 8) {
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const dist = Math.sqrt((x - w/2) ** 2 + (y * 0.4) ** 2);
      const rings = Math.sin(dist / w * Math.PI * ringScale
                           + fbm(x / w * 3, y / h * 3, 4) * 3) * 0.5 + 0.5;
      const r = 80 + rings * 50;
      const g = 45 + rings * 30;
      const b = 15 + rings * 10;
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
```

## Performance: baking and atlasing

Texture generation is slow (iterating every pixel). Do it during the loading screen, bake to a canvas, and don't regenerate:

```javascript
const TEXTURES = {};

async function bakeTextures() {
  TEXTURES.metal  = generateTexture(256, 256, drawBrushedMetal);
  TEXTURES.velvet = generateTexture(256, 256, (ctx, w, h) => drawVelvet(ctx, w, h));
  TEXTURES.marble = generateTexture(512, 512, drawMarble);
  // etc.
}
```

For Three.js: pass `needsUpdate = true` after creation but not each frame (except animated holographic).

For PixiJS: use the baked `Texture` as a `TilingSprite` or `Sprite` covering the panel. Add a `ColorMatrixFilter` tint on top to adjust hue per game state.

## References

- `references/noise-functions.md` — extended noise library including 2D/3D simplex, cellular/Voronoi, domain warp
- `references/material-gallery.md` — reference renders and parameters for 20+ surface types: corroded copper, cracked stone, ice, stained glass, circuit board, parchment, obsidian
