---
name: procedural-symbol-design
description: Design and generate slot machine symbols entirely in code — no external image files. Use this whenever the user needs slot symbols, game icons, or themed visual assets for a casino game and has no existing sprite sheets. Triggers on "slot symbols", "game icons", "symbol design", "reel symbols", "wild symbol", "scatter symbol", "bonus symbol", or any request to create visual assets for a slot or arcade game procedurally. Also use when the user says "no images available" or "generate everything in code" for casino visuals. Must be used alongside pixijs-slot-graphics when building a complete slot — the symbols produced here are what go onto the reels.
---

# Procedural Symbol Design

Generate every slot symbol in code using PixiJS v8 Graphics. No external PNGs. Symbols are layered compositions that read clearly at mobile scale and animate through five states.

## The "preschool" failure mode for symbols

Claude's default symbol is a colored rectangle with text on it. That's not a symbol — it's a label. A real slot symbol has: a shaped background (not a rectangle), a gradient fill calibrated to the symbol's tier value, an inner highlight that gives it gloss or dimension, an outer rim with a contrasting stroke, and a thematic glyph or icon at center. The difference between "placeholder" and "premium" is about 4 additional Graphics calls layered correctly.

## Symbol composition layers (mandatory, in order)

Every symbol is a `Container` with these children, bottom to top:

1. **Background glow** — large, blurred, additive blend. Makes the symbol feel lit from within. Hidden when dimmed.
2. **Background shape** — the symbol's body: octagon for gems, hexagon for special symbols, rounded square for letters, shield for divine/fantasy. Fill: gradient matching tier.
3. **Inner shadow** — a slightly smaller version of the same shape, near-black at low alpha, creating a recessed edge depth.
4. **Facet highlights** — for gem symbols: 2-3 small polygons at the top-left of the shape in near-white at low alpha, simulating light catching a cut surface.
5. **Surface highlight** — a tall thin ellipse near the top of the shape, white at 30-50% alpha. The "gloss" that makes it look shiny.
6. **Icon / glyph** — the symbol's identity at center. Unicode character, SVG-style path, or custom drawn shape.
7. **Value indicator** (optional for high-value) — a tiny badge showing "10x" or a crown for the highest-value symbol.
8. **Rim stroke** — the border that separates symbol from background. Not the default stroke on the shape — a separate, slightly smaller Graphics object with a contrasting color stroke. This is what makes symbols "pop" against any background color.

## Background shape vocabulary by tier

```javascript
function drawSymbolBackground(g, key, size, theme) {
  const half = size / 2;
  const fill = getGradientForSymbol(key, size, theme); // from gradient library

  if (['WILD', 'SCATTER', 'BONUS'].includes(key)) {
    // Hexagonal medallion for specials
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      pts.push(half + half * 0.88 * Math.cos(a), half + half * 0.88 * Math.sin(a));
    }
    g.poly(pts).fill({ fill }).poly(pts).stroke({ width: 3.5, color: 0xffffff, alpha: 0.85 });

  } else if (['A', 'ANKH', 'PHARAOH', 'DRAGON', 'ZEUS'].includes(key)) {
    // Shield/crest shape for high-value
    const shield = [
      half, half * 0.08,        // top center
      half * 1.85, half * 0.35, // top-right
      half * 1.85, half * 1.2,  // right
      half, half * 1.9,         // bottom point
      half * 0.15, half * 1.2,  // left
      half * 0.15, half * 0.35, // top-left
    ];
    g.poly(shield).fill({ fill }).poly(shield).stroke({ width: 3, color: 0xffffff, alpha: 0.75 });

  } else if (['K', 'Q', 'J', 'T'].includes(key)) {
    // Rounded rectangle for card letters (more legible at small size)
    const r = size * 0.16;
    g.roundRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, r)
     .fill({ fill })
     .roundRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, r)
     .stroke({ width: 2.5, color: 0xffffff, alpha: 0.65 });

  } else {
    // Octagonal gem for mid-value thematic icons
    const oct = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 8;
      oct.push(half + half * 0.85 * Math.cos(a), half + half * 0.85 * Math.sin(a));
    }
    g.poly(oct).fill({ fill }).poly(oct).stroke({ width: 3, color: 0xffffff, alpha: 0.7 });
  }
}
```

## Facet highlights (gem symbols)

What makes something look like a cut gem vs a colored shape:

```javascript
function addGemFacets(container, size) {
  const facets = new Graphics();
  const half = size / 2;

  // Top-left primary facet — largest, brightest
  facets.poly([
    half * 0.3, half * 0.2,
    half * 0.7, half * 0.2,
    half * 0.5, half * 0.5,
  ]).fill({ color: 0xffffff, alpha: 0.4 });

  // Upper-right secondary facet
  facets.poly([
    half * 1.0, half * 0.2,
    half * 1.6, half * 0.4,
    half * 1.1, half * 0.6,
  ]).fill({ color: 0xffffff, alpha: 0.2 });

  // Lower specular point
  facets.poly([
    half * 0.8, half * 1.3,
    half * 1.0, half * 1.6,
    half * 1.2, half * 1.3,
  ]).fill({ color: 0xffffff, alpha: 0.15 });

  container.addChild(facets);
}
```

## The gloss highlight

This single ellipse is responsible for 50% of the "shiny" perception:

```javascript
function addGlossHighlight(container, size) {
  const gloss = new Graphics();
  // Tall thin ellipse, top-center, steep white-to-transparent
  gloss.ellipse(size * 0.5, size * 0.25, size * 0.25, size * 0.13);
  gloss.fill({ color: 0xffffff, alpha: 0.55 });
  container.addChild(gloss);
}
```

## Background glow (additive blend)

```javascript
function addSymbolGlow(container, size, color) {
  const glow = new Graphics();
  glow.circle(size / 2, size / 2, size * 0.55);
  glow.fill({ color, alpha: 0.6 });
  glow.filters = [new BlurFilter({ strength: 18, quality: 3 })];
  glow.blendMode = 'add';
  container.addChildAt(glow, 0); // behind everything
}
```

## Symbol gradient mapping by tier

Load `references/symbol-gradients.md` for the full table. Quick reference:

| Tier | Examples | Gradient direction | Primary |
|---|---|---|---|
| Grand special | WILD, SCATTER, BONUS | Radial center-out | Saturated pure hue |
| Premium (4-5 symbol match) | ANKH, DRAGON, PHARAOH, A | Diagonal top-left | Deep-to-bright metallic |
| High (3+ match) | SCARAB, CROWN, K | Vertical top-to-bottom | Gem-style (dark edges, bright center) |
| Mid (any match) | EYE, COIN, Q | Vertical | Single hue gradient |
| Low (3+ match only) | J, T | Vertical | Muted, low-saturation |

## Thematic icon vocabulary by genre

Read `references/icon-library.md` for Unicode + SVG paths. Quick guide:

**Egyptian:** ☥ (Ankh), 𓂀 (Eye of Horus), 𓆣 (Scarab), △ (Pyramid), 𝔸 (styled A for low)
**Cyberpunk:** ⬡ (hex grid), ⧫ (diamond), ◈ (circuit), ▲ (triangle), ◉ (target)
**Asian Prosperity:** 福 (Fortune), 🐉 (Dragon glyph), ⭐ (Star), 🪙 (Coin path), ♦ (gem)
**Fantasy:** ⚔ (Sword), 🌙 (Moon), ⚡ (Lightning), 👑 (Crown path), 🔮 (Orb path)
**Vegas Classic:** 7 (Seven), ♠♥♦♣ (Card suits), 🔔 (Bell path), 🍒 (Cherry path), BAR

## Minimum size for mobile readability

At a 5-reel layout on a 390px-wide phone, each symbol cell is ~70px. At that size:
- Complex icons become unreadable — use bold simple glyphs only
- Letter symbols (A K Q J) remain readable because they're familiar shapes
- Rim stroke should be minimum 2px, preferably 2.5-3px
- Icon should occupy 50-60% of the symbol area (not edge-to-edge)

Test every symbol at 70×70 CSS pixels before finalizing.

## References

- `references/symbol-gradients.md` — complete gradient mapping per tier and genre
- `references/icon-library.md` — Unicode characters, SVG path data for thematic icons, programmatic icon drawing recipes
- `references/symbol-animation-states.md` — the five animation states (idle breathing, landing bounce, win highlight, dimmed, special) — link to `slot-symbol-animation-states` skill
