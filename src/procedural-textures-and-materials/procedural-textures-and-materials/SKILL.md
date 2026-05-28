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

## Sculpted relief: turning a flat shape into a lit, painted surface

A material fill alone is flat. What makes a symbol or panel read as *sculpted and painted* is lighting a procedural **height field**: derive a surface normal from the heightmap, then shade it (Blinn-Phong + rim + fake AO) through a painterly ramp. This is the keystone technique — `procedural-symbol-design` and `slot-hud-and-ui` both depend on it.

Pipeline: `height(uv)` (fBm + Worley + the shape's own silhouette) → **normal** via central differences → **Blinn-Phong** diffuse+spec → **rim light** → **AO** in the crevices → run the diffuse term through a **form-light ramp** instead of using it raw.

```javascript
// Canvas2D relief bake: height field -> normal -> shaded RGBA. Run once at load.
function shadeRelief(ctx, w, h, heightAt, albedo, opts = {}) {
  const L = opts.light ?? [-0.4, -0.6, 0.7];   // light dir (x,y,z), normalized
  const ll = Math.hypot(...L), l = L.map(v => v / ll);
  const shine = opts.shine ?? 48, strength = opts.strength ?? 2.5;
  const ambient = opts.ambient ?? 0.3, rimColor = opts.rim ?? [180, 200, 255];
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // central-difference normal from the height field
    const dx = heightAt(x + 1, y) - heightAt(x - 1, y);
    const dy = heightAt(x, y + 1) - heightAt(x, y - 1);
    let nx = -dx * strength, ny = -dy * strength, nz = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const diff = Math.max(nx*l[0] + ny*l[1] + nz*l[2], 0);
    // half-vector spec (view = +z)
    const hx = l[0], hy = l[1], hz = l[2] + 1, hn = Math.hypot(hx, hy, hz);
    const spec = Math.pow(Math.max((nx*hx + ny*hy + nz*hz) / hn, 0), shine);
    const rim = Math.pow(1 - nz, 3);                 // edge-facing = bright
    const ao = 0.5 + 0.5 * heightAt(x, y);           // crevices darker
    const lit = (ambient + ramp(diff)) * ao;         // painterly ramp on diffuse
    const i = (y * w + x) * 4;
    img.data[i]   = Math.min(albedo[0]*lit + spec*255 + rim*rimColor[0], 255);
    img.data[i+1] = Math.min(albedo[1]*lit + spec*255 + rim*rimColor[1], 255);
    img.data[i+2] = Math.min(albedo[2]*lit + spec*255 + rim*rimColor[2], 255);
    img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
```

The GLSL fragment-shader version (for live Fresnel/animated highlights instead of a bake) lives in `game-shaders-and-effects/references/custom-glsl-library.md`. Full recipe, per-material parameters, and the ramp/Worley-facet variants are in `references/sculpted-relief-shading.md`.

## Painterly ramps (not 2-stop gradients)

Flat 2-stop gradients are a "cheap" tell. Painters shade form on a *bell curve*: saturation peaks in the mid-tones (the terminator) and drops at both the highlight and the core shadow, and color *temperature* shifts (warm highlight → most-saturated terminator → cooler shadow, with a warm bounce on the shadow edge). Build a 4–6 stop ramp and sample it by the Lambert term:

```javascript
// 256px 1D ramp LUT, sampled by diffuse (0..1). Bake once; reuse everywhere.
function makeFormRamp(stops) {                 // stops: [[t,'#hex'],...]
  const c = new OffscreenCanvas(256, 1), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 256, 0);
  for (const [t, hex] of stops) grd.addColorStop(t, hex);
  g.fillStyle = grd; g.fillRect(0, 0, 256, 1);
  const px = g.getImageData(0, 0, 256, 1).data;
  return (t) => { const i = Math.max(0, Math.min(255, t*255|0))*4;
    return [px[i], px[i+1], px[i+2]]; };       // returns rgb for a lit value
}
// e.g. gold: shadow#3a2708 -> terminator#b9831f (most saturated) -> light#fff3b0
```

Use this `ramp()` to drive `shadeRelief` and to fill premium gradients; it is the difference between "plastic" and "painted."

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
- `references/sculpted-relief-shading.md` — the height→normal→Blinn+rim+AO+ramp pipeline (Canvas2D bake + GLSL), per-material params (gold leaf, polished gem, hammered metal, lacquer, carved stone), and the painterly form-light ramp
