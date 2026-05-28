# Frame Animation States Reference

State table, `AnimatedSprite` setup from baked frames, procedural live walk-cycle via limb-rotation keyframes, squash/stretch for jump/land, hit-flash and death dissolve, and the physics-state-to-animation-state driver.

---

## 1. State table

| State  | Frame count | fps | Loop | Auto-transitions to |
|--------|-------------|-----|------|---------------------|
| idle   | 4           | 8   | yes  | run, jump, attack, death |
| run    | 8           | 12  | yes  | idle, jump, hit, death |
| jump   | 3           | 10  | no   | fall (after last frame) |
| fall   | 2           | 8   | yes  | idle or run (when onGround) |
| hit    | 4           | 14  | no   | idle (after last frame) or death |
| attack | 6           | 16  | no   | idle or run (after last frame) |
| death  | 6           | 10  | no   | removed from scene after complete |

---

## 2. AnimatedSprite setup from baked frames

```javascript
import { AnimatedSprite } from 'pixi.js';

const DPR = Math.min(window.devicePixelRatio, 2);

/**
 * Sprite store — one per character type, shared across all instances.
 * {
 *   idle:   RenderTexture[],
 *   run:    RenderTexture[],
 *   jump:   RenderTexture[],
 *   fall:   RenderTexture[],
 *   hit:    RenderTexture[],
 *   attack: RenderTexture[],
 *   death:  RenderTexture[],
 * }
 */
let runnerFrameAtlas = null;   // populated at load time

export function initRunnerAtlas(app) {
  const charData = buildRunner(RUNNER_PALETTE);
  app.stage.addChild(charData.root);  // must be in scene to render

  runnerFrameAtlas = {
    idle:   bakeAnimationFrames(app, charData, poseRunnerIdle,   4,  48, 64),
    run:    bakeAnimationFrames(app, charData, poseRunnerRun,    8,  48, 64),
    jump:   bakeAnimationFrames(app, charData, poseRunnerJump,   3,  48, 64),
    fall:   bakeAnimationFrames(app, charData, poseRunnerFall,   2,  48, 64),
    hit:    bakeAnimationFrames(app, charData, poseRunnerHit,    4,  48, 64),
    attack: bakeAnimationFrames(app, charData, poseRunnerAttack, 6,  48, 64),
    death:  bakeAnimationFrames(app, charData, poseRunnerDeath,  6,  48, 64),
  };

  charData.root.removeFromParent();
  charData.root.destroy();
}

/** Create one player instance using the shared atlas. */
export function createRunnerInstance() {
  const sprite = new AnimatedSprite(runnerFrameAtlas.idle);
  sprite.animationSpeed = 8 / 60;
  sprite.scale.set(1 / DPR);
  sprite.anchor.set(0.5, 1);
  sprite.loop = true;
  sprite.play();
  sprite.label = 'runner';
  sprite._state = 'idle';
  return sprite;
}

/** Transition a running-instance sprite to a new state. */
const STATE_FPS  = { idle: 8, run: 12, jump: 10, fall: 8, hit: 14, attack: 16, death: 10 };
const STATE_LOOP = { idle: true, run: true, jump: false, fall: true, hit: false, attack: false, death: false };

export function setCharacterState(sprite, newState, onComplete) {
  if (sprite._state === newState) return;
  sprite._state = newState;

  sprite.textures = runnerFrameAtlas[newState];
  sprite.animationSpeed = STATE_FPS[newState] / 60;
  sprite.loop = STATE_LOOP[newState];
  sprite.gotoAndPlay(0);

  if (onComplete && !sprite.loop) {
    sprite.onComplete = onComplete;
  }
}
```

---

## 3. Physics-state-to-animation-state driver

Call `driveAnimation(sprite, physicsBody)` once per tick. `physicsBody` has:
- `vx`, `vy` — velocity
- `onGround` — boolean
- `hitReceived` — boolean (set by collision system, cleared after consumption)
- `attacking` — boolean
- `dead` — boolean

```javascript
// Debounce counters to prevent state thrash
let groundFrames = 0;
const GROUND_HOLD = 2;   // frames onGround must be true before leaving jump/fall

export function driveAnimation(sprite, phys) {
  // Death is terminal — ignore everything else
  if (phys.dead) {
    if (sprite._state !== 'death') {
      setCharacterState(sprite, 'death', () => {
        // Caller removes sprite from scene
        sprite.dispatchEvent(new Event('deathComplete'));
      });
    }
    return;
  }

  // Consume hit
  if (phys.hitReceived) {
    phys.hitReceived = false;
    setCharacterState(sprite, 'hit', () => {
      const next = Math.abs(phys.vx) > 0.5 ? 'run' : 'idle';
      setCharacterState(sprite, next);
    });
    applyHitFlash(sprite);
    return;
  }

  // Attack (must not override hit/death, handled above)
  if (phys.attacking && sprite._state !== 'attack') {
    setCharacterState(sprite, 'attack', () => {
      const next = Math.abs(phys.vx) > 0.5 ? 'run' : 'idle';
      setCharacterState(sprite, next);
    });
    return;
  }

  // Airborne
  if (!phys.onGround) {
    groundFrames = 0;
    if (phys.vy < -0.5 && sprite._state !== 'jump') {
      setCharacterState(sprite, 'jump');
    } else if (phys.vy >= -0.5 && sprite._state !== 'fall' && sprite._state !== 'jump') {
      setCharacterState(sprite, 'fall');
    }
    // Let jump animation play out before switching to fall
    if (sprite._state === 'jump' && sprite.currentFrame === sprite.totalFrames - 1) {
      setCharacterState(sprite, 'fall');
    }
    return;
  }

  // Landing — debounce
  groundFrames = Math.min(groundFrames + 1, GROUND_HOLD + 1);
  if (groundFrames < GROUND_HOLD) return;  // wait before acting

  // On ground
  if (sprite._state === 'jump' || sprite._state === 'fall') {
    applyLandSquash(sprite);
    const next = Math.abs(phys.vx) > 0.5 ? 'run' : 'idle';
    setCharacterState(sprite, next);
    return;
  }

  if (sprite._state === 'attack' || sprite._state === 'hit') return;  // let it finish

  const moving = Math.abs(phys.vx) > 0.5;
  if (moving && sprite._state !== 'run')   setCharacterState(sprite, 'run');
  if (!moving && sprite._state !== 'idle') setCharacterState(sprite, 'idle');
}
```

---

## 4. Procedural walk cycle — live limb rotation keyframes

For Approach B (live-rigged), instead of baking frames, set limb rotations each tick from this table. `t` is the walk cycle phase in `[0, 1)`, advancing by `runSpeed / cycleLengthPx` per frame.

```javascript
// Keyframe helper — cosine interpolation is cheap and smooth
function cosLerp(a, b, t) {
  return a + (b - a) * (1 - Math.cos(t * Math.PI)) * 0.5;
}

/**
 * Apply run-cycle pose to live limbs.
 * @param {object} limbs - from buildRunner().limbs
 * @param {number} t     - cycle phase [0,1)
 */
export function applyRunPose(limbs, t) {
  const pi = Math.PI;
  const phase2 = (t + 0.5) % 1;  // opposite phase for opposing limbs

  // Thigh swing ±30° (0.52 rad)
  limbs.legL.rotation  =  Math.sin(t     * pi * 2) * 0.52;
  limbs.legR.rotation  =  Math.sin(phase2 * pi * 2) * 0.52;

  // Knee flexion — trailing leg bends more
  const kL = Math.max(0, Math.sin(t     * pi * 2 + 0.6)) * 0.7;
  const kR = Math.max(0, Math.sin(phase2 * pi * 2 + 0.6)) * 0.7;
  limbs.shinL.rotation = kL;
  limbs.shinR.rotation = kR;

  // Arm swing — opposite to leg on same side
  limbs.armL.rotation  = Math.sin(phase2 * pi * 2) * 0.4;
  limbs.armR.rotation  = Math.sin(t      * pi * 2) * 0.4;

  // Forearm trailing lag
  limbs.forearmL.rotation = Math.max(0, Math.sin(phase2 * pi * 2 + 0.3)) * 0.35;
  limbs.forearmR.rotation = Math.max(0, Math.sin(t      * pi * 2 + 0.3)) * 0.35;

  // Body bob — slight vertical shift at hip
  limbs.bodyGroup.position.y = 40 + Math.abs(Math.sin(t * pi * 2)) * -2;
}

/** Idle sway — slow breathing motion. */
export function applyIdlePose(limbs, t) {
  const bob = Math.sin(t * Math.PI * 2) * 1.5;
  limbs.bodyGroup.position.y = 40 + bob;
  limbs.bodyGroup.rotation = Math.sin(t * Math.PI * 2) * 0.02;
  // Arms hang with slight natural bend
  limbs.armL.rotation  =  0.1;
  limbs.armR.rotation  = -0.1;
  limbs.forearmL.rotation = 0.05;
  limbs.forearmR.rotation = 0.05;
  limbs.legL.rotation  = 0;
  limbs.legR.rotation  = 0;
  limbs.shinL.rotation = 0;
  limbs.shinR.rotation = 0;
}

/** Jump launch pose — call once on jump start. */
export function applyJumpPose(limbs, frameIndex) {
  const poses = [
    // frame 0: anticipation crouch
    { legL: 0.3, shinL: -0.5, legR: 0.3, shinR: -0.5, armL: -0.6, armR: 0.6 },
    // frame 1: full extension
    { legL: -0.4, shinL: 0.1, legR: -0.4, shinR: 0.1, armL: 0.8, armR: -0.8 },
    // frame 2: tuck at apex
    { legL: 0.5, shinL: -0.8, legR: 0.5, shinR: -0.8, armL: 0.3, armR: -0.3 },
  ];
  const p = poses[Math.min(frameIndex, poses.length - 1)];
  limbs.legL.rotation   = p.legL;
  limbs.shinL.rotation  = p.shinL;
  limbs.legR.rotation   = p.legR;
  limbs.shinR.rotation  = p.shinR;
  limbs.armL.rotation   = p.armL;
  limbs.armR.rotation   = p.armR;
  limbs.forearmL.rotation = 0;
  limbs.forearmR.rotation = 0;
}
```

---

## 5. Squash and stretch keyframes

### Jump anticipation + launch

```javascript
import gsap from 'gsap';

/** Call when jump input is received — plays anticipation then launches. */
export function playJumpSquash(spriteOrRoot) {
  const tl = gsap.timeline();
  tl.to(spriteOrRoot.scale, {
    x: 1.25, y: 0.75,   // squash — anticipation crouch
    duration: 0.07, ease: 'power2.in',
  })
  .to(spriteOrRoot.scale, {
    x: 0.8, y: 1.3,     // stretch — launch
    duration: 0.1, ease: 'power3.out',
  })
  .to(spriteOrRoot.scale, {
    x: 1, y: 1,
    duration: 0.15, ease: 'power2.out',
  });
}
```

### Landing squash — also drives shadow

```javascript
/**
 * Call when character transitions from jump/fall to idle/run.
 * `shadowSprite` is optional — if provided, scales with the squash.
 */
export function applyLandSquash(spriteOrRoot, shadowSprite) {
  const tl = gsap.timeline();
  tl.to(spriteOrRoot.scale, {
    x: 1.35, y: 0.70,   // hard squash on impact
    duration: 0.05, ease: 'power3.in',
  })
  .to(spriteOrRoot.scale, {
    x: 0.92, y: 1.12,   // rebound stretch
    duration: 0.1, ease: 'power2.out',
  })
  .to(spriteOrRoot.scale, {
    x: 1.03, y: 0.98,
    duration: 0.08,
  })
  .to(spriteOrRoot.scale, {
    x: 1, y: 1,
    duration: 0.12, ease: 'power1.out',
  });

  if (shadowSprite) {
    tl.to(shadowSprite.scale, { x: 1.4, y: 1.0, duration: 0.05 }, 0);
    tl.to(shadowSprite.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: 'power2.out' }, 0.05);
  }
}
```

---

## 6. Hit flash

```javascript
/**
 * Tint-based hit flash. Works on both AnimatedSprite (baked) and
 * live Container (set tint on each Graphics child).
 */
export function applyHitFlash(displayObj) {
  displayObj.tint = 0xFF3333;

  let frame = 0;
  const HOLD = 3;
  const FADE = 6;
  const total = HOLD + FADE;

  const ticker = app.ticker.add(() => {
    frame++;
    if (frame <= HOLD) return;
    const progress = (frame - HOLD) / FADE;
    // Lerp tint from red (0xFF3333) back to white (0xFFFFFF)
    const r = 0xFF;
    const g = Math.round(0x33 + (0xFF - 0x33) * progress);
    const b = Math.round(0x33 + (0xFF - 0x33) * progress);
    displayObj.tint = (r << 16) | (g << 8) | b;
    if (frame >= total) {
      displayObj.tint = 0xFFFFFF;
      app.ticker.remove(ticker);
    }
  });
}
```

---

## 7. Death dissolve

```javascript
import gsap from 'gsap';

/**
 * Play the death animation to completion, then fade out and remove.
 * Call after setCharacterState(sprite, 'death', ...) is triggered.
 */
export function playDeathDissolve(sprite, onRemoved) {
  // Wait for death animation to finish, then dissolve
  sprite.onComplete = () => {
    sprite.stop();
    gsap.to(sprite, {
      alpha: 0,
      y: sprite.y - 10,    // slight upward drift as it fades
      duration: 0.6,
      ease: 'power2.in',
      onComplete: () => {
        sprite.removeFromParent();
        sprite.destroy({ texture: false }); // shared textures — do NOT destroy
        if (onRemoved) onRemoved();
      },
    });
  };
}
```

---

## 8. Slime bounce cycle — baked frame poses

```javascript
/**
 * Pose function for slime idle bounce.
 * Called by bakeAnimationFrames for each of 6 frames.
 * Squashes and stretches the whole body.
 */
export function poseSlimeBounce(limbs, frameIndex, totalFrames) {
  const t = frameIndex / totalFrames;
  const bounce = Math.sin(t * Math.PI);   // 0 → 1 → 0 arc

  // Squash on ground (t=0, t=1), stretch at apex (t=0.5)
  const scaleX = 1 + bounce * 0.18;
  const scaleY = 1 - bounce * 0.22;

  limbs.body.scale.set(scaleX, scaleY);
  limbs.body.y = (1 - scaleY) * 14;   // keep feet on ground during squash

  // Eyes bob with the body
  limbs.eyeGroup.y = -bounce * 3;
}
```
