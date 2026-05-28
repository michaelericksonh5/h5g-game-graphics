---
name: procedural-symbol-design
description: Design and generate slot machine symbols entirely in code — no external image files. Use this whenever the user needs slot symbols, game icons, or themed visual assets for a casino game and has no existing sprite sheets. Triggers on "slot symbols", "game icons", "symbol design", "reel symbols", "wild symbol", "scatter symbol", "bonus symbol", or any request to create visual assets for a slot or arcade game procedurally. Also use when the user says "no images available" or "generate everything in code" for casino visuals. Must be used alongside pixijs-slot-graphics when building a complete slot — the symbols produced here are what go onto the reels.
---

# Procedural Symbol Design

Generate every slot symbol in code using PixiJS v8 Graphics. No external PNGs. Symbols are layered compositions that read clearly at mobile scale and animate through five states.

## The "preschool" failure mode for symbols

Claude's default symbol is a colored rectangle with text on it. That's not a symbol — it's a label. A real slot symbol has: a shaped background (not a rectangle), a gradient fill calibrated to the symbol's tier value, an inner highlight that gives it gloss or dimension, an outer rim with a contrasting stroke, and a thematic glyph or icon at center. The difference between "placeholder" and "premium" is about 4 additional Graphics calls layered correctly.

## NEVER ship emoji as symbols

Emoji (🐉 🦈 🔔 👑 🪸 ☥) are the single biggest "a computer made this" tell. They render differently on every OS (Apple vs Android vs Windows), carry no theme cohesion, and share no light rig with the rest of the set. **Any emoji or stock Unicode pictograph used as a symbol's identity fails QA.** The glyph names in `slot-art-style-presets` (`symbolGlyphs`) are *layout placeholders only* — the shippable icon is drawn with `Graphics`/bezier paths from `references/icon-library.md` and lit/shaded as below. Plain letters A/K/Q/J/10 are the one exception, and even those get a beveled, material-filled treatment (never raw `Text`).

## Premium = sculpted relief, not flat vector

A gradient + gloss ellipse caps you at "glossy vector." Premium symbols read as *physical objects hit by light* — gold with hot specular glints and dark occlusion in crevices, gems with faceted internal fire, carved stone with matte diffuse and AO in the cuts. The technique that converts a flat fill into a sculpted, painted surface is **height field → surface normal → Blinn-Phong + rim light + fake AO + a painterly light ramp**, owned by `procedural-textures-and-materials/references/sculpted-relief-shading.md` with the GLSL in `game-shaders-and-effects/references/custom-glsl-library.md`. Three questions every drawn symbol must answer: *where is the light, what material is this, how does it sit in depth?* Key + fill + **rim** is the trio that reads as "you hired an artist" — rim light especially is the cheapest, strongest premium signal.

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

## Symbol MATERIAL mapping by tier

Value = visual investment. Higher-paying symbols get a richer *material* (not just a brighter gradient) — a sculpted, lit surface from `procedural-textures-and-materials`. The card royals are themed by being carved from the theme's material (jade, obsidian, gold leaf, ice, circuitry), never plain colored letters. Load `references/symbol-gradients.md` for the gradient ramps and `procedural-textures-and-materials/references/sculpted-relief-shading.md` for the lit-relief pass applied on top.

| Tier | Examples | Material treatment | Light response |
|---|---|---|---|
| Grand special | WILD, SCATTER, BONUS | Polished gem / faceted jewel, radial inner fire | High specular (shine 128–256) + Fresnel rim + animated highlight |
| Premium (4–5 match) | ANKH, DRAGON, PHARAOH | Gold leaf or lacquer, domain-warped grain | Hot specular glints + AO in crevices + rim light |
| High (3+ match) | SCARAB, CROWN | Hammered/brushed metal or gemstone | Anisotropic or faceted spec, darkened cell borders |
| Mid (any match) | EYE, COIN | Carved stone / enamel, single material | Matte diffuse + soft rim, AO in cuts |
| Low (royals A K Q J 10) | letters | Theme material (jade/obsidian/ice), beveled | Bevel highlight top, occlusion shadow bottom — one shared light rig |

Every tier runs the **height → normal → Blinn + rim + AO + form-light ramp** pass; the difference between tiers is material recipe, specular exponent, and ornamentation density — not whether they're shaded.

## Thematic icon vocabulary by genre

The shippable icon is **drawn in code** — `Graphics`/bezier paths, then lit and material-shaded. Read `references/icon-library.md` for the construction sketches (gem, crown, coin, mask, lotus, shell, skull, etc.). The characters below are *naming/silhouette references only* — they describe the shape to construct, NOT something to render as `Text`. Drawing an emoji or stock pictograph here fails QA.

**Egyptian:** Ankh (cross+loop path), Eye of Horus (almond + brow + teardrop), Scarab (beetle body + wing cases), Pyramid (triangle + facet lines), royals carved in sandstone/gold
**Cyberpunk:** hex-grid badge, faceted diamond, circuit node, triangle, target ring — emissive edges
**Asian Prosperity:** Fortune medallion (coin + engraved motif), Dragon (sinuous body + scales), Star burst, Coin, gem — lacquer + gold inlay
**Fantasy:** Sword (blade + crossguard + pommel), Moon crescent, Lightning bolt, Crown (base + points + jewels), Orb — runed metal + frost
**Vegas Classic:** Seven (beveled numeral), card suits, Bell (trapezoid body + clapper + loop), Cherry (twin circles + stem), BAR — mirror-polish chrome

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
