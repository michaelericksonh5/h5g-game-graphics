# Filter Performance (Mobile)

Filters and post-processing are where mobile slots die. Each PixiJS filter is a full-screen (or
full-object) render pass; stack a few naively and a mid-range Android drops to 30fps. This is the
budget and the techniques to stay at 60.

## The cost model

A filter on a display object:
1. Renders the object to a texture.
2. Runs the fragment shader per output pixel.
3. Composites back.

Cost scales with **filter area × number of passes × shader complexity**. A stage-wide filter is the
most expensive thing you can do; an object-local filter on a 100px symbol is cheap.

## Budget for a mid-range Android (60fps target)

| Effect | Budget |
|---|---|
| Stage-wide filters | **1**, ideally 0 (use a vignette baked into the background instead) |
| Object-local filters at once | ≤ 4–6 small objects |
| Multi-pass bloom (2D) | avoid; use additive single-pass glow (`custom-glsl-library.md`) |
| Displacement (full screen) | only during bonus, not base game |
| ColorMatrix (dim/win) | cheap — fine to apply per-symbol group |

If you want real bloom, do it in 3D with `UnrealBloomPass` on a small render target — see
`threejs-game-3d`. Don't emulate multi-pass bloom across the whole 2D stage on mobile.

## Techniques

**Bake static effects.** A vignette, scan lines on a static frame, or a grade that never animates
should be drawn into the background texture once at load, not run as a live filter every frame.

**Localize filters.** Put the glow on the winning symbols' container, not the stage:

```javascript
winContainer.filters = [glow];        // small area
// NOT: app.stage.filters = [glow];   // full screen every frame
```

**Set `filterArea`** to bound the work when you know the region:

```javascript
glowObject.filterArea = new Rectangle(x, y, w, h);
```

**Toggle, don't keep.** Remove filters when not needed (e.g., clear win glow on spin start) rather than
leaving them attached at zero strength — an attached filter still costs a pass.

```javascript
function clearWinFx(node){ node.filters = null; }
```

**Lower filter resolution** for soft effects where crispness doesn't matter:

```javascript
glow.resolution = 0.5;   // half-res pass, upscaled — big win for blurs/glows
```

**Cap DPR.** A 3× DPR screen running stage filters quadruples fragment work vs 1.5×. Cap renderer
resolution at 2–2.5 on phones (see `slot-hud-and-ui/references/mobile-layout-patterns.md`).

## Frame budget math

60fps = 16.6ms/frame. Reserve ~6–8ms for your own logic + PixiJS draw, leaving ~8ms for filters. A
single half-res stage glow can eat 4–6ms alone on a weak GPU — which is why the budget is "1 stage
filter, max".

## Measuring

```javascript
let last = performance.now(), acc = 0, frames = 0;
app.ticker.add(() => {
  const now = performance.now(); acc += now - last; last = now; frames++;
  if (acc >= 1000) { console.log('fps', frames); frames = 0; acc = 0; }
});
```

Profile **on the actual phone**, not desktop — desktop GPUs hide filter cost entirely. Test on a
mid-range Android (the project's stated target) before trusting any effect stack.

## Quality tiers

Detect capability and scale effects:

```javascript
const tier = navigator.hardwareConcurrency >= 8 ? 'high'
           : navigator.hardwareConcurrency >= 4 ? 'mid' : 'low';
const FX = {
  high: { glow:true, displacement:true, glowRes:1.0 },
  mid:  { glow:true, displacement:false, glowRes:0.5 },
  low:  { glow:false, displacement:false, glowRes:0.5 },
};
```

Degrade *effects* first; never degrade the reel feel or win clarity. A slot at 60fps with no glow
beats a glowing slot at 30fps.
