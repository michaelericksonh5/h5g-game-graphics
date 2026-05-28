# Background scene construction

The full recipe for a painted, layered slot background in PixiJS v8 — zero external art. The goal
is **depth you can feel**: a player should read distance from sky to foreground, with the reels
sitting in a focused pool of light. Build back-to-front, bake the static layers once.

## The depth stack (back to front)

| Layer | Role | Temperature / contrast | Animated? |
|---|---|---|---|
| Sky | Vertical gradient base | Coolest, lowest contrast | No (bake) |
| Atmosphere | Horizon haze / glow band | Soft, desaturated | No (bake) |
| Midground | Themed silhouettes (skyline, pillars, reef) | Cool-ish, medium, slightly desaturated | Tiny parallax |
| Foreground | Near framing props (candles, vines, lanterns) | Warmest, highest contrast | Parallax + maybe flicker |
| FX | God-rays, motes, embers, bubbles | Additive | Yes (live) |
| Vignette | Corner darkening to focus reels | — | No (bake) |

Atmospheric perspective rule: the farther the layer, the **cooler, lighter, lower-contrast, and
less saturated** it is. Reversing this (saturated distant mountains) is a classic amateur tell.

## 1. Sky — vertical gradient

```javascript
function makeVerticalGradient(topColor, bottomColor, h) {
  const g = new FillGradient(0, 0, 0, h);
  g.addColorStop(0, topColor);
  g.addColorStop(1, bottomColor);
  return g;
}
const sky = new Graphics().rect(0, 0, W, H).fill(makeVerticalGradient(theme.skyTop, theme.skyBottom, H));
```

Pick `skyTop` cooler/darker (night purple `#1A0A2E`) and `skyBottom` warmer (horizon amber
`#D4900A` at low alpha) so there's a temperature gradient, not a flat wash. A 3rd mid stop adds
a dusk band.

## 2. Atmosphere — horizon haze

A blurred, low-alpha band at the horizon (~`H*0.45`–`H*0.7`) glued behind the midground. This is
the cheapest depth cue available.

```javascript
const haze = new Graphics().rect(0, H * 0.45, W, H * 0.3).fill({ color: theme.hazeColor, alpha: 0.35 });
haze.filters = [new BlurFilter({ strength: 40, quality: 2 })]; // baked, not per-frame
```

## 3. Midground — themed silhouettes

Filled shapes, **no outlines**, slightly desaturated toward the haze color so they sit *in* the
atmosphere. Build them parametrically per theme:

```javascript
function drawMidgroundSilhouettes(theme) {
  const c = new Container();
  const g = new Graphics();
  // Example: a temple-pillar / skyline silhouette row along the horizon.
  let x = -20;
  while (x < W + 20) {
    const w = 40 + Math.random() * 60;
    const h = 120 + Math.random() * 180;
    g.rect(x, H * 0.62 - h, w, h);
    x += w + 12 + Math.random() * 30;
  }
  g.fill({ color: mix(theme.midColor, theme.hazeColor, 0.4), alpha: 0.9 });
  c.addChild(g);
  return c;
}
```

Swap the silhouette generator per genre: city skyline (cyberpunk), pillars (Egyptian), reef
fronds (underwater), pine/mountain (Norse). Keep it to **bold simple shapes** — detail is lost at
phone scale and behind the reels anyway.

## 4. Foreground — near framing props

Warm, high-contrast elements at the screen edges that frame the reel area (lower-left and
lower-right corners especially). Candles/luminarias, hanging lanterns, vines, draped banners.
These can hold the theme's signature warm accent and may flicker (animate alpha/scale subtly).
**Theme-element exclusivity:** never use a paying symbol's motif here.

## 5. Vignette — focus the reels

```javascript
function makeRadialVignette(W, H, innerAlpha, outerAlpha) {
  const g = new FillGradient(W / 2, H / 2, W / 2, H / 2, { type: 'radial', r0: 0, r1: Math.hypot(W, H) / 2 });
  g.addColorStop(0, `rgba(0,0,0,${innerAlpha})`);
  g.addColorStop(1, `rgba(0,0,0,${outerAlpha})`);
  return g;
}
const vignette = new Graphics().rect(0, 0, W, H).fill(makeRadialVignette(W, H, 0.0, 0.55));
```

Transparent center, dark edge. This is what makes the reels feel lit and central without touching
the reels themselves.

## Parallax wiring

Subtle only. Reuse the side-scroller parallax math
(`sidescroller-camera-and-parallax/references/parallax-backgrounds.md`); for a slot the camera
doesn't travel, so drive it from device tilt (`deviceorientation`) or a slow idle sine.

```javascript
function updateParallax(layers, t, tiltX = 0) {
  const sway = Math.sin(t * 0.0003) * 6 + tiltX * 10;
  layers.mid.x = sway * 0.4;   // far moves least
  layers.fg.x  = sway * 1.0;   // near moves most
}
```

Amplitude budget: far ≤ 6px, near ≤ 16px. More than that induces motion sickness on a handheld.

## FX layer (optional)

- **God-rays:** a few additive, blurred, semi-transparent wedges emanating from the key-light
  corner. Bake if static; animate alpha slowly if "living." Owned by `game-shaders-and-effects`.
- **Motes/embers/bubbles:** a low-rate additive particle emitter parallaxed with the foreground.
  Owned by `particle-systems-and-juice`. Keep counts tiny (≤ ~40 live) on mobile.

## Bake-once pipeline (mobile-critical)

```javascript
function bakeStaticBackground(app, scene) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rt = RenderTexture.create({ width: app.screen.width, height: app.screen.height, resolution: dpr });
  app.renderer.render({ container: scene.staticLayers, target: rt }); // sky+haze+mid(if not parallaxed)+vignette
  return new Sprite(rt);
}
```

- Bake sky + atmosphere + (non-parallaxed) midground + vignette into **one** Sprite → one draw call.
- Keep only parallax foreground + FX live.
- All blurs (haze, glow) execute once at bake time. **Never run a BlurFilter in the ticker.**
- Re-bake only on resize/orientation change, not per frame.

## Common failures

- **Flat single-color background.** No depth stack → instant "preschool." Always ≥ 3 layers.
- **Saturated distant layers.** Breaks atmospheric perspective. Desaturate toward the haze.
- **Outlined midground shapes.** Silhouettes are filled, never stroked.
- **Per-frame blur.** Murders mobile FPS. Bake it.
- **No vignette.** Reels feel unanchored; the scene competes with them for attention.
- **Symbol motif reused in the scene.** Dilutes symbol identity — see theme-element exclusivity.
