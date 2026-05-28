# Symbol Animation States (bridge)

This file is the seam between a *drawn* symbol (this skill — `procedural-symbol-design`) and an
*animated* symbol (the `slot-symbol-animation-states` skill, which owns the full state machine,
timing tables, and Spine integration). Read this to learn what hooks a procedurally-drawn symbol
must expose so the animation skill can drive it. Read `slot-symbol-animation-states` for the
animation logic itself.

## The five states every slot symbol has

| State | When | What moves |
|---|---|---|
| `idle` | sitting on a stopped reel, no win | nothing (or a very slow ambient drift) |
| `blur` | reel spinning past | vertical motion-blur variant, see `pixijs-slot-graphics/reel-mechanics.md` |
| `land` | reel settle bounce | scale/`back.out` pop synced to the reel overshoot |
| `win` | symbol part of a winning line | the headline animation — pulse, glow, glyph flourish |
| `anticipation` | symbol is a scatter/bonus during last-reel hold | rim-light pulse + slow scale breathe |

The drawing skill's job is not to animate — it is to **build the symbol as addressable parts** so the
animation skill can tween them without re-drawing.

## What a drawn symbol must expose

A symbol built per `SKILL.md` is a `Container`. Give the animation layer handles by naming the parts
and never baking transforms into the geometry:

```javascript
function buildSymbol(key, size, theme) {
  const c = new Container();
  c.label = key;                       // 'WILD', 'A', 'premium_gem', ...

  const bg    = drawBackground(key, size, theme);   bg.label = 'bg';
  const glyph = drawGlyph(key, size, theme);        glyph.label = 'glyph';
  const gloss = drawGloss(size);                    gloss.label = 'gloss';
  const rim   = drawRim(size, theme);               rim.label = 'rim';

  c.addChild(bg, glyph, gloss, rim);

  // Pivot at center so scale/rotate tweens look right.
  c.pivot.set(0, 0);                   // children drawn centered on origin
  return c;
}
```

Rules that keep the symbol animatable:

- **Draw centered on the origin** (not from a top-left corner). A win-pulse scales from the center;
  if the art is drawn at `(0,0)→(size,size)` it grows toward the bottom-right instead.
- **Keep `glyph` and `rim` as separate children.** The win state often pulses the glyph while holding
  the background still, or flashes the rim independently.
- **Never pre-multiply alpha into the fill.** The animation layer fades `c.alpha`; baked-in alpha
  fights it.
- **Expose a `glow` slot.** Leave room for the animation skill to drop a `BlurFilter`/bloom sprite
  behind the glyph on `win` — don't draw a static glow that's always on.

## Wild and Scatter get extra parts

Wild and Scatter carry the showiest animations (expand, shimmer, swell). Give them the parts those
need:

```javascript
if (key === 'WILD') {
  const ribbon = drawRibbon('WILD', size, theme); ribbon.label = 'ribbon';
  const shimmer = drawShimmerMask(size);          shimmer.label = 'shimmer'; // animated sweep
  c.addChild(ribbon, shimmer);
}
```

The `shimmer` part is a masked highlight the animation skill sweeps across on `win`/`land`. You draw
it; they move it. See `slot-symbol-animation-states/references/animation-timing-table.md` for the
sweep duration and easing.

## Theming stays in the draw layer

State animations are theme-agnostic — a win pulse is a win pulse in Egypt or in space. Colors come
from `slot-art-style-presets` tokens at *draw* time (see `symbol-gradients.md` and `icon-library.md`).
The animation skill never touches palette; it only tweens transform/alpha/filter. This split means one
symbol set restyles across genres without re-authoring a single animation.

## Handoff checklist

- [ ] Symbol is a `Container` with labeled children (`bg`, `glyph`, `gloss`, `rim`, + specials).
- [ ] Drawn centered on origin; pivot at center.
- [ ] No baked alpha, no always-on glow, no baked transforms.
- [ ] Wild/Scatter expose `ribbon`/`shimmer`/`swell` parts.
- [ ] Palette pulled from tokens, not hardcoded.
- [ ] Hand the built `Container` to `slot-symbol-animation-states` — it owns the rest.
