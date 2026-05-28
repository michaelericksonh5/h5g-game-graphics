---
name: slot-symbol-animation-states
description: Implement all five symbol animation states for slot machine symbols — idle breathing, landing bounce, win highlight loop, dimmed/non-win treatment, and special symbol animations (Wild expand, Scatter trigger beam, walking wild movement, multiplier value reveal). Use whenever building or improving slot symbol animations, making symbols feel alive on the reels, or implementing win presentations at the symbol level. Triggers for "symbol animation", "idle animation", "landing animation", "win animation", "symbol bounce", "breathing symbols", "animated symbols", "wild expand", "scatter trigger animation", or when symbols feel static or lifeless.
---

# Slot Symbol Animation States

Every symbol has five states. Symbols that only exist in one state feel dead — like images, not game objects. This skill implements all five states using GSAP timelines on PixiJS containers.

## The five states

| State | When active | Loops? |
|---|---|---|
| IDLE / Breathing | Resting on reel, not spinning, not winning | Yes — infinite |
| LANDING | Reel stops, symbol snaps to position | No — one-shot |
| WIN_HIGHLIGHT | Symbol is part of a winning combination | Yes — loops during win presentation |
| DIMMED | Other symbols while a win is being highlighted | Yes — holds until win ends |
| SPECIAL | Wild expand, Scatter beam, Walking Wild travel | No — one-shot per event |

## State management

```javascript
class AnimatedSymbol {
  constructor(key, size, tier) {
    this.key       = key;
    this.tier      = tier; // 1=low, 2=mid, 3=high, 4=premium, 5=special
    this.container = buildSymbolContainer(key, size);
    this.state     = 'IDLE';
    this.currentAnimation = null;
    this.startIdleAnimation();
  }

  transition(newState, data = {}) {
    if (this.currentAnimation) {
      this.currentAnimation.kill();
      this.currentAnimation = null;
    }
    this.container.scale.set(1);
    this.container.alpha = 1;
    this.state = newState;

    switch (newState) {
      case 'IDLE':       this.startIdleAnimation(); break;
      case 'LANDING':    this.playLandingAnimation(data.reelIndex); break;
      case 'WIN':        this.startWinAnimation(data.tier); break;
      case 'DIMMED':     this.startDimAnimation(); break;
      case 'EXPANDING':  this.playExpandAnimation(); break;
      case 'SCATTER_BEAM': this.playScatterBeam(data.targetPositions); break;
    }
  }
}
```

## State 1: Idle / Breathing

The symbol is alive between spins. Low-value symbols breathe slowly and subtly. High-value and special symbols breathe more visibly and have additional effects.

```javascript
startIdleAnimation() {
  const tier = this.tier;

  // Scale breathing — tier controls amplitude
  const scaleAmp  = 0.02 + tier * 0.012;
  const scaleDur  = 2.5 - tier * 0.2;  // higher tier = faster breath

  this.currentAnimation = gsap.timeline({ repeat: -1 });

  // Core breath
  this.currentAnimation.to(this.container.scale, {
    x: 1 + scaleAmp, y: 1 + scaleAmp,
    duration: scaleDur, ease: 'sine.inOut', yoyo: true, repeat: 1,
  });

  // Premium symbols get glow pulse too
  if (tier >= 4) {
    const glow = this.container.getChildByLabel('glow');
    if (glow) {
      gsap.to(glow, {
        alpha: 0.8, duration: scaleDur * 0.8,
        yoyo: true, repeat: -1, ease: 'sine.inOut',
      });
    }
  }

  // Wild and Scatter: additional rotation shimmer
  if (['WILD', 'SCATTER'].includes(this.key)) {
    gsap.to(this.container, {
      rotation: Math.PI * 2,
      duration: 8,
      repeat: -1,
      ease: 'none',
    });
  }
}
```

## State 2: Landing / Stop bounce

Squash-and-stretch physics when the reel stops. The symbol should feel like it has weight:

```javascript
playLandingAnimation(reelIndex = 0) {
  // Stagger landing effect per reel index for variety
  const delay = reelIndex * 0.02;

  // Squash on impact
  this.currentAnimation = gsap.timeline({ delay });

  // Impact compression
  this.currentAnimation
    .to(this.container.scale, {
      x: 1.12, y: 0.88,  // wide and short — squash
      duration: 0.08,
      ease: 'power2.in',
    })
    // Spring back past resting
    .to(this.container.scale, {
      x: 0.94, y: 1.08,  // narrow and tall — stretch
      duration: 0.14,
      ease: 'power2.out',
    })
    // Settle to rest
    .to(this.container.scale, {
      x: 1.02, y: 0.99,
      duration: 0.1,
      ease: 'power2.inOut',
    })
    .to(this.container.scale, {
      x: 1, y: 1,
      duration: 0.12,
      ease: 'power1.out',
      onComplete: () => this.transition('IDLE'),
    });

  // Add flash of light on impact for premium symbols
  if (this.tier >= 3) {
    const flash = new Graphics();
    flash.circle(0, 0, this.container.width * 0.6);
    flash.fill({ color: 0xffffff, alpha: 0.6 });
    flash.blendMode = 'add';
    flash.x = this.container.width / 2;
    flash.y = this.container.height / 2;
    this.container.addChild(flash);

    gsap.to(flash, {
      alpha: 0, scaleX: 2, scaleY: 2,
      duration: 0.3, delay,
      onComplete: () => flash.destroy(),
    });
  }
}
```

## State 3: Win highlight

Loops for the entire duration of the win presentation. Tier-scaled intensity:

```javascript
startWinAnimation(winTier = 2) {
  const scalePeak = 1.08 + winTier * 0.04;
  const cycleDur  = 0.35 - winTier * 0.02;

  this.currentAnimation = gsap.timeline({ repeat: -1 });

  // Scale pulse
  this.currentAnimation.to(this.container.scale, {
    x: scalePeak, y: scalePeak,
    duration: cycleDur,
    ease: 'power2.inOut',
    yoyo: true, repeat: 1,
  });

  // Glow intensify (if symbol has glow layer)
  const glow = this.container.getChildByLabel('glow');
  if (glow) {
    gsap.to(glow, {
      alpha: 0.9 + winTier * 0.05,
      duration: cycleDur,
      yoyo: true, repeat: -1,
      ease: 'power2.inOut',
    });
    gsap.to(glow.scale, {
      x: 1.3, y: 1.3,
      duration: cycleDur,
      yoyo: true, repeat: -1,
      ease: 'power2.inOut',
    });
  }

  // Premium symbols: rim stroke color cycle
  if (this.tier >= 4 && winTier >= 3) {
    // Use ColorMatrixFilter to cycle saturation
    const cmFilter = new ColorMatrixFilter();
    this.container.filters = [cmFilter];
    gsap.to({ sat: 0 }, {
      sat: 1, duration: 0.5,
      repeat: -1, yoyo: true,
      ease: 'sine.inOut',
      onUpdate() { cmFilter.saturate(this.targets()[0].sat, true); },
    });
  }
}
```

## State 4: Dimmed

Non-winning symbols during win presentation. Must make winners pop forward:

```javascript
startDimAnimation() {
  this.currentAnimation = gsap.timeline();
  this.currentAnimation
    .to(this.container, { alpha: 0.38, duration: 0.2, ease: 'power2.out' });

  // Apply desaturate filter
  const cmFilter = new ColorMatrixFilter();
  cmFilter.saturate(-0.7);
  cmFilter.brightness(0.7);
  this.container.filters = [cmFilter];
}

undim() {
  if (this.currentAnimation) this.currentAnimation.kill();
  this.container.filters = [];
  gsap.to(this.container, { alpha: 1, duration: 0.25, ease: 'power2.inOut',
                             onComplete: () => this.transition('IDLE') });
}
```

## State 5: Special symbol animations

### Wild expand

Wild expands to cover full reel (3 rows) with a reveal wipe:

```javascript
playExpandAnimation() {
  const fullHeight = this.container.height * 3 + 12; // 3 rows + gaps

  this.currentAnimation = gsap.timeline();
  this.currentAnimation
    // Quick scale-in pop first
    .fromTo(this.container.scale, { x: 0.5, y: 0.5 }, {
      x: 1, y: 1, duration: 0.2, ease: 'back.out(3)',
    })
    // Expand vertically to cover full reel
    .to(this.container.scale, {
      y: fullHeight / this.container.height,
      duration: 0.35, ease: 'power3.out',
    })
    // Flash at full expand
    .call(() => triggerFlash(this.container))
    // Settle
    .to(this.container.scale, {
      y: fullHeight / this.container.height * 0.97,
      duration: 0.1, ease: 'power2.inOut', yoyo: true, repeat: 1,
      onComplete: () => this.startWinAnimation(3),
    });
}
```

### Scatter beam connection

When 3+ scatters land, beams of light connect them:

```javascript
playScatterBeam(otherScatterPositions) {
  for (const pos of otherScatterPositions) {
    const beam = new Graphics();
    const dx = pos.x - this.container.x;
    const dy = pos.y - this.container.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx);

    beam.rect(0, -3, len, 6);
    beam.fill({ fill: new FillGradient(0,0,len,0).addColorStop(0,'#fff').addColorStop(0.5,'#ffe200').addColorStop(1,'#fff') });
    beam.blendMode = 'add';
    beam.x = this.container.x + this.container.width / 2;
    beam.y = this.container.y + this.container.height / 2;
    beam.rotation = angle;
    beam.scaleX = 0;
    this.container.parent.addChild(beam);

    this.currentAnimation = gsap.timeline();
    this.currentAnimation
      .to(beam, { scaleX: 1, duration: 0.25, ease: 'power3.out' })
      .to(beam, { alpha: 0, duration: 0.5, delay: 0.3, ease: 'power2.in',
                  onComplete: () => beam.destroy() });
  }

  // Pulse this scatter symbol strongly
  gsap.to(this.container.scale, {
    x: 1.3, y: 1.3,
    duration: 0.25, ease: 'back.out(2)',
    yoyo: true, repeat: 3,
  });
}
```

### Walking wild movement

Wild moves one reel position each spin:

```javascript
walkTo(targetX, targetY) {
  this.currentAnimation = gsap.timeline();
  this.currentAnimation
    // Lift off current position
    .to(this.container, { y: targetY - 40, duration: 0.2, ease: 'power2.out' })
    // Arc across
    .to(this.container, { x: targetX, duration: 0.4, ease: 'power1.inOut' }, '<')
    // Land
    .to(this.container, { y: targetY, duration: 0.2, ease: 'bounce.out' })
    // Landing squash
    .to(this.container.scale, { x: 1.2, y: 0.85, duration: 0.08 })
    .to(this.container.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(2)',
                                 onComplete: () => this.transition('IDLE') });
}
```

## References

- `references/animation-timing-table.md` — duration, ease, and amplitude values per symbol tier for all five states
- `references/spine-integration.md` — using Spine skeletal animations instead of GSAP for production symbol art
