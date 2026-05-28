---
name: threejs-game-3d
description: Build high-fidelity 3D scenes, casino cabinets, and game environments for slot and arcade games using Three.js r170+ with WebGPU renderer and TSL shaders. This skill owns 3D SCENE SETUP — geometry, PBR materials, three-point lighting rigs, cameras, and the premium scene template. Use whenever the user wants 3D graphics in a game — rotating slot cabinets, 3D bonus game environments, character models, cinematic camera moves, 3D particle systems, "PBR materials", "3D slot machine", or any 3D visual that needs to look premium rather than blocky. For post-processing visual EFFECTS applied on top of a scene (bloom, neon glow, god rays, holographic shimmer, motion blur, chromatic aberration, screen shake) use game-shaders-and-effects instead — it owns the EffectComposer pass chain for both 2D and 3D.
---

# Three.js Game 3D

Build production-quality 3D scenes for casino and arcade games. Three.js r170+ with WebGPU renderer and TSL (Three Shader Language).

## The core principle: start from the premium template

Claude's default Three.js output is a grey `BoxGeometry` with `MeshBasicMaterial` under a single `DirectionalLight`. It looks like a 1995 CAD prototype. Do not start from scratch. Copy `assets/premium-scene-template.html` and modify it. The template already has: `MeshPhysicalMaterial` with PBR parameters, a dramatic three-point lighting rig, `PCFSoftShadowMap`, `EffectComposer` with `UnrealBloomPass`, and an HDR-style environment. To get flat grey cubes from that starting point you'd have to delete the good stuff.

## 2026 renderer reality: WebGPU first

Since Safari 26 shipped WebGPU in September 2025, ~95% of browsers support it. Use the WebGPU renderer:

```javascript
import { WebGPURenderer } from 'three/webgpu';
const renderer = new WebGPURenderer({ antialias: true });
await renderer.init(); // mandatory before first render
```

Automatic WebGL 2 fallback is built in. For mobile, cap pixel ratio at 2 — `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.

## TSL: write shaders once for both renderers

TSL (Three Shader Language) replaces raw GLSL. Write shader logic as composable JavaScript functions that compile to WGSL (WebGPU) or GLSL (WebGL) automatically:

```javascript
import { vec3, float, sin, uniform, positionWorld, normalWorld, mix, color } from 'three/tsl';

// Pulsing neon plasma edge shader
const time = uniform(0);
const plasmaEdge = sin(positionWorld.x.mul(8).add(time)).mul(0.5).add(0.5);
const neonColor = mix(color(0x000000), color(0x00ff88), plasmaEdge);

material.colorNode = neonColor;
// Update in the render loop: time.value = clock.getElapsedTime();
```

Read `references/tsl-shader-library.md` for a full library of casino-relevant TSL effects.

## Materials: never MeshBasicMaterial

| Use case | Material | Key params |
|---|---|---|
| Metal cabinet frame | `MeshPhysicalMaterial` | `metalness: 0.95, roughness: 0.15, color: 0x1a1a2e` |
| Polished gold trim | `MeshPhysicalMaterial` | `metalness: 1.0, roughness: 0.05, color: 0xc8a850` |
| Glass reel screen | `MeshPhysicalMaterial` | `transmission: 0.9, roughness: 0.05, thickness: 0.5, ior: 1.5` |
| Velvet upholstery | `MeshStandardMaterial` | `roughness: 0.98, metalness: 0, color: 0x1a3a2a` |
| Emissive neon tube | `MeshStandardMaterial` | `emissive: 0x00ff88, emissiveIntensity: 3.0, roughness: 0.3` |
| Holographic panel | Custom TSL material | See `references/tsl-shader-library.md` holographic recipe |

`MeshBasicMaterial` is banned everywhere except loading-screen placeholders. It ignores all lighting — whatever you render will look like a flat vector illustration.

## Lighting rig

Three-point studio lighting is the baseline. Every scene starts with this:

```javascript
// Key light — primary directional source, casts shadows
const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
keyLight.position.set(5, 8, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 50;
keyLight.shadow.radius = 4; // PCFSoft blur radius
scene.add(keyLight);

// Fill light — softens key shadow, no shadows of its own
const fillLight = new THREE.DirectionalLight(0xe0f0ff, 0.8);
fillLight.position.set(-4, 3, -2);
scene.add(fillLight);

// Rim light — colored edge light for depth separation
const rimLight = new THREE.PointLight(0xac1eff, 1.5, 20);
rimLight.position.set(-2, 4, -6);
scene.add(rimLight);

// Ambient — keep low so shadows read with contrast
const ambient = new THREE.AmbientLight(0x111122, 0.3);
scene.add(ambient);

// Enable soft shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

For neon/cyberpunk aesthetics, replace the fill light with 2-3 colored `PointLight` sources (magenta, cyan, green) at low intensity. The key light stays white — a fully colored key reads as underwater, not neon.

## Post-processing: the visual quality multiplier

The difference between "basic" and "AAA" in Three.js is entirely in the post-processing chain. The template includes this, but here's what each pass does:

```javascript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Bloom: strength = how bright the glow, radius = how far it spreads,
// threshold = minimum brightness to bloom (keep high to bloom only actual lights)
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.2,   // strength — reduce for luxury themes, push to 2.0 for cyberpunk
  0.4,   // radius
  0.85   // threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass()); // tone mapping + gamma correction
```

Tune bloom by genre. Egyptian: strength 0.6, high threshold (only gold glints). Cyberpunk: strength 2.0, low threshold (everything neon glows). Vegas classic: strength 0.8. Dark fantasy: strength 1.5 with a blue tint.

## Geometry: no raw box edges

Sharp box edges read instantly as "prototype." Use:

- `RoundedBoxGeometry` (from three/examples) for any cabinet body
- `TorusGeometry` for frame rings, neon tube halos
- `LatheGeometry` for turned metal pillars, trophy shapes
- `ExtrudeGeometry` with a slight bevel (`bevelEnabled: true, bevelSize: 0.02`) for logo text and badges
- `CylinderGeometry` for columns, reels, drum shapes

For mechanical detail (greebles, bolts, panel lines), procedurally scatter tiny `CylinderGeometry` and `BoxGeometry` instances across surfaces using instanced mesh — one draw call for hundreds of screws.

## Hybrid with PixiJS

To use PixiJS reels inside a Three.js cabinet, render PixiJS to an offscreen canvas and apply it as a `CanvasTexture` on the screen mesh:

```javascript
const pixiCanvas = pixiApp.canvas; // PixiJS renders here
const screenTexture = new THREE.CanvasTexture(pixiCanvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;

const screenMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2.0, 1.5),
  new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissiveMap: screenTexture,
    emissiveIntensity: 0.6, // screen self-illuminates
  })
);

// In render loop:
pixiApp.ticker.update();
screenTexture.needsUpdate = true;
composer.render();
```

See `references/hybrid-pixi-three.md` for the full pattern.

## Mobile optimization

- Keep draw calls under 100. Use `InstancedMesh` for repeated geometry (bolts, studs, particles).
- Use `DRACOLoader` for any imported GLTF models — typically 60-80% size reduction.
- Avoid real-time shadows on mobile for anything except the main subject. Bake secondary shadows into lightmap textures.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` — enforce this.
- Prefer `KTX2Loader` + `BasisTextureLoader` for compressed GPU textures.
- LOD for complex geometry: `THREE.LOD` with 3 levels.

## References

- `references/tsl-shader-library.md` — TSL node shader recipes: plasma rail, holographic, liquid metal, scan lines, godray, chromatic aberration
- `references/lighting-presets.md` — complete lighting rigs per genre
- `references/geometry-patterns.md` — rounded cabinet bodies, mechanical detail, procedural greebles
- `references/hybrid-pixi-three.md` — PixiJS-as-texture inside Three.js cabinet
- `references/mobile-optimization.md` — draw call budgets, instancing, LOD, compressed textures
