---
name: procedural-sprite-animation
description: Draw and animate game characters and enemies entirely in code using PixiJS v8 — no external image assets required. Use this whenever the user needs a sprite, character sprite, enemy sprite, sprite animation, frame animation, animated character, walk cycle, run cycle, or sprite sheet generated in code. Triggers on "AnimatedSprite", "hit flash", "squash and stretch", "idle animation", "run animation", "jump animation", "death animation", "attack animation", "procedural character", "rigged limbs", "baked frames", or any request to draw and animate a player character or enemy for a side-scroller, platformer, or arcade game. Disambiguation: this skill owns drawing and animating non-slot game CHARACTERS and ENEMIES in code; for slot machine SYMBOLS use procedural-symbol-design; for slot symbol STATES (breathing, landing, win) use slot-symbol-animation-states; for the overall arcade/platformer engine use sidescroller-engine.
---

# Procedural Sprite Animation

Build and animate game characters entirely from layered PixiJS v8 `Graphics` — no PNGs, no sprite sheets on disk. A runner, a slime, a boss — all live as code that draws itself, bakes its own frames, and drives state transitions from physics input.

## The "stick figure" failure mode

Claude's default procedural character is a circle-on-a-rectangle. That's not a character — it's a diagram. A real game character has: separate limb containers with correct pivot offsets so they rotate naturally, a palette object that drives all colors from one place, multiple Graphics layers for shading and outlines, and baked-frame textures so the engine only pays the drawing cost once. The difference between "wireframe" and "feels like a game" is pivot placement and palette discipline.

## Two animation approaches — choose one per character type

### Approach A — Bake frames to RenderTexture, play via AnimatedSprite

Draw each pose frame into a `RenderTexture`, collect them into an array, hand them to `AnimatedSprite`. At runtime the GPU renders a single textured quad per character — identical cost whether it's one enemy or one hundred.

**Best for:** enemies that share identical animation (multiple slimes, coin creatures), mobile targets where GPU cost per character matters, characters with many instances on screen.

**Tradeoff:** pose changes require a redraw pass (fine at load time, bad if you need runtime palette swaps after the first frame).

### Approach B — Live-rigged limbs, driven each frame via pivot rotation

Keep limb containers in the scene graph. Each tick, read the animation clock and set each limb's rotation directly from a keyframe table. No texture baking; the GPU re-draws the character geometry every frame.

**Best for:** the player character (only one), boss enemies with unique personalities, characters that need realtime palette swaps, development/prototyping before you know final pose count.

**Tradeoff:** costs more GPU per character. Above ~20 live-rigged enemies on screen, switch to baked frames.

See `references/sprite-construction.md` for the full layered-Graphics recipe and baking pipeline. See `references/frame-animation-states.md` for the state table, AnimatedSprite setup, and live walk-cycle keyframes.

## Character structure — layered Graphics with rigged limbs

Every character is a hierarchy of `Container` nodes, each with its pivot set at the natural joint:

```
characterRoot (Container)
  ├─ shadow (Graphics)          — flattened ellipse at feet, scales with jump height
  ├─ bodyGroup (Container)      — pivot at hip center
  │   ├─ torso (Graphics)       — body fill, outline, shading
  │   └─ head (Graphics)        — centered on neck
  ├─ armL (Container)           — pivot at shoulder
  │   └─ forearmL (Container)   — pivot at elbow
  ├─ armR (Container)           — pivot at shoulder
  │   └─ forearmR (Container)   — pivot at elbow
  ├─ legL (Container)           — pivot at hip
  │   └─ shinL (Container)      — pivot at knee
  └─ legR (Container)           — pivot at hip
      └─ shinR (Container)      — pivot at knee
```

The pivot for a knee joint sits at `(0, 0)` in the shin container's local space, with the shin drawn downward from there. Setting `shinL.rotation = 0.4` bends the knee naturally because the geometry hangs from the pivot, not the other way around.

## Palette object — required, drives everything

Never hardcode colors in draw calls. Every character takes a palette:

```javascript
const RUNNER_PALETTE = {
  skin:       0xF4C08A,
  skinShade:  0xC8854A,
  shirt:      0x2979FF,
  shirtShade: 0x1565C0,
  pants:      0x37474F,
  pantsShade: 0x263238,
  shoe:       0x212121,
  outline:    0x1A1A2E,
  eyeWhite:   0xFFFFFF,
  eyePupil:   0x1A1A2E,
};
```

Palette-swap variants (red enemy, blue enemy, gold elite) are created by spreading and overriding specific keys — no code duplication.

## Animation states

| State  | fps | Loop | Transitions to |
|--------|-----|------|----------------|
| idle   | 8   | yes  | run, jump, attack, death |
| run    | 12  | yes  | idle, jump, hit, death |
| jump   | 10  | no   | fall |
| fall   | 8   | yes  | idle, run (on land) |
| hit    | 14  | no   | idle, death |
| attack | 16  | no   | idle, run |
| death  | 10  | no   | — (remove from scene) |

Physics state (velocity, `onGround`, `hitReceived`) drives the current animation state. See `references/frame-animation-states.md` for the full driver and per-state keyframes.

## Game-feel essentials

**Squash and stretch.** On `jump` start: `scale.x = 0.85, scale.y = 1.2` (anticipation + launch stretch). On landing: `scale.x = 1.3, scale.y = 0.75` (squash) then spring back over 5 frames.

**Facing flip.** `characterRoot.scale.x = facingRight ? 1 : -1`. All limb rotations stay identical — the root flip handles direction. Pivots must be at the horizontal center of the character for this to work cleanly.

**Hit flash.** `characterRoot.tint = 0xFF4444`. Hold 3 frames, then lerp back to `0xFFFFFF` over 6 frames. For a baked `AnimatedSprite`, tint works directly on the sprite object.

**Death dissolve.** Play the death animation to its final frame, then tween `characterRoot.alpha` from 1 to 0 over 0.6s with `ease: 'power2.in'`. Remove from stage on complete.

**Shadow scale with jump height.** `shadow.scale.x = 1 - jumpHeight/maxJumpHeight * 0.5`. Shadow shrinks as the character rises, sells the vertical distance.

## Mobile — baking and reuse

```javascript
// Cap at devicePixelRatio 2 to avoid over-rendering on high-DPI phones
const DPR = Math.min(window.devicePixelRatio, 2);

// Bake one frame: draw character into a RenderTexture at DPR scale
function bakeFrame(app, drawFn, w, h) {
  const rt = RenderTexture.create({ width: w * DPR, height: h * DPR });
  const g = new Graphics();
  drawFn(g, w, h);
  g.scale.set(DPR);
  app.renderer.render({ container: g, target: rt });
  g.destroy();
  return rt;
}
```

Bake all frames at load time. Every enemy instance shares the same `Texture[]` array — zero texture duplication. On a mid-range Android at 60 fps you can comfortably sustain 50+ enemies with baked frames; live-rigged at the same count will drop to ~30 fps.

## Workflow

1. **Define the palette object.** All colors live there before any drawing code is written.
2. **Build the container hierarchy** with pivots placed at joint centers. Test that rotating each limb looks anatomically correct before adding detail.
3. **Draw limb geometry** on top of the skeleton — body fills, outline strokes, shading ellipses.
4. **Pose each animation state** by calling the keyframe-setter function at each frame index.
5. **Bake to RenderTextures** (Approach A) or leave live (Approach B) based on instance count.
6. **Wire physics state → animation state** using the driver in `references/frame-animation-states.md`.
7. **Add game-feel passes:** squash/stretch on land, hit flash tint, death dissolve, shadow scale.
8. **Test on a 390×844 viewport** at 60 fps with the target enemy count before committing to approach.

## Common failures and their fixes

**Blurry baked frames.** You baked at `devicePixelRatio = 1` and display at 2. Always bake at `DPR` scale (cap 2). Set `RenderTexture` dimensions to `width * DPR` and scale the drawn Graphics by `DPR` before rendering, then set `AnimatedSprite.scale.set(1/DPR)` to display at correct CSS size.

**Pivot drift during flip.** After `scale.x = -1`, limb positions appear mirrored around the wrong point. Cause: the root pivot is not at the character's horizontal center. Fix: set `characterRoot.pivot.x = charWidth / 2` and position the root by its center, not its top-left.

**Animation state thrash.** The state changes every frame because the physics condition is evaluated raw (e.g., `vy > 0` flickers around zero). Fix: add a brief holdoff — only transition out of `fall` when `onGround` has been true for 2+ consecutive frames.

**Too many textures.** You baked a separate `RenderTexture` per enemy instance. Fix: bake once into a shared `frames` array at startup; all instances of the same enemy type reference the same array.

**Limb outline disappears on flip.** Graphics stroke is drawn with `alignment: 0.5` (centered on path). On `scale.x = -1` the stroke renders correctly — but if you used `alignment: 0` (inner) or `1` (outer), it may render on the wrong side of the path. Use centered strokes (`alignment: 0.5`) for all limb outlines.

## Cross-skill pointers

- Engine, input, and character state machine → `sidescroller-engine`
- Physics (velocity, gravity, collision) that drives animation state → `platformer-physics`
- Impact particles, hit sparks, dust on land → `particle-systems-and-juice`
- Sound effects for footsteps, jump, hit, death → `procedural-sfx-design`
- Ground and wall surface materials → `procedural-textures-and-materials`
- Final game-quality verification → `game-qa-and-testing`

## References

- `references/sprite-construction.md` — full layered-Graphics recipe for a runner and slime enemy, pivot setup, frame baking pipeline, palette-swap variants
- `references/frame-animation-states.md` — state table with fps/loop/next, AnimatedSprite setup from baked frames, procedural walk-cycle via limb rotation keyframes, squash/stretch keyframes for jump/land, hit-flash and death dissolve, physics-state-to-animation-state driver
