# Visual QA Rubric: "Did You Hire an Artist?"

The whole suite exists to make AI-generated games look professionally made. This rubric is the gate
that proves it. Grade each key state RED / YELLOW / GREEN. **Only GREEN ships.** RED/YELLOW means
iterate, then re-grade. This is a *runtime* visual review (screenshot the running game); for deep
per-asset art critique defer to the `slot-art-qa-reviewer` agent if it's available — this rubric is the
fast, holistic "is it shippable" call.

## How to grade

1. Screenshot each key state from the *running* game (see `references/preview-tooling.md`):
   base reels (idle), a winning spin with celebration, the bonus/free-spins screen, the loading screen,
   and the paytable.
2. View each at two sizes: full screen, and a ~70px thumbnail of a single symbol (mobile reality).
3. Grade against the checks below. The grade is the **worst** failing category — one RED makes the
   state RED.

## The grades

- **GREEN** — would pass as made by a professional studio. Ships.
- **YELLOW** — competent but reads slightly "templated": flat lighting, a muddy gradient, one
  off-palette color, a win that underwhelms. Fixable in one iteration. Does not ship as-is.
- **RED** — reads as programmer-art / placeholder: raw box edges, default fonts on flat fills,
  unreadable symbols, console-error gaps, a "win" that's a single-frame flicker. Block.

## Checks by category

### Symbols & readability
- [ ] Each symbol is distinct in **silhouette** at 70px (not just by color) — squint test.
- [ ] Glyph contrast against its background gradient is high; no detail thinner than ~2px at 70px.
- [ ] Wild / Scatter / Bonus are obviously different in shape from the pays and from each other
      (color-blind safe). (See `procedural-symbol-design`.)
- [ ] Royals read as a designed set (shared gradient/bevel), not raw font characters.

### Color & theme cohesion
- [ ] Every surface pulls from the one `slot-art-style-presets` palette — no stray default blue, no
      off-theme accent.
- [ ] Gradients have a defined light direction; nothing is a flat single-fill rectangle.
- [ ] Theme is legible at a glance ("this is the Egyptian one") from the reels alone.

### Depth & material (esp. 3D)
- [ ] No flat `MeshBasicMaterial` and no raw sharp `BoxGeometry` edges (see `threejs-game-3d`).
- [ ] Highlights/gloss present on buttons, frames, gems — surfaces catch light.
- [ ] Bloom/glow is tuned to genre, not blown out or absent where the theme needs it.

### Motion & game feel
- [ ] Reels have weight: accel → spin → decelerate → overshoot/settle, not a linear stop
      (see `pixijs-slot-graphics/reel-mechanics.md`).
- [ ] Win celebration reads as a *payoff* — counter rollup, particles, audio land together — not a
      one-frame flash.
- [ ] Anticipation visibly slows/holds the last reel when scatters threaten.
- [ ] Button presses give tactile feedback (scale/brightness), 44pt+ touch targets.

### UI polish
- [ ] Layout respects safe areas / notch; nothing clipped in portrait phone (the primary case).
- [ ] Text is crisp (not blurry from non-integer scaling), aligned, consistent type scale.
- [ ] Loading screen looks intentional (themed), not a blank/grey gap.

### Runtime integrity
- [ ] Zero console errors and zero failed asset loads in the captured states (a RED on its own).
- [ ] No z-fighting, no missing/placeholder textures, no overlapped/orphaned overlays.

## State-specific must-pass

| State | Must be GREEN on |
|---|---|
| Base reels (idle) | symbol readability, theme cohesion, idle motion (spin button pulse) |
| Winning spin | celebration reads as payoff, win lines clearly highlighted, audio-visual sync |
| Bonus / free spins | clearly distinct mode (palette/music shift), counter visible, accumulator updates |
| Loading screen | themed, progress visible, no grey flash |
| Paytable | values legible, feature rules clear, navigable back to game |

## Reporting

State the grade per key state with the deciding reason, e.g.:
`"Base reels GREEN. Win GREEN. Bonus YELLOW — free-spins screen reuses base palette, doesn't read as a
distinct mode. Loading GREEN."` Then iterate the YELLOW/RED items and re-grade before sign-off.
