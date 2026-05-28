---
name: slot-backgrounds-and-frames
description: "Build the painted world AROUND the reels for a slot game — the multi-layer scene background (sky, atmospheric depth, midground, foreground) and the reel frame / bezel / chassis as a material-shaded ornate object, all in PixiJS v8 with zero external art. Use whenever a slot needs a background scene, environment, backdrop, reel frame, bezel, cabinet, chassis, or a distinct bonus-mode stage. Triggers on \"slot background\", \"reel frame\", \"bezel\", \"chassis\", \"cabinet\", \"game background\", \"backdrop\", \"scene\", \"environment behind the reels\", or \"make the bonus look different\". This skill owns the CONSTRUCTION technique; slot-art-style-presets owns the per-genre direction (what to draw), and slot-hud-and-ui owns the UI shell on top. Mobile-first, baked once for performance."
---

# Slot Backgrounds and Frames

The reels do not float in a void. A premium slot has a **painted scene behind** them and an
**ornate frame around** them, both lit by the same rig as the symbols. This skill owns how to
*construct* those two asset classes procedurally. `slot-art-style-presets` tells you *what* to
draw per genre (the 3-layer parallax description, the chassis shape); this skill is *how*.

## The "preschool" failure mode for backgrounds and frames

The default amateur background is a single flat color (or one 2-stop gradient) behind the reels,
and the default amateur "frame" is a `roundRect().stroke()` — a colored rectangle outline. Both
scream "a computer made this." A real slot background has **depth built from separated layers**
(sky → atmosphere → midground → foreground) with a warm/cool temperature shift and a vignette
that pushes focus onto the reels. A real frame is a **dimensional, material-shaded object** —
beveled, with corner ornaments, casting an inner shadow onto the reel area so the reels read as
*recessed into* a cabinet. The difference is layering and a relief pass, not more colors.

## Two things this skill builds

1. **The scene background** — a multi-layer parallax environment behind the reel viewport.
2. **The reel frame / bezel / chassis** — the dimensional border the reels sit inside, plus its
   distinct **bonus-mode** variant for state differentiation.

Both must share the symbols' light rig (warm key upper-left, cool fill lower-right, soft rim) so
the whole screen reads as one crafted world. See `procedural-textures-and-materials/references/sculpted-relief-shading.md`.

## Background: build depth from separated layers

Each depth is its own `Container`, painted back-to-front. Far layers are cooler, lower-contrast,
and desaturated (atmospheric perspective); near layers are warmer and higher-contrast.

```javascript
function buildSceneBackground(app, theme) {
  const { width: W, height: H } = app.screen;
  const scene = new Container();

  // 1. SKY — vertical gradient, the coolest/most distant layer.
  const sky = new Graphics();
  sky.rect(0, 0, W, H).fill(makeVerticalGradient(theme.skyTop, theme.skyBottom, H));
  scene.addChild(sky);

  // 2. ATMOSPHERE — a soft horizontal band of haze/glow at the horizon line; sells depth.
  const haze = new Graphics();
  haze.rect(0, H * 0.45, W, H * 0.25).fill({ color: theme.hazeColor, alpha: 0.35 });
  haze.filters = [new BlurFilter({ strength: 40, quality: 2 })];
  scene.addChild(haze);

  // 3. MIDGROUND — themed silhouettes (temple pillars, city skyline, coral). Lower contrast,
  //    slightly desaturated. Drawn as filled shapes, NOT outlined.
  const mid = drawMidgroundSilhouettes(theme); // returns a Container of Graphics
  scene.addChild(mid);

  // 4. FOREGROUND — near elements that frame the edges (candles, vines, lanterns). Warmest,
  //    highest contrast. These can hold the theme's signature WARM accent.
  const fg = drawForegroundProps(theme);
  scene.addChild(fg);

  // 5. VIGNETTE — darken the corners so the eye lands on the (centered) reels.
  const vignette = new Graphics();
  vignette.rect(0, 0, W, H).fill(makeRadialVignette(W, H, 0.0, 0.55)); // transparent center → dark edge
  scene.addChild(vignette);

  scene.layers = { sky, haze, mid, fg }; // keep refs for parallax
  return scene;
}
```

### Parallax (subtle — this is a slot, not a platformer)

Drift each layer a few pixels against device tilt or a slow idle sine, far layers least. The
parallax MATH (per-layer scroll factors, wrap) is the same as the side-scroller's — reuse
`sidescroller-camera-and-parallax/references/parallax-backgrounds.md`. Keep amplitude tiny (2–8px
for far, up to ~16px near) so it reads as life, not motion sickness.

```javascript
function updateParallax(scene, dt, t) {
  const drift = Math.sin(t * 0.0003) * 6;       // slow idle sway
  scene.layers.mid.x = drift * 0.4;
  scene.layers.fg.x  = drift * 1.0;
}
```

### Atmosphere extras (optional, when requested)

- **God-rays / light shafts** from the key-light corner — `game-shaders-and-effects` (additive
  blurred wedges, or a shader). Sells "candlelit celebration" or "underwater caustics."
- **Dust motes / embers / bubbles** drifting slowly — `particle-systems-and-juice` (a low-rate
  emitter, additive, parallaxed with the near layer).

## Reel frame / bezel: a built object, not a stroke

The frame is constructed in layers, then run through the sculpted-relief pass so it reads as
carved stone / cast gold / brushed metal. The order, outermost to reel:

```javascript
function buildReelFrame(reelRect, theme) {
  const frame = new Container();
  const { x, y, w, h } = reelRect;
  const t = theme.frameThickness ?? 28;

  // 1. CHASSIS — the outer cabinet plate the frame is mounted on (gradient body).
  const chassis = new Graphics();
  chassis.roundRect(x - t * 1.6, y - t * 1.6, w + t * 3.2, h + t * 3.2, t)
         .fill(makeVerticalGradient(theme.chassisOuter, theme.chassisInner, h));
  frame.addChild(chassis);

  // 2. FRAME BAND — the beveled border. Fill with the frame material, then run the relief pass
  //    (height field → normal → Blinn + rim + AO) so it looks dimensional, not flat.
  const band = new Graphics();
  band.roundRect(x - t, y - t, w + t * 2, h + t * 2, t * 0.8)
      .fill(theme.frameFill ?? 0xC4952B);
  applySculptedRelief(band, { material: theme.frameMaterial ?? 'gold-leaf', light: theme.lightRig });
  frame.addChild(band);

  // 3. INNER SHADOW — the single most important layer. A dark, soft band just inside the
  //    aperture makes the reels read as RECESSED into the cabinet.
  const innerShadow = new Graphics();
  innerShadow.roundRect(x, y, w, h, t * 0.5).stroke({ width: t * 0.6, color: 0x000000, alpha: 0.55 });
  innerShadow.filters = [new BlurFilter({ strength: 10, quality: 2 })];
  frame.addChild(innerShadow);

  // 4. CORNER ORNAMENTS — themed motifs (skulls, scarabs, dragons, gems) at the corners.
  //    Drawn with procedural-symbol-design techniques and lit by the same rig. Subject to
  //    theme-element exclusivity: do NOT reuse a paying symbol's motif here.
  for (const corner of cornerPositions(reelRect, t)) {
    frame.addChild(drawCornerOrnament(corner, theme));
  }

  // 5. FRAME GLOW — a soft outer glow in the theme accent, so the cabinet separates from the bg.
  const glow = makeGlowLayer(w + t * 4, h + t * 4, theme.frameGlow, 0.5, 24);
  frame.addChildAt(glow, 0);

  return frame;
}
```

Key points:
- **No bare stroke as a frame.** The frame is a filled, material-shaded band with an inner shadow.
- **The inner shadow is non-negotiable** — it's what makes the reels look set *into* a machine.
- **Corner ornaments** carry the theme but obey **theme-element exclusivity** (`slot-art-style-presets`):
  a corner skull is fine only if the skull is NOT a paying symbol; otherwise pick a non-symbol motif.

## Bonus mode = a visibly different stage

State differentiation is a quality signal: the player should *feel* they entered a special mode.
Build a second scene + frame variant, don't just tint:
- **Darker, moodier background** (drop the sky value, deepen the vignette).
- **Different frame treatment** — e.g. base = ornate gold; bonus = dark blue-steel "locked vault"
  with chain details (reinforces a locked-accumulator mechanic, per real H5G bonus bezels).
- Optionally swap the foreground props and dim the midground so symbols/coins pop harder.

## Mobile-first construction rules

- **Bake static layers once.** Sky + atmosphere + midground rarely change — render them to a
  single `RenderTexture` at startup and display one Sprite. Only keep truly animated layers
  (parallax foreground, particles) live. This collapses many Graphics into one draw call.
- **Cap bake resolution** at display size × `devicePixelRatio`, DPR clamped to 2. Don't bake a
  4K background for a phone.
- **Never blur per-frame.** The haze/inner-shadow/glow blurs run once at bake time, not in the
  ticker.
- **Frame is static** — bake it too (unless its glow pulses; then keep only the glow live).
- **Draw-call budget:** background + frame together should cost a handful of draws, not dozens.
  See `game-qa-and-testing/references/performance-checklist.md`.

## How this fits the suite

- **Direction (what to draw per genre)** → `slot-art-style-presets` (sky/mid/near description,
  chassis shape, `frameStroke`/`frameGlow`/`chassisOuter` theme tokens).
- **Material/relief on the frame** → `procedural-textures-and-materials/references/sculpted-relief-shading.md`.
- **Parallax math** → `sidescroller-camera-and-parallax/references/parallax-backgrounds.md`.
- **God-rays / depth FX** → `game-shaders-and-effects`. **Dust/embers/bubbles** → `particle-systems-and-juice`.
- **Layout regions the frame must respect** → `slot-hud-and-ui` (the reel-area rect comes from there).
- **3D backgrounds** (a true 3D environment behind 2D reels) → `threejs-game-3d/references/hybrid-pixi-three.md`.

## References

- `references/background-scene-construction.md` — full multi-layer scene recipe: gradient sky, atmospheric haze band, midground silhouette construction, foreground props, vignette, parallax wiring, god-rays/motes, and the bake-once pipeline
- `references/reel-frame-construction.md` — frame/bezel geometry, the layer stack (chassis → relief band → inner shadow → ornaments → glow), corner-ornament construction, the bonus "locked vault" variant, and material-relief integration
