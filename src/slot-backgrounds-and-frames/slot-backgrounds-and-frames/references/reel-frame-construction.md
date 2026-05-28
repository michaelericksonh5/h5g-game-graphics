# Reel frame / bezel construction

The frame is the dimensional border the reels sit inside — the "cabinet." Done right it makes the
reels read as **recessed into a lit machine**; done wrong it's a colored rectangle outline. The
rule: a frame is a **filled, material-shaded object with an inner shadow**, never a bare stroke.

## The layer stack (outermost → reel aperture)

| # | Layer | Why it exists | Baked? |
|---|---|---|---|
| 1 | Outer glow | Separates the cabinet from the background | Bake (unless pulsing) |
| 2 | Chassis plate | The cabinet body the frame mounts on | Bake |
| 3 | Frame band (relief) | The beveled, material-shaded border | Bake |
| 4 | Inner shadow | Makes reels read as recessed — **the key layer** | Bake |
| 5 | Corner ornaments | Theme character | Bake (unless animated) |
| 6 | Highlight rim | A thin bright line on the lit edge | Bake |

## Geometry

Everything is built from the reel-area rectangle (`reelRect = {x, y, w, h}`) that
`slot-hud-and-ui` defines. The frame thickness `t` (~24–32px at 1x) drives the rest.

```javascript
function buildReelFrame(reelRect, theme) {
  const { x, y, w, h } = reelRect;
  const t = theme.frameThickness ?? 28;
  const frame = new Container();

  // 1. OUTER GLOW (behind everything)
  frame.addChild(makeGlowLayer(w + t * 4, h + t * 4, theme.frameGlow, 0.5, 24));

  // 2. CHASSIS PLATE
  const chassis = new Graphics()
    .roundRect(x - t * 1.8, y - t * 1.8, w + t * 3.6, h + t * 3.6, t)
    .fill(makeVerticalGradient(theme.chassisOuter, theme.chassisInner, h + t * 3.6));
  frame.addChild(chassis);

  // 3. FRAME BAND — fill with material, then run the relief pass.
  const band = new Graphics()
    .roundRect(x - t, y - t, w + t * 2, h + t * 2, t * 0.8)
    .fill(theme.frameFill ?? 0xC4952B);
  // Cut the aperture so the band is a ring (so relief AO reads on both edges):
  band.roundRect(x, y, w, h, t * 0.5).cut();
  applySculptedRelief(band, {
    material: theme.frameMaterial ?? 'gold-leaf',
    light: theme.lightRig,            // SAME rig as the symbols
  });
  frame.addChild(band);

  // 4. INNER SHADOW — soft dark band just inside the aperture. Non-negotiable.
  const inner = new Graphics()
    .roundRect(x, y, w, h, t * 0.5)
    .stroke({ width: t * 0.6, color: 0x000000, alpha: 0.55, alignment: 1 }); // inside
  inner.filters = [new BlurFilter({ strength: 10, quality: 2 })];
  frame.addChild(inner);

  // 5. CORNER ORNAMENTS
  for (const p of cornerPositions(reelRect, t)) frame.addChild(drawCornerOrnament(p, theme));

  // 6. HIGHLIGHT RIM — thin bright line on the upper-left (lit) edge of the band.
  const rim = new Graphics()
    .roundRect(x - t, y - t, w + t * 2, h + t * 2, t * 0.8)
    .stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
  frame.addChild(rim);

  return frame;
}
```

### Why the relief pass matters

Filling the band with a flat gold color gives "glossy vector at best." Running it through
`procedural-textures-and-materials/references/sculpted-relief-shading.md` (height field → surface
normal → Blinn-Phong + rim + AO) is what turns it into *cast gold / carved stone / brushed steel*.
The height field for a bevel is simple: high along the band centerline, falling to the inner and
outer edges, so the normal catches the key light on the top-left and occludes on the bottom-right.

### Why the inner shadow matters most

Without layer 4 the reels look pasted on top of the frame. The blurred dark band inside the
aperture simulates the cabinet lip casting shadow onto the recessed reel plane. Remove it and the
whole thing flattens. It is the single highest-leverage layer in the stack.

## Corner ornaments

Built with `procedural-symbol-design` techniques (shaped, material-filled, rim-lit) and lit by the
**same rig** as everything else. Themed: scarab/ankh (Egyptian), dragon head (Asian), gem cluster
(fantasy), skull (Day-of-the-Dead). Subject to **theme-element exclusivity** — if the motif is a
paying symbol, pick a different ornament so you don't dilute symbol identity. Keep them small and
in the corners; they frame, they don't compete with the reels.

## Bonus-mode frame variant (state differentiation)

The bonus stage should *look* different so the player feels the mode change. Don't just tint —
build a second frame:

- **Base:** ornate, warm (e.g. cast gold, hieroglyph band, scarab corners).
- **Bonus:** darker, "locked vault" — dark blue-steel material, heavier chassis, **chain
  details** draped on the frame, cooler glow. This mirrors real H5G locked-accumulator bonus
  bezels and reinforces the mechanic ("the reels are locked in").

Swap the frame Container (and the background scene) on bonus enter/exit; cross-fade for polish.

## Material recipes per genre (frame band)

| Genre | `frameMaterial` | Look |
|---|---|---|
| Egyptian | `gold-leaf` | Warm cast gold, hot specular, hieroglyph engraving in the band |
| Cyberpunk | `brushed-metal` + emissive | Dark alloy with neon edge trace |
| Asian | `gold-leaf` + `lacquer` | Red lacquer body, gold inlay trim, double-eave top |
| Norse | `hammered-metal` | Weathered bronze / cold steel, runic engraving |
| Underwater | `polished-gem` / pearl | Wet refractive trim, coral corner ornaments |
| Vegas | `chrome` | Mirror-polish chrome, hot neon glow |

All run the same relief pass; only the material recipe, specular exponent, and engraving change.

## Mobile-first

- **Bake the whole frame** to one Sprite at startup (it's static). Keep only a pulsing glow live
  if the design calls for one.
- Bake at display size × DPR (DPR clamped to 2).
- All blurs (glow, inner shadow) run once at bake time — never in the ticker.
- Frame + background together: keep to a handful of draw calls. Verify with
  `game-qa-and-testing/references/performance-checklist.md`.

## Common failures

- **Frame = `roundRect().stroke()`.** A colored outline is not a frame. Build the layered band.
- **No inner shadow.** Reels look pasted on. Add layer 4.
- **Flat-filled band, no relief.** Caps at "glossy vector." Run the sculpted-relief pass.
- **Different light direction than the symbols.** Breaks the unified light rig. Use one rig.
- **Ornaments reuse a paying symbol's motif.** Theme-element exclusivity violation.
- **Per-frame blur on the glow/shadow.** Bake it.
