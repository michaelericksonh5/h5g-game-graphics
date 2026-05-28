# Win Celebrations

A win in a slot game is a multi-sensory event, not a number changing. The celebration is tier-scaled — bigger wins get more theatrical treatment. This reference defines the tiers and the visual choreography for each.

## Win tier definitions

Tiers are typically expressed as multiples of the player's bet:

| Tier | Multiplier | Visual treatment |
|---|---|---|
| Small | 1-5x bet | Subtle line highlight, brief symbol pulse, single chime |
| Medium | 5-20x bet | Glowing payline, full symbol pulse with scale-up, multi-note chime |
| Big | 20-100x bet | Full screen glow border, particle burst, "BIG WIN" text overlay, ascending chime sequence |
| Mega | 100-500x bet | Sustained particle storm, screen shake, full overlay with rising counter, ascending arpeggio |
| Grand / Jackpot | 500x+ | Full cinematic — overlay, character celebration, sustained coin shower, fanfare music swell |

These boundaries are conventions. Studios calibrate to their own RTP — what's a "big win" in a high-volatility slot might be "medium" in a low-volatility one.

## Small win choreography

Duration: ~800ms. Player barely registers it as a special event but sees that something happened.

```javascript
// 1. Highlight the payline with a thin glowing line
const line = drawWinLine(coordinates, { width: 4, color: 0xffea66 });

// 2. Pulse the winning symbols once
gsap.fromTo(symbols.map(s => s.scale),
  { x: 1, y: 1 },
  { x: 1.12, y: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut' }
);

// 3. Fade out the line after the pulse
gsap.to(line, { alpha: 0, duration: 0.3, delay: 0.4, onComplete: () => line.destroy() });
```

## Medium win

Duration: ~1500ms. Two-layer payline (sharp on top, blurred underneath with `blendMode='add'`), bigger symbol pulse, brief sparkle particles.

```javascript
// Two-layer payline — the blurred underneath is what makes it "glow" rather than just be colored
const glowLine = drawWinLine(coords, { width: 18, color: 0xff7b1b, alpha: 0.7 });
glowLine.filters = [new BlurFilter({ strength: 12 })];
glowLine.blendMode = 'add';

const sharpLine = drawWinLine(coords, { width: 4, color: 0xffea66 });

// Symbols pulse 3x
gsap.fromTo(symbols.map(s => s.scale),
  { x: 1, y: 1 },
  { x: 1.2, y: 1.2, duration: 0.2, yoyo: true, repeat: 5, ease: 'power2.inOut' }
);

// Sparkle particles emerging from each symbol — see particle-systems-and-juice
emitSparkles(symbols, { count: 8, color: 0xffea66, duration: 1.0 });
```

## Big win

Duration: 2-3 seconds. Adds: screen shake, full-canvas glow border that pulses, coin particle burst, "BIG WIN" text that scales up.

The screen shake is tier-scaled and tightly timed — shake too long and it nauseates; too short and players miss it. Use `gsap.to(camera, { x: '+=8', yoyo: true, repeat: 9, duration: 0.04 })` for ~400ms of buzzing motion.

The coin burst spawns 60-100 coin sprites from the center of the winning line, with randomized velocities biased upward, gravity pulling them down, and a soft bounce against the bottom UI bar. Use `ParticleContainer` for the coins to keep frame rate up — see `performance-mobile.md`.

The "BIG WIN" overlay text uses a gold gradient, scales up from 0.5 to 1.0 with `back.out(2.5)`, holds briefly, then fades. Keep typography heavy — 900 weight, wide letter-spacing.

## Mega win

Duration: 3-5 seconds. Adds: a counter animation that rolls the total winnings up from 0 to the actual amount (this is what creates the dopamine spike — players watch the number grow). Sustained particle storm. The chime becomes an ascending arpeggio with a final cymbal swell.

The counter is critical. Players will watch the number count up — that anticipation reward loop is doing serious work. Use `gsap.to({val: 0}, { val: winAmount, duration: 2.5, ease: 'power2.out', onUpdate: () => updateText() })`. Speed: about 1 second per 100x multiplier; cap at ~3.5 seconds even for huge wins.

## Grand / Jackpot

Duration: 5-8 seconds, often with the player able to tap-to-skip after the first 2 seconds.

This is the cinematic moment. Often the entire game UI fades out and a custom jackpot overlay takes over: animated background, character art if the game has one, a stylized counter, gold/confetti raining continuously. Studios spend disproportionate art budget on jackpot animations because they're the moment players remember and share.

Components:
- Full-screen darkening overlay with the game blurred behind
- Hero artwork or character celebration
- Animated stylized "GRAND" / "JACKPOT" text with multiple effects layered (gold shimmer animation, particle trails, shadow falloff)
- Counter rolling up to the jackpot amount
- Sustained coin/confetti shower
- Music swell — see `adaptive-game-music`

## The payline drawing pattern

A payline crosses specific cells on specific reels. Common patterns: middle row (positions [1,1,1,1,1]), top row, bottom row, V-shape ([0,1,2,1,0]), zigzag.

To draw a payline that follows symbol centers:

```javascript
function drawPayline(reelIndices, rowIndices) {
  const points = reelIndices.map((ri, i) => ({
    x: reelStartX + ri * (cellSize + reelGap) + cellSize / 2,
    y: reelStartY + rowIndices[i] * cellSize + cellSize / 2,
  }));

  const line = new Graphics();
  line.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    line.lineTo(points[i].x, points[i].y);
  }
  line.stroke({ width: 4, color: 0xffea66, cap: 'round', join: 'round' });
  return line;
}
```

For multi-line wins (often the case), each line gets its own color so the player can distinguish them. Common palette: gold (#ffea66), magenta (#ff2bd6), cyan (#2bb0fb), green (#42d65a), purple (#ac1eff).

## "Big Win" text styling

The text overlay for big+ wins is its own art piece. Defaults:

- Font weight 900 (or a heavy display font if branded)
- Letter spacing 0.05-0.15em (wide)
- Multi-stop gradient fill — gold for standard, theme-matched for branded
- White stroke at 1.5-3px
- Drop shadow with a colored tint matching the gradient base
- Optionally: animated shimmer (gradient axis rotating)

```javascript
const winText = new Text({
  text: 'BIG WIN',
  style: {
    fontFamily: 'system-ui',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 6,
    fill: { fill: makeVerticalGradient(['#fff5d6', '#ffea66', '#c48a1a'], 80) },
    stroke: { color: 0xffffff, width: 2.5, alpha: 0.9 },
    dropShadow: { color: 0xff7b1b, blur: 12, distance: 0, alpha: 0.8 },
  },
});
```

## Anti-patterns

- Don't celebrate every win the same way. The tier scaling is what makes the small wins feel small and the big wins feel earned. Equal celebration on every win deadens the player to all of them.
- Don't let celebrations block input forever. Even on a grand win, players should be able to tap to skip after 2-3 seconds. Forced waits are universally hated.
- Don't celebrate losses. Some games show "near miss" effects (two scatters land, third misses — slight stinger). That's fine. But don't show a full payline animation for a 0.5x bet "win" that's actually a loss. Players notice and feel patronized.
- Don't reuse the same particle burst for every tier. Big and Mega should have visibly more particles, more colors, more motion than a Medium win.
