# Hybrid: PixiJS Reels Inside a Three.js Cabinet

The premium look for a 3D slot is a **2D reel set (PixiJS) playing on the screen of a 3D cabinet
(Three.js)**. Pure-3D reels are expensive and rarely look as crisp as 2D sprite reels; pure-2D loses
the cabinet, lighting, and bloom. The hybrid gives you both: PixiJS owns the reels, symbols, and win
animations (it's better and cheaper at 2D), Three.js owns the cabinet, lights, and post FX. This file
is the full wiring. The mirror of this doc lives in `pixijs-slot-graphics/references/hybrid-with-three.md`
— read whichever skill you're driving from; the seam is the same.

## Architecture

```
PixiJS Application (offscreen canvas)
        │  renders reels, symbols, win FX
        ▼
THREE.CanvasTexture(pixiApp.canvas)
        │  applied as map + emissiveMap
        ▼
screen Mesh (PlaneGeometry) inside the cabinet
        │
        ▼
EffectComposer (bloom, tone map) → display
```

PixiJS never touches the DOM-visible canvas. It renders to its own canvas, which Three.js samples as a
texture every frame.

## Step 1 — PixiJS renders offscreen

```javascript
import { Application } from 'pixi.js';

const pixiApp = new Application();
await pixiApp.init({
  width: 1024, height: 768,
  backgroundAlpha: 1,           // opaque — the screen mesh is lit, not composited
  autoStart: false,             // we drive the ticker manually from the Three loop
  antialias: true,
});
// Build the reel set into pixiApp.stage here (see pixijs-slot-graphics).
```

Pick a power-of-two-ish texture size that matches the screen aspect. 1024×768 (4:3) suits a classic
cabinet; use 1024×1280 for a tall mobile-portrait reel screen.

## Step 2 — wrap the PixiJS canvas as a texture

```javascript
const screenTexture = new THREE.CanvasTexture(pixiApp.canvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;   // critical — else colors look washed/dark
screenTexture.minFilter  = THREE.LinearFilter;     // no mipmaps on a live texture
screenTexture.generateMipmaps = false;
screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

`colorSpace = SRGBColorSpace` is the most common bug here — omit it and the reels look muddy because
the texture is read as linear.

## Step 3 — the screen mesh self-illuminates

A real slot screen emits light; it isn't just a lit surface. Use the texture as both `map` and
`emissiveMap` so the reels glow slightly and survive a dark scene:

```javascript
const screenMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2.0, 1.5),
  new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissive: 0xffffff,
    emissiveMap: screenTexture,
    emissiveIntensity: 0.6,        // 0.4 luxury, 0.8 neon — tune to genre bloom
    roughness: 0.25, metalness: 0,
  })
);
```

Float the screen ~1cm in front of a black backing plane so the cabinet bezel frames it and no cabinet
geometry z-fights with the screen.

## Step 4 — drive both loops from one rAF

One render loop, ordered: update PixiJS → flag the texture dirty → render Three.js. Order matters; if
you render Three before Pixi ticks you sample last frame's reels.

```javascript
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  pixiApp.ticker.update();          // advance reel spin / win FX
  screenTexture.needsUpdate = true; // re-upload the canvas to the GPU this frame

  time.value = clock.getElapsedTime(); // any TSL uniforms
  composer.render();                // Three.js + post FX
}
animate();
```

`needsUpdate = true` every frame is the cost of the hybrid — you re-upload a full texture per frame.
That's fine at 1024² on modern GPUs. See the optimization note below for when it isn't.

## Input mapping: 3D screen → 2D reel coordinates

Taps land on a 3D mesh but PixiJS thinks in 2D canvas pixels. Raycast to the screen mesh, read the UV,
multiply by the PixiJS canvas size, and synthesize a PixiJS pointer event:

```javascript
function onPointerDown(e) {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(screenMesh)[0];
  if (!hit) return;
  const px = hit.uv.x * pixiApp.renderer.width;
  const py = (1 - hit.uv.y) * pixiApp.renderer.height;  // flip V — UV origin is bottom-left
  // Forward to your PixiJS hit-test (e.g. spinButton.containsPoint or a manual federated event).
  routePixiTap(px, py);
}
```

The `1 - hit.uv.y` flip trips everyone up: Three.js UV origin is bottom-left, PixiJS canvas origin is
top-left.

## When to keep it pure-2D instead

The hybrid earns its cost only if the cabinet/lighting is on screen. If the game is reels-fill-screen
(typical mobile portrait), skip Three.js entirely — render PixiJS directly. Use the hybrid for:
lobby/attract cabinets, 3D bonus rooms, landscape "showcase" presentations. Don't pay the per-frame
texture upload for a screen the cabinet barely frames.

## Performance notes

- The full-texture re-upload each frame is the bottleneck. At 1024² it's negligible; at 2048² on a
  low-end Android it can cost 3–4ms. Drop the PixiJS canvas resolution before you drop framerate.
- Pause the upload when reels are idle and nothing animates: only set `needsUpdate = true` on frames
  where PixiJS actually changed. A dirty flag from your reel state machine pays for itself.
- See `mobile-optimization.md` for the surrounding draw-call and pixel-ratio budget.
