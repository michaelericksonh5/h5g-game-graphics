# Bonus UI Patterns

Visual templates and transition choreography for each bonus overlay. All procedurally drawn (PixiJS
v8), theme-token driven, mobile-first. These pair with the feature modules in `SKILL.md` and the
component primitives in the `slot-hud-and-ui` skill.

## Universal entry/exit transition

Every bonus shares the same in/out wrapper so the game feels coherent:

```javascript
async function bonusTransitionIn(stage, label, theme) {
  // 1. Dim the base game
  const dim = new Graphics().rect(0,0,stage.width,stage.height).fill({ color: 0x000000, alpha: 0 });
  stage.addChild(dim);
  await gsapTo(dim, { alpha: 0.7, duration: 0.4 });

  // 2. Banner sweeps in from off-screen, overshoots, settles
  const banner = makeBanner(label, theme);          // gradient pill + title text
  banner.x = -stage.width; banner.y = stage.height * 0.4;
  await gsapTo(banner, { x: stage.width/2, duration: 0.6, ease: 'back.out(2)' });
  await delay(900);
  await gsapTo(banner, { y: -200, duration: 0.4, ease: 'power2.in' });
  banner.destroy();
  return dim;   // caller fades it out on exit
}
```

Reuse this for Free Spins, Hold-and-Win, Pick, and Wheel so the *entry grammar* is identical and only
the payload differs.

## Free Spins overlay

```
        ┌───────────────┐
        │  FREE SPINS   │   gradient pill badge, top-center
        └───────────────┘
              10           48px counter, gold gradient, bounce on change
          WIN: 1,240       accumulator, lighter weight
```

- **Counter change**: `gsap.fromTo(counter.scale, {x:1.3,y:1.3}, {x:1,y:1, ease:'back.out(2)'} )`.
- **Retrigger flash**: full-width gold flash (alpha 0→0.5→0, 250ms) + "+5" rising and fading.
- **Mode background**: swap to a darker/richer variant of the theme palette; persist for the feature.

## Hold-and-Win grid overlay

- Render the 5×3 (or larger) grid as discrete cells with a locked/unlocked state.
- **Lock animation**: scale-punch the cell (1→1.2→1) + a ColorMatrix brighten, then a static glow ring
  added behind locked cells.
- **Respin counter** centered above the grid; reset value flashes when it resets to max on a new lock.
- Money symbols show their value as text baked into the cell.

```javascript
function lockCell(cell, value, theme) {
  cell.addChild(makeGlowLayer(cell.width*1.4, cell.height*1.4, theme.lockGlow, 0.7, 18));
  cell.valueText.text = value.toLocaleString();
  gsap.fromTo(cell.scale, {x:1,y:1}, {x:1.2,y:1.2, yoyo:true, repeat:1, duration:0.12});
}
```

## Pick-and-Click grid

- A grid of identical "cover" sprites (chests, cards, tiles). 44pt+ touch targets, spaced for thumbs.
- **Reveal**: flip (scaleX 1→0→1 with texture swap at 0) or burst-open; prize text/icon scales in with
  `back.out`.
- **Running total** panel updates with a short rollup on each coin reveal.
- Disable remaining covers when a COLLECT is revealed; dim them and fade the overlay out.

## Wheel of Fortune

- Draw segments as colored arcs with labels; a fixed pointer at top.
- **Spin**: 4–6 full rotations into the target angle, `power2.out` so it decelerates dramatically.
- **Tick** sound per segment crossing the pointer (rate follows angular velocity).
- **Reveal**: pulse the winning segment, dim the rest, scale the prize value up center-screen.

```javascript
await gsapTo(wheel, { rotation: targetRad + Math.PI*2*5, duration: 4.5, ease: 'power2.out' });
```

## Multiplier ladder (persistent side panel)

- Vertical stack of rungs; current rung highlighted with a glow.
- **Advance**: slide highlight up one rung, scale-punch the new value, brief particle spark.
- **Max rung**: continuous glow pulse to signal "topped out".

## Mobile layout rules for overlays

- Anchor overlays to screen center and to safe-area insets; never to fixed pixel coordinates.
- Bonus panels should occupy ≤ 90% width in portrait, leaving a margin so they read as a layer above
  the game, not a replacement screen.
- All interactive bonus elements: 44pt minimum touch target, 8pt minimum spacing.
- See the `slot-hud-and-ui` skill `references/mobile-layout-patterns.md` for the responsive math.

## Audio hooks per feature

Each transition fires events the audio layer listens for (`tonejs-game-audio` / `procedural-sfx-design`
/ `adaptive-game-music`): `onBonusEnter`, `onBonusExit`, `cellLock`, `wheelTick`, `wheelStop`,
`pickReveal`, `retrigger`. Keep the UI module emitting these even if audio isn't wired yet.
