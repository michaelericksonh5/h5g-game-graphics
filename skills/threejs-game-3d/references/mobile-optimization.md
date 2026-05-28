# Mobile Optimization for Three.js Casino Scenes

A scene that runs 60fps on a desktop GPU can run 18fps on a three-year-old Android. Slot players are
overwhelmingly on mid-range phones, and a stuttering cabinet reads as "broken," not "premium." This
file is the budget and the techniques that keep a 3D casino scene smooth on the devices that matter.
Geometry vocabulary is in `geometry-patterns.md`; this is the performance discipline applied to it.

## The budgets (mid-range Android, target 60fps)

| Metric | Budget | Why |
|---|---|---|
| Draw calls | < 100 | each call has CPU overhead; the GPU isn't the bottleneck on mobile |
| Triangles on screen | < 150k | one cabinet ~8k; a full lobby scene fits easily under this |
| Texture memory | < 256 MB | use compressed (KTX2) textures, not raw PNG |
| Real-time shadow maps | 1 | shadows are the most expensive per-frame cost on mobile |
| Pixel ratio | capped at 2 | a 3× retina phone renders 9× the pixels for no visible gain |
| Lights casting shadows | 1 (the key) | fill/rim lights must not `castShadow` |

If you blow the draw-call budget, framerate dies before the triangle budget ever matters. Optimize draw
calls first.

## Pixel ratio — the single highest-impact line

```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

A modern phone reports `devicePixelRatio` of 3 or 3.5. Rendering at native 3× means 9× the fragments of
1×. Capping at 2 is visually indistinguishable on a phone screen and can double your framerate. This is
non-negotiable and already in the `SKILL.md` template.

## Instancing kills draw calls

Every repeated object — bolts, studs, coins, particles, identical cabinets in a lobby — must be a single
`InstancedMesh`, not N separate meshes:

```javascript
const coins = new THREE.InstancedMesh(coinGeo, coinMat, 200);
const m = new THREE.Matrix4();
for (let i = 0; i < 200; i++) { m.setPosition(rand(), rand(), rand()); coins.setMatrixAt(i, m); }
coins.instanceMatrix.needsUpdate = true;
// 200 coins, ONE draw call.
```

Merge *static* geometry that shares a material with `BufferGeometryUtils.mergeGeometries([...])` — a
cabinet's fixed trim pieces collapse from 6 draw calls to 1.

## Shadows: one caster, bake the rest

Real-time shadow maps are the heaviest per-frame cost. On mobile:

- Only the **key light** casts shadows. `fillLight.castShadow = false`, `rimLight.castShadow = false`.
- Keep the shadow map at `1024×1024` on mobile (the 2048 in the desktop template is too heavy).
- Tighten the shadow camera frustum to the subject — a loose frustum wastes resolution and bias-tunes
  poorly:

```javascript
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1; keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -4; keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;  keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.0005;  // kill shadow acne
```

For secondary objects (a row of background cabinets), bake a soft blob shadow into a transparent plane
texture instead of computing it. Players never notice a baked shadow on a background object.

## Compressed textures (KTX2 / Basis)

A raw 2048² PNG is ~16 MB in GPU memory; the same as KTX2/Basis is ~2–4 MB and uploads faster. Use the
compressed pipeline for every non-live texture:

```javascript
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
const tex = await ktx2.loadAsync('cabinet-albedo.ktx2');
```

(The live PixiJS hybrid texture from `hybrid-pixi-three.md` is the exception — it can't be precompressed
because it changes every frame. Keep that one small instead.)

## Geometry loading: DRACO + LOD

- Any imported GLTF model goes through `DRACOLoader` — typically 60–80% smaller download, decompressed
  on the GPU.
- For complex hero geometry, register 3 `THREE.LOD` levels so distant/idle cabinets drop to a low-poly
  proxy automatically:

```javascript
const lod = new THREE.LOD();
lod.addLevel(highMesh, 0);    // < 8 units
lod.addLevel(midMesh, 8);     // 8–20 units
lod.addLevel(lowMesh, 20);    // far
scene.add(lod);
```

## Bloom and post-FX cost

`UnrealBloomPass` runs a multi-pass gaussian blur at the bloom resolution. On mobile, halve its internal
resolution if you're frame-bound — the glow is soft anyway, so the resolution drop is invisible:

```javascript
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth/2, innerHeight/2), 1.0, 0.4, 0.85);
```

Keep the post chain to RenderPass → Bloom → OutputPass. Each extra full-screen pass is a full
read/write of the framebuffer — expensive on mobile bandwidth.

## WebGPU vs WebGL fallback

WebGPU (the `SKILL.md` default) is meaningfully faster on mobile where supported. The renderer falls
back to WebGL2 automatically, but test both — a shader that compiles in TSL→WGSL may behave subtly
differently in TSL→GLSL. Always `await renderer.init()` before the first frame.

## Profiling on-device, not in DevTools

Desktop DevTools lies about mobile performance. Verify on a real mid-range phone:

- Use `Stats.js` or `renderer.info` (`render.calls`, `render.triangles`) on-screen during dev.
- Watch `render.calls` live — if it creeps over 100 while playing, something stopped instancing.
- Test on a device that's been used for a year, not a flagship — thermal throttling is real and a
  flagship hides problems your players will hit.

## Triage order when you're dropping frames

1. Cap pixel ratio at 2 (if not already).
2. Count draw calls (`renderer.info.render.calls`) — instance/merge until under 100.
3. Cut shadow casters to 1, drop shadow map to 1024.
4. Halve bloom resolution.
5. Compress textures (KTX2), DRACO models.
6. Add LODs for anything not the hero subject.
