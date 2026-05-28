# Icon Library

A catalogue of procedurally-drawn glyphs for slot symbols — the thematic mark that sits on top of the
shaped, gradient-filled background described in `SKILL.md`. All drawn with PixiJS v8 `Graphics`, no
external images, readable at 70px mobile scale. Tint per theme via `slot-art-style-presets` tokens.

## Layering recap

A symbol = background shape → gradient fill → gem facets/gloss → **glyph (this file)** → rim stroke.
The glyph is monochrome-ish and high-contrast so it reads against the gradient.

## Royals (low-pay): A K Q J 10

Don't draw letters with a font and stop — give them a beveled, gem-like treatment so they don't look
like placeholder text.

```javascript
function drawRoyal(g, char, size, theme) {
  const t = new Text({ text: char, style: {
    fontFamily: 'Georgia, serif', fontSize: size*0.6, fontWeight: '900',
    fill: { fill: makeVerticalGradient(theme.royalGradient ?? ['#fff','#cfd6e6'], size*0.6) },
    stroke: { color: theme.royalStroke ?? 0x33405e, width: size*0.04 },
    dropShadow: { color: 0x000000, blur: 2, distance: 2, alpha: 0.4 },
  }});
  t.anchor.set(0.5);
  return t;   // place centered on the shaped background
}
```

Royals share one gradient per theme so they read as a set.

## Premium glyph primitives

Each high-pay symbol is a small vector scene. Keep them to silhouettes + 2–3 highlights so they stay
crisp at 70px. Examples (draw with `Graphics` paths):

| Glyph | Construction sketch |
|---|---|
| Gem/diamond | two mirrored trapezoids + facet lines + a white gloss triangle |
| Crown | base bar + 3–5 points + circle jewels; gold gradient |
| Coin/medallion | circle + inner ring + embossed motif + gloss ellipse |
| Star | 5-point path; bright center radial |
| Bell | rounded trapezoid body + clapper dot + top loop |
| Skull (dark) | cranium arc + eye sockets + jaw teeth |
| Mask (Egyptian) | nemes headdress trapezoid + face oval + stripes |
| Lotus/fan (Asian) | overlapping petals from a base point |
| Shell/fish (underwater) | spiral or teardrop + fin curves |

```javascript
function drawStar(g, cx, cy, r, color) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI/2 + i * Math.PI/5;
    const rad = i % 2 ? r*0.45 : r;
    pts.push(cx + Math.cos(ang)*rad, cy + Math.sin(ang)*rad);
  }
  g.poly(pts).fill({ color });
  g.poly(pts).stroke({ width: r*0.06, color: 0xffffff, alpha: 0.5 });
}
```

## Special symbols

- **WILD**: the boldest glyph + the word "WILD" on a ribbon; brightest gradient; gets the
  expand/glow treatment (see `symbol-animation-states.md`).
- **SCATTER**: a distinct shape (often a sun, star, or themed icon) + "SCATTER" tag; must read at a
  glance because it pays anywhere.
- **BONUS**: a chest/portal/wheel motif + "BONUS"; visually promises a feature.

Make these three obviously *different in silhouette* from the pays — players must distinguish them
peripherally during a fast spin.

## Background shapes by tier

(From `SKILL.md`, repeated for the glyph-fit:)

| Tier | Shape | Glyph fit |
|---|---|---|
| Low (royals) | rounded square / octagon | centered letter |
| Mid | hexagon | single icon |
| High (premium) | shield / ornate frame | detailed icon + small highlights |
| Special | unique badge | icon + label ribbon |

## Readability checklist (70px)

- [ ] Silhouette distinct from neighbours at thumbnail size.
- [ ] Glyph contrast ≥ background (light glyph on dark gradient or vice-versa).
- [ ] No detail thinner than ~2px at 70px.
- [ ] Wild/Scatter/Bonus distinguishable by shape alone, not just color (color-blind safe).
- [ ] Renders identically across themes by swapping palette tokens only.

## Theming

Never hardcode colors in the glyph functions — take a `theme` and pull `royalGradient`,
`premiumGradient`, `accent`, `rimStroke` from the `slot-art-style-presets` block so one symbol set
restyles instantly across genres.
