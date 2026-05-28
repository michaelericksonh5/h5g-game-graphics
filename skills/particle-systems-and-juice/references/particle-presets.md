# Particle Presets

Drop-in particle recipes with the physics that make them feel real. Each is a lightweight emitter you
can run on a PixiJS ticker — no external particle library required. Pairs with the tier-scaled
celebration in `SKILL.md` and the easings in `easing-library.md`.

## Minimal emitter core

```javascript
class Emitter {
  constructor(container) { this.c = container; this.parts = []; }
  spawn(p) { this.c.addChild(p.sprite); this.parts.push(p); }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vy += (p.gravity ?? 0) * dt;
      p.sprite.x += p.vx * dt; p.sprite.y += p.vy * dt;
      p.sprite.rotation += (p.spin ?? 0) * dt;
      p.life -= dt;
      if (p.fade) p.sprite.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) { p.sprite.destroy(); this.parts.splice(i, 1); }
    }
  }
}
// Drive emitter.update(ticker.deltaMS/1000) from app.ticker.
```

## Coin shower (gravity + floor bounce)

The signature slot celebration. Coins fountain up, arc over, fall under gravity, bounce at the floor.

```javascript
function coinShower(emitter, app, count, theme) {
  const floor = app.screen.height + 40;
  for (let i = 0; i < count; i++) {
    const sprite = makeCoinSprite(theme);                 // gold disc w/ gloss
    sprite.x = app.screen.width / 2 + (Math.random() - 0.5) * 80;
    sprite.y = app.screen.height * 0.6;
    emitter.spawn({
      sprite,
      vx: (Math.random() - 0.5) * 420,
      vy: -(500 + Math.random() * 450),                   // launch upward
      gravity: 1400,
      spin: (Math.random() - 0.5) * 12,
      life: 2.5, maxLife: 2.5, fade: true,
      onFloor: () => {},                                   // see bounce below
    });
  }
}
```

Add a floor bounce inside `update` for coins specifically:

```javascript
if (p.gravity && p.sprite.y > floorY && p.vy > 0) { p.vy *= -0.45; p.vx *= 0.8; }  // damped bounce
```

Count by tier: small ~12, medium ~30, big ~60, mega ~120, grand ~200 (cap for mobile fill-rate).

## Sparkle orbit (winning symbols)

Small bright sparks orbiting a winning symbol — sells "this one paid".

```javascript
function sparkleOrbit(emitter, cx, cy, radius = 36, n = 8) {
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const sprite = makeSparkSprite();
    const p = { sprite, theta: angle, r: radius, life: 1.2, maxLife: 1.2, fade: true, orbit: true,
                cx, cy, speed: 3 + Math.random() };
    emitter.spawn(p);
  }
}
// In update, for orbit particles: p.theta += p.speed*dt; x = cx + cos(theta)*r; y = cy + sin*r;
```

## Confetti cannon

Rectangles in theme colors, launched in a cone, tumbling as they fall.

```javascript
function confetti(emitter, x, y, count, palette) {
  for (let i = 0; i < count; i++) {
    const sprite = new Graphics().rect(-4,-6,8,12).fill({ color: palette[i % palette.length] });
    sprite.x = x; sprite.y = y;
    const ang = -Math.PI/2 + (Math.random()-0.5)*0.8;     // upward cone
    const spd = 500 + Math.random()*400;
    emitter.spawn({ sprite, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
                    gravity: 900, spin:(Math.random()-0.5)*16, life:3, maxLife:3, fade:true });
  }
}
```

## Energy burst ring

A ring that expands and fades — great on win confirmation or bonus trigger.

```javascript
function burstRing(container, x, y, color) {
  const ring = new Graphics().circle(0,0,10).stroke({ width:6, color, alpha:0.9 });
  ring.x = x; ring.y = y; container.addChild(ring);
  gsap.to(ring.scale, { x:8, y:8, duration:0.5, ease:'power2.out' });
  gsap.to(ring, { alpha:0, duration:0.5, onComplete:()=>ring.destroy() });
}
```

## Dust puff (symbol landing)

Tiny short-lived soft particles at the base of a landing symbol — subtle weight cue.

```javascript
function dustPuff(emitter, x, y) {
  for (let i=0;i<5;i++){ const sprite = makeSoftDot(0xffffff, 0.4);
    sprite.x=x+(Math.random()-0.5)*24; sprite.y=y;
    emitter.spawn({ sprite, vx:(Math.random()-0.5)*60, vy:-40-Math.random()*40,
                    gravity:120, life:0.4, maxLife:0.4, fade:true }); }
}
```

## Tier → preset map

| Win tier | Particles |
|---|---|
| Small | sparkle orbit on winners |
| Medium | sparkle orbit + small coin shower (~30) + 1 burst ring |
| Big | coin shower (~60) + confetti + burst rings + screen shake (light) |
| Mega | coin shower (~120) + confetti cannon + multiple rings + shake (medium) |
| Grand | coin shower (~200, capped) + sustained confetti + full-screen flash + shake (strong) |

## Performance budget

- **Pool sprites** — pre-create and recycle; never `new Graphics()` per particle in a hot loop for big
  showers (the recipes above show clarity; pool in production).
- Cap total live particles (~250 mobile). Drop count, not quality, on weak devices.
- Use a single emitter container with `cullable` off (particles move) but destroy promptly on death.
- Gate intensity on `prefers-reduced-motion` (see `easing-library.md`).
