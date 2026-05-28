---
name: particle-systems-and-juice
description: Add game feel — particle effects, physics-based motion, screen shake, easing choreography, and "juice" timing patterns — to slot machines and casino games. Use whenever the user wants coin explosions, sparkle effects, confetti, energy bursts, win celebrations, satisfying button feedback, or any request to make a game feel more alive and reactive. Triggers for "coin shower", "particle effect", "sparkle", "confetti", "game feel", "juice", "win explosion", "particles", or any request to make animations feel more satisfying and physical. Should be combined with pixijs-slot-graphics and game-shaders-and-effects for complete win presentations.
---

# Particle Systems and Juice

The difference between a slot that feels good and one that feels dead is almost entirely particle effects and motion timing. This skill is the game feel library.

## The "juice" principle

"Juice" means every action has an exaggerated, satisfying response. A spin button shouldn't just activate — it should compress on press, spring back on release. A reel stop shouldn't just land — the symbol should squash and bounce. A win shouldn't just change a number — coins should erupt, symbols should pulse, the screen should shake. Juice is multiplicative: three small effects together feel exponentially better than each alone.

## PixiJS ParticleContainer setup

For any effect with 30+ particles, use `ParticleContainer` — one draw call for all particles:

```javascript
import { ParticleContainer, Sprite, Texture } from 'pixi.js';

// Build a coin texture once at init (don't generate per-burst)
function buildCoinTexture(renderer, size = 16) {
  const g = new Graphics();
  g.circle(0, 0, size / 2);
  g.fill({ fill: makeVerticalGradient(['#fffae0', '#f5c842', '#9c6a1a'], size) });
  g.circle(0, 0, size / 2);
  g.stroke({ width: 1.5, color: 0xc4901a });
  // Inner detail
  g.circle(0, 0, size * 0.3);
  g.stroke({ width: 1, color: 0xfffae0, alpha: 0.7 });
  return renderer.generateTexture(g);
}

const coinLayer = new ParticleContainer({
  dynamicProperties: { position: true, rotation: true, scale: true, alpha: true },
  maxSize: 500,
});
app.stage.addChild(coinLayer);
```

## Coin shower (win celebration)

Physics-based trajectories. Coins arc upward, gravity pulls them down, bounce at a floor level:

```javascript
function burstCoins(x, y, count, tier = 2, coinTexture) {
  const floor = app.screen.height - 80; // above the footer HUD

  for (let i = 0; i < count; i++) {
    const coin = new Sprite(coinTexture);
    coin.anchor.set(0.5);
    coin.x = x + (Math.random() - 0.5) * 60;
    coin.y = y;
    coin.rotation = Math.random() * Math.PI * 2;
    coin.scale.set(0.6 + Math.random() * 0.6);
    coinLayer.addParticle(coin);

    // Physics: upward velocity + spread + gravity
    const angle  = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed  = 300 + Math.random() * 400 * tier;
    const vx     = Math.cos(angle) * speed;
    const vy     = Math.sin(angle) * speed;
    const spinSpeed = (Math.random() - 0.5) * Math.PI * 6;
    const delay  = i * (1000 / count) * 0.5;

    setTimeout(() => {
      const startTime = performance.now();
      const gravity = 600;

      function update() {
        const t = (performance.now() - startTime) / 1000;
        coin.x = x + vx * t;
        coin.y = y + vy * t + 0.5 * gravity * t * t;
        coin.rotation += spinSpeed * 0.016;

        if (coin.y < floor) {
          coin.alpha = Math.max(0, 1 - (t - 1.2) / 0.4);
          requestAnimationFrame(update);
        } else {
          // Bounce
          coin.y = floor;
          coin.alpha = 0.8;
          gsap.to(coin, { alpha: 0, y: floor + 20, duration: 0.4, ease: 'power1.in',
                           onComplete: () => coinLayer.removeParticle(coin) });
        }
      }
      requestAnimationFrame(update);
    }, delay);
  }
}
```

## Sparkle emitter (symbol win highlight)

Tiny bright stars orbiting a winning symbol:

```javascript
function emitSparkles(symbolContainer, count = 12, color = 0xffea66) {
  const layer = new ParticleContainer({
    dynamicProperties: { position: true, alpha: true, scale: true },
  });
  symbolContainer.parent.addChild(layer);

  for (let i = 0; i < count; i++) {
    const spark = new Sprite(buildSparkTexture(color));
    spark.anchor.set(0.5);
    layer.addParticle(spark);

    const angle = (i / count) * Math.PI * 2;
    const radius = symbolContainer.width * 0.65 + Math.random() * 20;
    const targetX = symbolContainer.x + Math.cos(angle) * radius;
    const targetY = symbolContainer.y + Math.sin(angle) * radius;
    const delay   = i * 0.05;

    gsap.fromTo(spark, { x: symbolContainer.x, y: symbolContainer.y, alpha: 0, scale: 0 },
      { x: targetX, y: targetY, alpha: 1, scale: 1,
        duration: 0.3, delay, ease: 'power2.out' });
    gsap.to(spark, { alpha: 0, scale: 0, duration: 0.4, delay: delay + 0.4,
                     ease: 'power1.in',
                     onComplete: () => layer.removeParticle(spark) });
  }

  setTimeout(() => layer.destroy(), 1500);
}

function buildSparkTexture(color = 0xffea66) {
  const g = new Graphics();
  // 4-pointed star
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    g.moveTo(0, 0)
     .lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
  }
  g.stroke({ width: 2, color, alpha: 0.9, cap: 'round' });
  return app.renderer.generateTexture(g);
}
```

## Confetti cannon (grand win / jackpot)

Multi-color pieces that fill the screen:

```javascript
function fireConfetti(count = 200) {
  const colors = [0xffea66, 0xff2bd6, 0x2bb0fb, 0xac1eff, 0x42d65a, 0xff7b1b];

  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    const g = new Graphics();
    // Alternate between circles and rectangles for variety
    if (i % 2 === 0) {
      g.rect(-4, -2, 8, 4).fill({ color, alpha: 0.9 });
    } else {
      g.circle(0, 0, 4).fill({ color, alpha: 0.9 });
    }

    const startX = Math.random() * app.screen.width;
    g.x = startX;
    g.y = -20;
    g.rotation = Math.random() * Math.PI;
    app.stage.addChild(g);

    const duration = 2.5 + Math.random() * 2;
    const wobble   = (Math.random() - 0.5) * 150;

    gsap.to(g, {
      y: app.screen.height + 20,
      x: startX + wobble,
      rotation: g.rotation + (Math.random() - 0.5) * Math.PI * 8,
      alpha: 0,
      duration,
      delay: Math.random() * 0.8,
      ease: 'none',
      onComplete: () => g.destroy(),
    });
  }
}
```

## GSAP easing presets for slot feel

The timing constants that make slot animations feel physical, not digital:

```javascript
// Reel settle — the symbol snaps to position with a weighted bounce
gsap.fromTo(symbol, { y: targetY + 38 },
  { y: targetY, duration: 0.5, ease: 'back.out(2.2)' });

// Spin button press feedback
gsap.timeline()
  .to(btn.scale, { x: 0.88, y: 0.88, duration: 0.08, ease: 'power2.in' })
  .to(btn.scale, { x: 1, y: 1, duration: 0.18, ease: 'back.out(3)' });

// Big win text entrance
gsap.fromTo(winText.scale, { x: 0, y: 0 },
  { x: 1, y: 1, duration: 0.5, ease: 'back.out(3.5)' });

// Symbol win pulse
gsap.to(symbol.scale, {
  x: 1.2, y: 1.2, duration: 0.18,
  yoyo: true, repeat: 5, ease: 'power2.inOut',
});

// Anticipation reel slow-down: slow then hold
gsap.to(reelState, { velocity: 400, duration: 0.8, ease: 'power2.out' });

// Bonus trigger symbol beam (scatter → scatter connection)
gsap.fromTo(beam, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power2.out' });

// UI panel slide in
gsap.fromTo(panel, { y: '+=200', alpha: 0 },
  { y: 0, alpha: 1, duration: 0.4, ease: 'back.out(1.5)' });

// Jackpot counter roll
gsap.to({ n: 0 }, {
  n: jackpotAmount,
  duration: 3,
  ease: 'power2.out',
  onUpdate() { display.text = Math.round(this.targets()[0].n).toLocaleString(); },
});
```

## Energy burst (special symbol landing)

Radial shockwave that expands and fades — for wild lands, scatter triggers:

```javascript
function energyBurst(x, y, color = 0xffea66, rings = 3) {
  for (let r = 0; r < rings; r++) {
    const ring = new Graphics();
    ring.circle(0, 0, 10);
    ring.stroke({ width: 4 - r, color, alpha: 0.9 });
    ring.blendMode = 'add';
    ring.x = x;
    ring.y = y;
    app.stage.addChild(ring);

    gsap.to(ring.scale, {
      x: 3.5 + r * 0.5, y: 3.5 + r * 0.5,
      duration: 0.5 + r * 0.08,
      delay: r * 0.08,
      ease: 'power2.out',
    });
    gsap.to(ring, {
      alpha: 0,
      duration: 0.4 + r * 0.06,
      delay: r * 0.08 + 0.15,
      ease: 'power1.in',
      onComplete: () => ring.destroy(),
    });
  }
}
```

## Win celebration orchestration

Complete tier-scaled celebration sequence, combining all effects above:

```javascript
async function celebrateWin(winLines, tier, winAmount) {
  // Always: payline
  drawWinLines(winLines, tier);

  // Always: symbol pulse
  pulseWinSymbols(getWinningSymbols(winLines), tier);

  // Tier 2+: sparkles
  if (tier >= 2) {
    getWinningSymbols(winLines).forEach(sym => emitSparkles(sym, 8 + tier * 4));
  }

  // Tier 3+: screen shake + flash
  if (tier >= 3) {
    screenShake(app.stage, tier);
    triggerWinFlash(app);
    burstCoins(app.screen.width / 2, app.screen.height * 0.4, 30 * tier);
  }

  // Tier 4+: win text overlay + counter
  if (tier >= 4) {
    showWinText(tier >= 5 ? 'MEGA WIN' : 'BIG WIN');
    rollWinCounter(winAmount);
  }

  // Tier 5 (grand): confetti + sustained loop
  if (tier >= 5) {
    fireConfetti(250);
    playBonusFanfare();
  }
}
```

## References

- `references/particle-presets.md` — pre-configured emitters for all casino particle types: coins, gems, stars, bubbles, sparks, embers, aurora ribbons
- `references/easing-library.md` — all GSAP ease names with visual descriptions, plus custom bezier curves for specific slot feel moments
