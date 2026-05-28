# Noise Functions

Every procedural texture is built on noise. This file gives the small, fast noise toolkit you bake to
an offscreen canvas at load time, then use as a PixiJS `Texture` or Three.js `CanvasTexture`. Bake
once; never run per-frame.

## Value noise (the workhorse)

Smooth, cheap, good enough for most surfaces.

```javascript
function makeValueNoise(seed = 1) {
  const rand = mulberry32(seed);
  const perm = new Float32Array(256).map(() => rand());
  const fade = t => t*t*t*(t*(t*6-15)+10);
  const lerp = (a,b,t) => a+(b-a)*t;
  const grid = (x,y) => perm[((x&255) + (y&255)*57) & 255];
  return function(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x-xi, yf = y-yi, u = fade(xf), v = fade(yf);
    const tl = grid(xi,yi),  tr = grid(xi+1,yi);
    const bl = grid(xi,yi+1),br = grid(xi+1,yi+1);
    return lerp(lerp(tl,tr,u), lerp(bl,br,u), v);   // 0..1
  };
}
function mulberry32(a){ return function(){ a|=0;a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
```

Seed it so textures are reproducible across reloads.

## Fractional Brownian motion (fBm)

Sum octaves of noise at increasing frequency / decreasing amplitude — gives natural detail (clouds,
marble veins, sandstone grain).

```javascript
function fbm(noise, x, y, { octaves = 5, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x*freq, y*freq);
    norm += amp; amp *= gain; freq *= lacunarity;
  }
  return sum / norm;   // 0..1
}
```

- More octaves = more detail (and more bake cost). 4–6 is plenty.
- `gain < 0.5` = smoother; `> 0.5` = rougher/grainier.

## Ridged noise (veins, metal brush, lightning)

`1 - |2·noise - 1|` turns noise into sharp ridges.

```javascript
function ridged(noise, x, y, octaves = 5) {
  let amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(2*noise(x*freq, y*freq) - 1);
    sum += amp * n*n; amp *= 0.5; freq *= 2;
  }
  return sum;
}
```

## Domain warping (organic, swirly)

Offset the lookup by another noise field — instant marble/liquid look.

```javascript
function warped(noise, x, y, amt = 4) {
  const wx = fbm(noise, x + 5.2, y + 1.3);
  const wy = fbm(noise, x + 1.7, y + 9.2);
  return fbm(noise, x + amt*wx, y + amt*wy);
}
```

## Directional / anisotropic (brushed metal)

Stretch the coordinate on one axis so detail elongates — the brushed-metal streak look.

```javascript
function brushed(noise, x, y) { return fbm(noise, x * 0.05, y * 4.0, { octaves: 3 }); }
```

## Baking to a canvas

```javascript
function bakeNoiseTexture(w, h, fn) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = Math.floor(fn(x, y) * 255); const i = (y*w + x) * 4;
    img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;   // -> PIXI.Texture.from(cv)  or  new THREE.CanvasTexture(cv)
}
```

For color textures, write per-channel or tint the grayscale at draw time. See `material-gallery.md`
for the recipes that combine these into named materials.

## Performance

- **Bake at load**, cache the canvas/texture, reuse. Never generate noise per frame.
- Bake at the size you'll display (e.g., 512²); upscaling a 256² with bilinear is fine for soft
  surfaces and halves bake time.
- Tile seamlessly by sampling noise on a torus: use `sin/cos` mapped coords if you need wraparound.
- Reuse one seeded `valueNoise` instance across materials for consistency.
