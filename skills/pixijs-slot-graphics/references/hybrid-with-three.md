# Hybrid Three.js + PixiJS

When you want a 3D cabinet with 2D reels rendered into a screen on it, you combine the two engines. Two patterns work; this reference covers both.

## Pattern A: PixiJS as a CanvasTexture on a 3D mesh

The cleanest, most performant pattern. The PixiJS reel renders to its own offscreen canvas; Three.js samples that canvas as a dynamic texture on the cabinet's "screen" mesh.

```javascript
import * as THREE from 'three';
import { Application } from 'pixi.js';

// 1. Three.js setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

// 2. PixiJS rendering to its own canvas (not attached to DOM)
const pixiApp = new Application();
await pixiApp.init({
  width: 1024,
  height: 768,
  backgroundAlpha: 1,
  backgroundColor: 0x0a0418,
});
// Build the slot reel inside pixiApp.stage — same as a standalone PixiJS project.

// 3. Wrap the PixiJS canvas as a Three.js texture
const pixiTexture = new THREE.CanvasTexture(pixiApp.canvas);
pixiTexture.colorSpace = THREE.SRGBColorSpace;
pixiTexture.minFilter = THREE.LinearFilter;

// 4. Apply it to the "screen" mesh of your cabinet
const screenGeometry = new THREE.PlaneGeometry(2.0, 1.5);
const screenMaterial = new THREE.MeshStandardMaterial({
  map: pixiTexture,
  emissive: 0xffffff,
  emissiveMap: pixiTexture,
  emissiveIntensity: 0.6, // makes the screen self-illuminate
});
const screen = new THREE.Mesh(screenGeometry, screenMaterial);
scene.add(screen);

// 5. Render loop: tick PixiJS, then mark the texture dirty for Three.js
function animate() {
  pixiApp.ticker.update();           // PixiJS advances its internal time
  pixiTexture.needsUpdate = true;    // Tell Three.js to re-upload the canvas
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

Pros:
- Cleanest separation. Each engine does what it's best at.
- Screen surface curves with the 3D mesh, picks up scene lighting, can be reflected in mirrors.
- Performance is good because the upload only happens when the PixiJS layer actually changes.

Cons:
- The PixiJS canvas resolution is fixed at init; if the cabinet's screen takes up a large portion of the screen, you need a high PixiJS canvas resolution (1024-2048px).

## Pattern B: Shared WebGL context (more advanced)

Both engines render into the same WebGL context. Useful when the 2D layer needs to composite directly with 3D depth (e.g. 2D particles that occlude/are occluded by 3D objects).

```javascript
import * as THREE from 'three';
import { WebGLRenderer as PixiWebGLRenderer, Container } from 'pixi.js';

const threeRenderer = new THREE.WebGLRenderer({
  antialias: true,
  stencil: true, // PixiJS masks need stencil
});

const pixiRenderer = new PixiWebGLRenderer();
await pixiRenderer.init({
  context: threeRenderer.getContext(),
  width: window.innerWidth,
  height: window.innerHeight,
  clearBeforeRender: false, // critical: Pixi must not wipe Three's render
});

const pixiStage = new Container();

function animate() {
  threeRenderer.resetState();
  threeRenderer.render(scene, camera);

  pixiRenderer.resetState();
  pixiRenderer.render({ container: pixiStage, clear: false });

  requestAnimationFrame(animate);
}
```

Both engines must call `resetState()` before rendering — otherwise the second engine inherits the first's GPU state and renders garbage.

Pros:
- Single GL context, no inter-engine texture upload cost.
- 2D and 3D can composite with depth interaction.

Cons:
- Brittle. WebGL state is sensitive; one engine's bug can corrupt the other.
- Harder to debug.
- Only worth it when Pattern A's CanvasTexture cost is actually a bottleneck (rare).

## Recommendation

Use Pattern A by default. It's clean, performant, and lets each engine evolve independently. Reach for Pattern B only when profiling shows the CanvasTexture upload as the real bottleneck — which usually means very large screen meshes at very high resolutions.

## Lighting interaction (Pattern A only)

The `emissiveMap` setting on the screen material is what makes the slot reels read as "glowing into the room" — without it, the screen surface only shows the texture as a flat color, ignoring the 3D lighting context. Tune `emissiveIntensity` from 0.4 (subtle glow) to 1.0 (very bright screen) depending on how dark the cabinet's environment is.

To make the cabinet's surroundings actually glow from the screen (real reflected light), use a `PointLight` placed just in front of the screen, with intensity modulated by the reels' state (brighter during a win celebration, dimmer during idle).
