# Geometry Patterns: Cabinets, Trim, and Procedural Detail

The single fastest "tell" that a 3D scene was thrown together is a raw `BoxGeometry` with sharp 90°
edges. Real product never has a perfectly sharp edge — injection-molded plastic, milled metal, and cast
trim all carry a fillet that catches a highlight. This file is the geometry vocabulary that makes a
casino cabinet read as a manufactured object instead of a CAD primitive. Materials/lighting live in
`SKILL.md` and `lighting-presets.md`; this is shape only.

## Rule 1: round every structural edge

```javascript
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// width, height, depth, segments, radius
const body = new RoundedBoxGeometry(2.4, 3.2, 1.0, 6, 0.06);
```

`radius` of 0.04–0.08 on a ~2-unit body is the sweet spot: visible fillet, not a pillow. `segments`
of 4–6 is plenty — the fillet only needs to catch a highlight, not be perfectly smooth. A sharp box
costs the same draw call and looks ten times cheaper, so there is no reason to use a plain `BoxGeometry`
for anything the player sees.

## Rule 2: trim is turned, not boxed

Frame rings, pillars, knobs, and trophy shapes are *lathed* profiles — a 2D silhouette spun around an
axis. `LatheGeometry` does this from a points array:

```javascript
function turnedPillar(height = 2.0, r = 0.18) {
  const pts = [];
  // profile read bottom→top: base flare, shaft, top bead
  pts.push(new THREE.Vector2(r * 1.4, 0));
  pts.push(new THREE.Vector2(r * 1.4, 0.08));
  pts.push(new THREE.Vector2(r,        0.18));
  pts.push(new THREE.Vector2(r,        height - 0.18));
  pts.push(new THREE.Vector2(r * 1.3, height - 0.08));
  pts.push(new THREE.Vector2(r * 1.3, height));
  return new THREE.LatheGeometry(pts, 48); // 48 radial segments = smooth column
}
```

`TorusGeometry` is the other workhorse — frame rings and neon-tube halos. For a glowing halo, pair a
thin torus with the emissive material from the `SKILL.md` materials table and let bloom do the rest.

## Rule 3: badges and logos are extruded with a bevel

Flat text planted on a cabinet looks like a decal. Extrude it with a small bevel so it catches the key
light on its chamfer:

```javascript
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const geo = new TextGeometry('MEGA', {
  font, size: 0.4, depth: 0.08,
  bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3,
});
geo.center();
```

Same approach with `ExtrudeGeometry` for arbitrary logo paths (`THREE.Shape` from SVG-style commands).
The bevel is what sells "cast metal nameplate" over "floating text."

## Rule 4: greebles via InstancedMesh (one draw call)

Bolts, screws, rivets, vents, panel studs — mechanical detail is what makes a surface read as
manufactured. Hundreds of them must cost *one* draw call, so use `InstancedMesh`:

```javascript
function scatterBolts(count, surface /* THREE.Box3 face */) {
  const bolt = new THREE.CylinderGeometry(0.02, 0.025, 0.03, 8);
  const mat  = new THREE.MeshPhysicalMaterial({ metalness: 0.9, roughness: 0.35, color: 0x8a8a96 });
  const mesh = new THREE.InstancedMesh(bolt, mat, count);

  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x = THREE.MathUtils.lerp(surface.min.x, surface.max.x, Math.random());
    const y = THREE.MathUtils.lerp(surface.min.y, surface.max.y, Math.random());
    m.makeRotationX(Math.PI / 2);          // lay bolt flat against face
    m.setPosition(x, y, surface.max.z + 0.001);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
```

For *evenly spaced* rows of studs (a riveted frame edge), replace `Math.random()` with a grid loop —
random scatter reads as damage/texture, a grid reads as engineering. Pick per intent.

## Rule 5: reels and drums are cylinders, screens are slightly curved

- Reel drums: `CylinderGeometry(r, r, height, 64)` — 64 radial segments so the silhouette stays round
  at the edge.
- The glass screen in front of the reels: a `PlaneGeometry` with a *subtle* curve gives a CRT/arcade
  feel. Bend it by displacing vertices, or use a shallow `CylinderGeometry` segment (large radius,
  small arc). Keep the curve gentle — an aggressive curve distorts the PixiJS texture (see
  `hybrid-pixi-three.md`).

## Geometry budget per cabinet

| Element | Geometry | Approx tris | Notes |
|---|---|---|---|
| Body | RoundedBoxGeometry | ~600 | one per cabinet |
| Frame trim | TorusGeometry ×2–4 | ~400 ea | merge if static |
| Pillars | LatheGeometry ×2 | ~500 ea | |
| Bolts/greebles | InstancedMesh | ~200 total | one draw call |
| Reel drums | CylinderGeometry ×5 | ~250 ea | |
| Logo/badge | ExtrudeGeometry | ~800 | bevel adds tris |

Keep one cabinet under ~8k triangles and you have plenty of headroom on mobile (see
`mobile-optimization.md`). Merge static trim with `BufferGeometryUtils.mergeGeometries` to collapse
draw calls when the parts share a material.

## What not to do

- No raw `BoxGeometry` for visible surfaces (sharp edges = prototype).
- No per-bolt `Mesh` (use `InstancedMesh` — hundreds of draw calls will tank mobile).
- No flat text decals (extrude + bevel).
- Don't over-tessellate: a 256-segment cylinder for a 2cm knob is wasted tris. Match segment count to
  on-screen size.
