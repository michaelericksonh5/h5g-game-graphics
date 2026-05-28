# Gradient Recipe Library

Solid colors look like a wireframe. Real surfaces have light hitting them from somewhere, which produces a gradient. Every panel, button, frame, and symbol background in a polished slot uses a multi-stop gradient. This file is the recipe book.

## How to use a gradient in PixiJS v8

```javascript
import { FillGradient } from 'pixi.js';

const g = new FillGradient(0, 0, 0, height); // vertical, top-to-bottom
g.addColorStop(0, '#fff5d6');   // top highlight
g.addColorStop(0.5, '#f5c842'); // mid color
g.addColorStop(1, '#9c6a1a');   // bottom shadow

graphics.roundRect(x, y, w, h, r);
graphics.fill({ fill: g });
```

Constructor signature: `new FillGradient(x0, y0, x1, y1)`. The line from (x0,y0) to (x1,y1) defines the gradient axis. Vertical gradients (top to bottom) read most naturally as "lit from above" — use them by default. Diagonal gradients suggest specular highlight angles. Horizontal gradients work for chrome cylinders or holographic strips.

For radial-ish effects in v8, set a diagonal axis with multiple stops:
```javascript
new FillGradient(w * 0.3, h * 0.2, w * 0.7, h * 0.8)
```

## Metallic recipes

These all use 4-5 stops to fake the way light bounces off a curved metal surface. The signature pattern is: dark base, bright highlight near the top, mid color, deeper mid, dark base again at the bottom.

**Polished gold** — bright, warm, premium-feeling. Default for "big win" UI, jackpot frames, special symbols.
```
0.0: #fff5d6   (bright cream highlight)
0.3: #ffea66   (saturated gold)
0.5: #f5c842   (deep gold)
0.7: #c48a1a   (shadow gold)
1.0: #6e4a0a   (dark shadow)
```

**Brushed steel** — cool, industrial, restrained. Default for chassis frames, secondary UI.
```
0.0: #f0f3f8
0.4: #b8c0cc
0.5: #8a93a1
0.6: #b8c0cc
1.0: #5a6373
```
The doubled mid-tone with light on either side mimics the brushed-metal grain. For real grain, overlay a low-opacity noise pattern.

**Rose gold** — softer luxury vibe.
```
0.0: #ffe4d6
0.4: #f5a78a
0.6: #c97a5e
1.0: #6e3a2a
```

**Chrome** — extreme highlight contrast, almost reflective.
```
0.0: #ffffff
0.2: #e0e7f0
0.4: #5a6373
0.5: #2a3340
0.6: #5a6373
0.8: #e0e7f0
1.0: #ffffff
```
Chrome reverses near the bottom — the doubled bright-dark-bright pattern fakes a reflection of the sky and ground.

**Antique bronze** — for mythological / ancient civilization themes.
```
0.0: #e8c690
0.4: #a87838
0.6: #6e4818
1.0: #2a1808
```

## Neon recipes

Neon doesn't look right as a pure color. It needs an inner-bright-to-outer-dim falloff plus an additive-blend glow layer underneath (see `assets/premium-reel-template.html` for the glow pattern).

**Electric purple** — vibrant, modern.
```
0.0: #fff
0.15: #e8c4ff
0.5: #ac1eff
1.0: #4a0d6e
```

**Plasma green** — sci-fi, hazard, money.
```
0.0: #ffffff
0.15: #c4ffd6
0.5: #00ff66
1.0: #006e2a
```

**Hot pink** — playful, retro arcade.
```
0.0: #fff
0.15: #ffd6f0
0.5: #ff2bd6
1.0: #6e0d52
```

**Cyan ice** — cold, digital, tech.
```
0.0: #fff
0.15: #d6f7ff
0.5: #2bb0fb
1.0: #0d3a6e
```

## Gemstone recipes

For symbols that should look like cut gems, use diagonal axes and pair with a faceted shape (hexagon, octagon, or custom poly).

**Ruby**
```
0.0: #ffd6d6
0.3: #ff4d6d
0.6: #b81e3a
1.0: #4a0d18
```

**Sapphire**
```
0.0: #d6e6ff
0.3: #3b8eea
0.6: #1e4ab8
1.0: #0d1e4a
```

**Emerald**
```
0.0: #d6ffd9
0.3: #42d65a
0.6: #1ea83a
1.0: #0d3a1a
```

**Amethyst**
```
0.0: #e8d6ff
0.3: #ac1eff
0.6: #6e1eb8
1.0: #2a0d4a
```

**Topaz / amber**
```
0.0: #ffe2d1
0.3: #ff8a3b
0.6: #c95e1e
1.0: #4a1e0d
```

## Surface recipes

**Velvet / cloth** — soft, diffuse, no sharp highlights. Casino table felt.
```
0.0: #2a5e3a
0.3: #1a4a2a
0.7: #0d3a1e
1.0: #062a14
```
For richer velvet, layer a low-opacity noise texture over it (see `procedural-textures-and-materials`).

**Wood / leather** — warm, textured.
```
0.0: #6e3a18
0.4: #4a2a0e
0.7: #2e1a08
1.0: #1a0d04
```

**Stone / marble** — luxurious, ancient.
```
0.0: #f0eae0
0.3: #d4c8b0
0.6: #b8a890
1.0: #6e5e48
```

**Sandstone** — Egyptian theme staple.
```
0.0: #f5e6c4
0.3: #e8c690
0.7: #b89868
1.0: #6e4a28
```

**Holographic** — iridescent, shifting hue. Use this with a gradient axis ROTATING over time for an animated effect.
```
0.0: #ff2bd6
0.25: #ac1eff
0.5: #2bb0fb
0.75: #00ff66
1.0: #ffea66
```

## Glass recipes

Glass needs a very specific stop pattern: a sharp highlight at the top, transparency in the middle, and a slight bottom highlight (the light passing through and bouncing).

**Clear glass** (low alpha throughout)
```
0.0: rgba(255,255,255,0.6)
0.3: rgba(255,255,255,0.1)
0.7: rgba(255,255,255,0.05)
1.0: rgba(255,255,255,0.3)
```
Use with a stroked rim for the edge to be visible.

**Tinted glass** (tinted underneath a clear highlight)
```
0.0: rgba(255,255,255,0.7)
0.3: rgba(43,176,251,0.2)
0.7: rgba(43,176,251,0.3)
1.0: rgba(255,255,255,0.4)
```

## Composition rules

When stacking gradients on top of each other (which you should — the premium template does this for symbols: background + inner highlight + label, each with their own fill), respect the implied light source. If the chassis is lit from above, every symbol should also be lit from above. Mixing light directions reads as cheap.

When in doubt, your light source is at the top. Highlight stops near 0, shadow stops near 1.

## Anti-patterns

- Two-stop gradients usually look cheap. Three or more stops produce the depth.
- Don't use gradients with stops that are too close in luminance — the result looks like a flat color anyway. Aim for at least 40% luminance difference between brightest and darkest stops.
- Don't put pure black (#000) at the bottom of every gradient. Pure black creates a "dead zone" that no light can come from. Use a very dark version of the dominant hue instead (e.g. #1a0840 for purple, not #000000).
