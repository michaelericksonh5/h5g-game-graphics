# Sculpted Relief Shading

The keystone technique that converts a flat procedural fill into a *sculpted, painted* surface: build a
height field, derive a surface normal from it, then light it (Blinn-Phong + rim + ambient occlusion) and
run the diffuse term through a painterly ramp. This is what makes premium slot symbols, panels, and
chassis read as physical objects hit by light instead of glossy vector shapes.

Pipeline at a glance:

```
height(uv)  ─►  normal = ∇h  ─►  Blinn-Phong (diff + spec)  ─►  + rim  ─►  × AO  ─►  ramp(diff)  ─►  RGBA
  fBm + Worley + silhouette        central differences         key light            crevices    form light
```

Two ways to run it:
- **Bake (Canvas2D / RenderTexture)** — compute once at load, reuse as a `Texture`/`CanvasTexture`. Best
  for static symbol/panel materials. Cheapest at runtime.
- **Live shader (GLSL)** — recompute per-frame for animated highlights, Fresnel that tracks view, or a
  moving key light. See `game-shaders-and-effects/references/custom-glsl-library.md`. Reserve for hero
  symbols and special states; bake everything else.

## 1. Build the height field

Height is just a grayscale function `h(x,y) → 0..1`. Combine three sources:

- **Form** — the symbol's silhouette as a signed-distance bump (raised center, falling to the edge) so
  the whole shape reads as domed/beveled, not flat.
- **Material grain** — fBm (marble/gold), Worley/cellular (gem facets, hammered dents, stone cracks),
  stretched fBm (brushed metal), domain-warped fBm (lacquer/marble veins). See `noise-functions.md`.
- **Engraving** — optional carved motif: subtract a thin SDF of the icon path to cut it into the surface,
  or add it to emboss it proud.

```javascript
// Example: a domed gold medallion with hammered dents and an embossed rune.
function goldHeight(noise, worley, runeSDF) {
  return (x, y, w, h) => {
    const u = x / w - 0.5, v = y / h - 0.5;
    const dome = 1 - Math.min(1, (u*u + v*v) * 3.2);      // raised center
    const dent = 0.12 * (1 - worley(x * 0.04, y * 0.04)); // hammered cells
    const grain = 0.05 * noise(x * 0.12, y * 0.12);
    const rune = 0.18 * Math.max(0, runeSDF(x, y));       // proud engraving
    return Math.max(0, dome * 0.7 + dent + grain + rune);
  };
}
```

## 2. Normal from the height field

Central differences. `strength` controls how "deep" the relief reads (2–4 typical). In a shader use
`dFdx`/`dFdy` or sample the baked heightmap at `±texel`.

```javascript
function normalAt(heightAt, x, y, strength = 3) {
  const dx = heightAt(x + 1, y) - heightAt(x - 1, y);
  const dy = heightAt(x, y + 1) - heightAt(x, y - 1);
  let nx = -dx * strength, ny = -dy * strength, nz = 1;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}
```

## 3. Light it: Blinn-Phong + rim + AO + ramp

```javascript
function shadeTexel(n, albedo, ramp, p) {
  const L = p.light, V = [0, 0, 1];                 // view straight on for 2D
  const diff = Math.max(n[0]*L[0] + n[1]*L[1] + n[2]*L[2], 0);
  // half-vector specular
  let hx = L[0]+V[0], hy = L[1]+V[1], hz = L[2]+V[2];
  const hl = Math.hypot(hx, hy, hz); hx/=hl; hy/=hl; hz/=hl;
  const spec = p.specStr * Math.pow(Math.max(n[0]*hx + n[1]*hy + n[2]*hz, 0), p.shine);
  const rim  = p.rimStr * Math.pow(1 - n[2], p.rimPow);   // grazing edges glow
  const ao   = p.ao;                                       // 0..1 from height/Worley
  const lit  = ramp(Math.min(1, p.ambient + diff)) ;       // painterly form light
  return [
    Math.min(lit[0]*ao + spec*255 + rim*p.rimColor[0], 255),
    Math.min(lit[1]*ao + spec*255 + rim*p.rimColor[1], 255),
    Math.min(lit[2]*ao + spec*255 + rim*p.rimColor[2], 255),
  ];
}
```

`ramp` is a 256-px form-light LUT (see SKILL.md `makeFormRamp`): a 4–6 stop gradient sampled by the lit
value, with saturation peaking at the terminator and a warm→cool temperature shift. Driving diffuse
through the ramp is what makes it look *painted* rather than plastic.

**Rim light is the highest-value single addition.** A cool (or theme-accent) rim on the grazing edges
separates the symbol from the reel and is the cheapest "expensive" signal there is.

## 4. Per-material parameter table

Tune the same pipeline by swapping the height source, albedo ramp, and these params:

| Material | Height source | Albedo ramp (shadow→term→light) | shine | specStr | rim | Notes |
|---|---|---|---|---|---|---|
| Gold leaf | domain-warped fBm + dome | `#3a2708`→`#b9831f`→`#fff3b0` | 90 | 0.9 | warm `#fff0b0` | sparse Worley seam lines darkened |
| Polished gem | generalized Worley facets | hue→bright center | 200 | 1.0 | Fresnel `#bfe0ff` | per-facet flat normal + color jitter; high pow rim |
| Hammered metal | Worley F1 dents | cool gray ramp | 48 | 0.7 | `#cdd6e6` | darken cell borders for AO |
| Brushed metal | stretched fBm (`uv*[2,60]`) | cool gray ramp | 64 | 0.6 | along brush axis | anisotropic: spec from tangent-bent half-vector |
| Lacquer | smooth + domain-warp subsurface | deep saturated → gloss | 200 | 1.0 | strong Fresnel | second narrow clearcoat spec lobe |
| Carved stone | Worley cracks + fBm mottle | desaturated ramp | 8 | 0.15 | faint | strong AO in crevices, near-zero spec |
| Jade/obsidian (royals) | dome + subtle fBm | translucent green/black ramp | 120 | 0.8 | `#d8ffe8` | wrapped diffuse `(NdotL+0.5)/1.5` for subsurface |

## 5. AO sources

- From height: `ao = smoothstep(loMid, hiMid, h)` — low areas (crevices) darken.
- From Worley: `ao = 1 - (F2 - F1)` — cell borders/cracks darken.
Multiply AO into ambient + diffuse only (never into spec/rim, or edges go muddy).

## 6. Bake + cache

- Bake each `(material, size, seed)` once to an `OffscreenCanvas` → `Texture.from(canvas)` (PixiJS) or
  `CanvasTexture` (Three.js). Share one baked material across every symbol that uses it.
- Power-of-two sizes, mipmaps on, tileable noise for panels/backgrounds.
- Keep live GLSL only for animated highlight sweeps, view-tracking Fresnel, and the special-symbol fire.

## 7. Mobile budget

- Bake at the **display size × devicePixelRatio (capped at 2)** — baking 512² for a 70px symbol wastes
  memory and fill rate.
- Relief baking is a per-pixel loop: do it during the loading screen, never mid-spin.
- If many symbols share a material, bake the material tile once and composite the shaped mask + icon over
  it, rather than re-shading per symbol.
