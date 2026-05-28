# Sprite Construction Reference

Full recipes for building layered-Graphics characters, setting limb pivots, baking frames to `RenderTexture`, assembling an in-code frame atlas, and generating palette-swap variants.

---

## 1. Palette definitions

```javascript
// Player runner
export const RUNNER_PALETTE = {
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
  shadow:     0x000000,
};

// Slime enemy — base
export const SLIME_BASE_PALETTE = {
  body:       0x4CAF50,
  bodyShade:  0x2E7D32,
  highlight:  0xA5D6A7,
  outline:    0x1B5E20,
  eye:        0xFFFFFF,
  pupil:      0x212121,
  shadow:     0x000000,
};

// Palette-swap variants — spread and override
export const SLIME_RED_PALETTE   = { ...SLIME_BASE_PALETTE, body: 0xE53935, bodyShade: 0xB71C1C, highlight: 0xEF9A9A, outline: 0x4A0000 };
export const SLIME_GOLD_PALETTE  = { ...SLIME_BASE_PALETTE, body: 0xFFD600, bodyShade: 0xF9A825, highlight: 0xFFF59D, outline: 0x5D4037 };
export const SLIME_BLUE_PALETTE  = { ...SLIME_BASE_PALETTE, body: 0x1E88E5, bodyShade: 0x0D47A1, highlight: 0x90CAF9, outline: 0x0A1F44 };
```

---

## 2. Runner — full container hierarchy

`buildRunner(palette)` returns a `Container` ready to add to the stage. All measurements assume a 48×64 pixel character at 1x.

```javascript
import { Container, Graphics } from 'pixi.js';

export function buildRunner(palette = RUNNER_PALETTE, scale = 1) {
  const S = scale; // multiply all coordinates by S for resizing

  const root = new Container();
  root.label = 'characterRoot';
  // Pivot at horizontal center, vertical center of feet
  root.pivot.set(24 * S, 64 * S);

  // ── Shadow ────────────────────────────────────────────────
  const shadow = new Graphics();
  shadow.label = 'shadow';
  shadow.ellipse(24 * S, 62 * S, 14 * S, 5 * S);
  shadow.fill({ color: palette.shadow, alpha: 0.3 });
  root.addChild(shadow);

  // ── Left leg ─────────────────────────────────────────────
  const legL = new Container();
  legL.label = 'legL';
  legL.position.set(19 * S, 40 * S);  // hip position
  legL.pivot.set(0, 0);               // pivot at hip

  const thighL = new Graphics();
  // Thigh: rect from pivot downward
  thighL.roundRect(-5 * S, 0, 10 * S, 14 * S, 3 * S)
    .fill({ color: palette.pants })
    .roundRect(-5 * S, 0, 10 * S, 14 * S, 3 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  // Shade strip
  thighL.roundRect(-2 * S, 2 * S, 4 * S, 10 * S, 2 * S)
    .fill({ color: palette.pantsShade, alpha: 0.5 });
  legL.addChild(thighL);

  const shinL = new Container();
  shinL.label = 'shinL';
  shinL.position.set(0, 14 * S);     // knee position in legL space
  shinL.pivot.set(0, 0);             // pivot at knee

  const shinLGfx = new Graphics();
  shinLGfx.roundRect(-4 * S, 0, 8 * S, 12 * S, 2 * S)
    .fill({ color: palette.pants })
    .roundRect(-4 * S, 0, 8 * S, 12 * S, 2 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  // Shoe
  shinLGfx.roundRect(-5 * S, 10 * S, 11 * S, 6 * S, 2 * S)
    .fill({ color: palette.shoe })
    .roundRect(-5 * S, 10 * S, 11 * S, 6 * S, 2 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  shinL.addChild(shinLGfx);
  legL.addChild(shinL);
  root.addChild(legL);

  // ── Right leg (same structure, offset right) ──────────────
  const legR = new Container();
  legR.label = 'legR';
  legR.position.set(29 * S, 40 * S);
  legR.pivot.set(0, 0);

  const thighR = new Graphics();
  thighR.roundRect(-5 * S, 0, 10 * S, 14 * S, 3 * S)
    .fill({ color: palette.pants })
    .roundRect(-5 * S, 0, 10 * S, 14 * S, 3 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  thighR.roundRect(-2 * S, 2 * S, 4 * S, 10 * S, 2 * S)
    .fill({ color: palette.pantsShade, alpha: 0.5 });
  legR.addChild(thighR);

  const shinR = new Container();
  shinR.label = 'shinR';
  shinR.position.set(0, 14 * S);
  shinR.pivot.set(0, 0);
  const shinRGfx = new Graphics();
  shinRGfx.roundRect(-4 * S, 0, 8 * S, 12 * S, 2 * S)
    .fill({ color: palette.pants })
    .roundRect(-4 * S, 0, 8 * S, 12 * S, 2 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  shinRGfx.roundRect(-5 * S, 10 * S, 11 * S, 6 * S, 2 * S)
    .fill({ color: palette.shoe })
    .roundRect(-5 * S, 10 * S, 11 * S, 6 * S, 2 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  shinR.addChild(shinRGfx);
  legR.addChild(shinR);
  root.addChild(legR);

  // ── Torso ─────────────────────────────────────────────────
  const bodyGroup = new Container();
  bodyGroup.label = 'bodyGroup';
  bodyGroup.position.set(24 * S, 40 * S);
  bodyGroup.pivot.set(0, 0);           // pivot at hip

  const torso = new Graphics();
  // Main shirt
  torso.roundRect(-12 * S, -24 * S, 24 * S, 24 * S, 4 * S)
    .fill({ color: palette.shirt })
    .roundRect(-12 * S, -24 * S, 24 * S, 24 * S, 4 * S)
    .stroke({ width: 2 * S, color: palette.outline, alignment: 0.5 });
  // Shade side strip
  torso.roundRect(-12 * S, -22 * S, 5 * S, 20 * S, 3 * S)
    .fill({ color: palette.shirtShade, alpha: 0.4 });
  bodyGroup.addChild(torso);

  // ── Head ──────────────────────────────────────────────────
  const head = new Graphics();
  head.label = 'head';
  // Skull
  head.roundRect(-10 * S, -42 * S, 20 * S, 18 * S, 6 * S)
    .fill({ color: palette.skin })
    .roundRect(-10 * S, -42 * S, 20 * S, 18 * S, 6 * S)
    .stroke({ width: 2 * S, color: palette.outline, alignment: 0.5 });
  // Cheek shade
  head.ellipse(4 * S, -29 * S, 5 * S, 4 * S)
    .fill({ color: palette.skinShade, alpha: 0.3 });
  // Eye white
  head.circle(5 * S, -36 * S, 4 * S)
    .fill({ color: palette.eyeWhite })
    .circle(5 * S, -36 * S, 4 * S)
    .stroke({ width: 1 * S, color: palette.outline, alignment: 0.5 });
  // Pupil
  head.circle(6 * S, -36 * S, 2 * S)
    .fill({ color: palette.eyePupil });
  bodyGroup.addChild(head);

  // ── Left arm ─────────────────────────────────────────────
  const armL = new Container();
  armL.label = 'armL';
  armL.position.set(-12 * S, -22 * S); // shoulder in bodyGroup space
  armL.pivot.set(0, 0);

  const upperArmL = new Graphics();
  upperArmL.roundRect(-4 * S, 0, 8 * S, 11 * S, 3 * S)
    .fill({ color: palette.shirt })
    .roundRect(-4 * S, 0, 8 * S, 11 * S, 3 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  armL.addChild(upperArmL);

  const forearmL = new Container();
  forearmL.label = 'forearmL';
  forearmL.position.set(0, 11 * S);   // elbow
  forearmL.pivot.set(0, 0);
  const forearmLGfx = new Graphics();
  forearmLGfx.roundRect(-3 * S, 0, 7 * S, 10 * S, 2 * S)
    .fill({ color: palette.skin })
    .roundRect(-3 * S, 0, 7 * S, 10 * S, 2 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  forearmL.addChild(forearmLGfx);
  armL.addChild(forearmL);
  bodyGroup.addChild(armL);

  // ── Right arm ────────────────────────────────────────────
  const armR = new Container();
  armR.label = 'armR';
  armR.position.set(12 * S, -22 * S);
  armR.pivot.set(0, 0);

  const upperArmR = new Graphics();
  upperArmR.roundRect(-4 * S, 0, 8 * S, 11 * S, 3 * S)
    .fill({ color: palette.shirt })
    .roundRect(-4 * S, 0, 8 * S, 11 * S, 3 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  armR.addChild(upperArmR);

  const forearmR = new Container();
  forearmR.label = 'forearmR';
  forearmR.position.set(0, 11 * S);
  forearmR.pivot.set(0, 0);
  const forearmRGfx = new Graphics();
  forearmRGfx.roundRect(-3 * S, 0, 7 * S, 10 * S, 2 * S)
    .fill({ color: palette.skin })
    .roundRect(-3 * S, 0, 7 * S, 10 * S, 2 * S)
    .stroke({ width: 1.5 * S, color: palette.outline, alignment: 0.5 });
  forearmR.addChild(forearmRGfx);
  armR.addChild(forearmR);
  bodyGroup.addChild(armR);

  root.addChild(bodyGroup);

  // Return a structured handle for the animation system
  return {
    root,
    limbs: { legL, shinL, legR, shinR, armL, forearmL, armR, forearmR, bodyGroup, shadow },
  };
}
```

---

## 3. Slime enemy — full recipe

Slime has no separate limbs — it deforms as a whole body. Animation is achieved by scaling the root container and offsetting the eye blobs.

```javascript
export function buildSlime(palette = SLIME_BASE_PALETTE, scale = 1) {
  const S = scale;
  const root = new Container();
  root.label = 'slimeRoot';
  root.pivot.set(20 * S, 30 * S);   // center bottom

  const shadow = new Graphics();
  shadow.label = 'shadow';
  shadow.ellipse(20 * S, 29 * S, 15 * S, 5 * S);
  shadow.fill({ color: palette.shadow, alpha: 0.25 });
  root.addChild(shadow);

  // Body blob — drawn as a squashed circle using bezier
  const body = new Graphics();
  body.label = 'body';
  // Main body
  body.moveTo(5 * S, 28 * S)
    .bezierCurveTo(0, 20 * S, 0, 8 * S, 10 * S, 2 * S)
    .bezierCurveTo(14 * S, 0, 26 * S, 0, 30 * S, 2 * S)
    .bezierCurveTo(40 * S, 8 * S, 40 * S, 20 * S, 35 * S, 28 * S)
    .closePath()
    .fill({ color: palette.body })
    .moveTo(5 * S, 28 * S)
    .bezierCurveTo(0, 20 * S, 0, 8 * S, 10 * S, 2 * S)
    .bezierCurveTo(14 * S, 0, 26 * S, 0, 30 * S, 2 * S)
    .bezierCurveTo(40 * S, 8 * S, 40 * S, 20 * S, 35 * S, 28 * S)
    .closePath()
    .stroke({ width: 2 * S, color: palette.outline, alignment: 0.5 });
  root.addChild(body);

  // Shade underside
  const shade = new Graphics();
  shade.ellipse(20 * S, 22 * S, 12 * S, 7 * S)
    .fill({ color: palette.bodyShade, alpha: 0.4 });
  root.addChild(shade);

  // Highlight blob top-left
  const highlight = new Graphics();
  highlight.ellipse(13 * S, 8 * S, 7 * S, 4 * S)
    .fill({ color: palette.highlight, alpha: 0.7 });
  root.addChild(highlight);

  // Eyes container — offset for animation
  const eyeGroup = new Container();
  eyeGroup.label = 'eyeGroup';
  eyeGroup.position.set(0, 0);

  const eyeL = new Graphics();
  eyeL.circle(13 * S, 14 * S, 4 * S).fill({ color: palette.eye });
  eyeL.circle(14 * S, 14 * S, 2 * S).fill({ color: palette.pupil });
  eyeGroup.addChild(eyeL);

  const eyeR = new Graphics();
  eyeR.circle(27 * S, 14 * S, 4 * S).fill({ color: palette.eye });
  eyeR.circle(28 * S, 14 * S, 2 * S).fill({ color: palette.pupil });
  eyeGroup.addChild(eyeR);

  root.addChild(eyeGroup);

  return { root, limbs: { body, eyeGroup, shadow } };
}
```

---

## 4. Baking a single frame to RenderTexture

```javascript
import { RenderTexture, Container } from 'pixi.js';

const DPR = Math.min(window.devicePixelRatio, 2);

/**
 * Bake the current visual state of `charRoot` into a RenderTexture.
 * @param {Application} app   - live PixiJS Application
 * @param {Container}   charRoot
 * @param {number}      w     - logical pixel width  (e.g. 48)
 * @param {number}      h     - logical pixel height (e.g. 64)
 * @returns {RenderTexture}
 */
export function bakeFrame(app, charRoot, w, h) {
  // Store original transform
  const ox = charRoot.x, oy = charRoot.y, os = charRoot.scale.x;

  // Position at 0,0 and scale up for DPR
  charRoot.position.set(w * DPR / 2, h * DPR / 2);  // pivot is center-bottom, adjust if needed
  charRoot.scale.set(DPR);

  const rt = RenderTexture.create({ width: w * DPR, height: h * DPR });
  app.renderer.render({ container: charRoot, target: rt });

  // Restore
  charRoot.position.set(ox, oy);
  charRoot.scale.set(os);

  return rt;
}
```

---

## 5. Assembling an in-code frame atlas

```javascript
import { AnimatedSprite } from 'pixi.js';

/**
 * Build a baked-frame atlas for one character state.
 * `poseFn(limbs, frameIndex, totalFrames)` sets limb transforms for each frame.
 */
export function bakeAnimationFrames(app, charData, poseFn, frameCount, w, h) {
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    poseFn(charData.limbs, i, frameCount);     // set pose
    frames.push(bakeFrame(app, charData.root, w, h));
  }
  // Reset to frame 0 pose
  poseFn(charData.limbs, 0, frameCount);
  return frames;
}

/**
 * Create an AnimatedSprite from baked RenderTextures.
 * Scale it back to logical CSS pixels (undo the DPR bake).
 */
export function makeAnimatedSprite(frames, fps) {
  const sprite = new AnimatedSprite(frames);
  sprite.animationSpeed = fps / 60;
  sprite.scale.set(1 / DPR);
  sprite.anchor.set(0.5, 1);   // match root pivot: center-bottom
  return sprite;
}

// Usage:
// const charData = buildRunner(RUNNER_PALETTE);
// app.stage.addChild(charData.root);           // needed for render
//
// const runFrames = bakeAnimationFrames(app, charData, poseRunFrame, 8, 48, 64);
// const runSprite = makeAnimatedSprite(runFrames, 12);
// runSprite.play();
// app.stage.addChild(runSprite);
// charData.root.removeFromParent();            // baked; remove live rig
```

---

## 6. Palette-swap variant in three lines

```javascript
// Red slime shares the same baked frames array — or bake separately for color:
const redSlimeData = buildSlime(SLIME_RED_PALETTE);
const redFrames    = bakeAnimationFrames(app, redSlimeData, poseSlimeBounce, 6, 40, 30);
const redSprite    = makeAnimatedSprite(redFrames, 8);
// All red slimes reuse redFrames — no further texture allocation.
```
