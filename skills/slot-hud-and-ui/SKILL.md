---
name: slot-hud-and-ui
description: "Build all HUD and UI components for slot machine games — bet controls, balance display, win counter with rollup animation, free spins overlay, jackpot meters, paytable screen, loading screen, autoplay controls, all button states. Every component is procedurally drawn, mobile-first, and touch-friendly. Use whenever building the non-reel UI of a slot game: \"bet controls\", \"balance display\", \"win counter\", \"HUD\", \"paytable\", \"menu\", \"loading screen\", \"auto spin\", \"jackpot display\", \"free spins counter\", or when the game needs a complete UI shell around the reels."
---

# Slot HUD and UI

All UI components procedurally drawn with PixiJS v8. No image assets. Mobile-first with 44pt minimum touch targets.

## Layout regions

```
┌─────────────────────────────────┐
│  JACKPOT METERS (if applicable) │  h=60-80px
├─────────────────────────────────┤
│  GAME TITLE / HEADER            │  h=64px
├─────────────────────────────────┤
│                                 │
│      REEL AREA                  │  flex-fill
│                                 │
├─────────────────────────────────┤
│  WIN DISPLAY        BALANCE     │  h=48px
├─────────────────────────────────┤
│  [BET-] [BET] [BET+]  [SPIN]   │  h=96px (spin button 72px diameter)
│  [AUTO] [INFO] [TURBO] [MAX]    │  h=44px
└─────────────────────────────────┘
```

All measurements in CSS pixels at 1x. Scale proportionally.

## Premium panels: material + depth (not flat fills)

A flat gradient rectangle with a 1.5px stroke reads as "prototype UI." Premium HUD elements look like *physical, lit objects*: a beveled panel with a top rim highlight (light from above), an inner shadow at the bottom, a subtle inner glow, and a material fill from `procedural-textures-and-materials` (brushed metal, lacquer, carved stone — matched to the theme). Build every panel with this layered recipe instead of a single `roundRect().fill()`:

```javascript
// Premium beveled panel: material fill + top rim light + bottom inner shadow + inner glow.
function makePanel(w, h, theme, { radius = 10, material = null } = {}) {
  const c = new Container();
  const r = radius;

  // 1. Body — material texture if provided, else a multi-stop gradient (not 2-stop flat)
  const body = new Graphics().roundRect(0, 0, w, h, r);
  body.fill(material ? { texture: material } : { fill: makeVerticalGradient(theme.panelFill ?? ['#2a1d12','#140d07'], h) });
  c.addChild(body);

  // 2. Inner shadow (bottom/inset) — recessed depth
  const shade = new Graphics().roundRect(1, 1, w - 2, h - 2, r - 1)
    .stroke({ width: 3, color: 0x000000, alpha: 0.45, alignment: 1 });
  c.addChild(shade);

  // 3. Top rim highlight — the single strongest "lit from above" cue
  const rim = new Graphics();
  rim.moveTo(r, 1.5).lineTo(w - r, 1.5)
     .stroke({ width: 1.5, color: 0xffffff, alpha: 0.5 });
  c.addChild(rim);

  // 4. Inner glow (theme accent, additive) — makes the panel feel energized
  const glow = new Graphics().roundRect(2, 2, w - 4, h - 4, r - 1)
    .stroke({ width: 2, color: theme.frameGlow ?? 0xf5c842, alpha: 0.25 });
  glow.filters = [new BlurFilter({ strength: 6, quality: 2 })];
  glow.blendMode = 'add';
  c.addChild(glow);

  return c;
}
```

Buttons read as physical the same way: rounded bevel, **top specular highlight**, **bottom occlusion shadow**, and a pressed state that *insets* (darken + nudge down + shrink the top highlight) rather than just scaling. The Spin button is the hero — largest, most saturated, glowing ring. The win counter uses metallic/gem numerals (gradient fill + glow), and jackpot meters are tiered (Mini/Minor/Major/Grand) with distinct color-coded metal/gem frames. Keep one ornament language and corner radius across the whole shell so it reads as a crafted set.

Apply `makePanel` under the balance/win/bet displays below in place of their flat `roundRect` backgrounds.

## Spin button (complete states)

```javascript
class SpinButton {
  constructor(x, y, theme) {
    this.container = new Container();
    this.container.x = x; this.container.y = y;
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this._theme = theme;
    this.state = 'idle';
    this._buildLayers();
    this._bindEvents();
  }

  _buildLayers() {
    const r = 36; // radius

    // Outer glow
    this.glow = makeGlowLayer(r * 3, r * 3, this._theme.frameGlow ?? 0xf5c842, 0.6, 28);
    this.glow.x = 0; this.glow.y = 0;
    this.container.addChild(this.glow);

    // Button body
    this.body = new Graphics();
    this.body.circle(0, 0, r).fill({ fill: makeVerticalGradient(this._theme.spinFill, r * 2) });
    this.body.circle(0, 0, r).stroke({ width: 3, color: this._theme.spinStroke ?? 0xfff5d6 });
    this.container.addChild(this.body);

    // Inner gloss highlight
    this.gloss = new Graphics();
    this.gloss.ellipse(0, -r * 0.4, r * 0.6, r * 0.22).fill({ color: 0xffffff, alpha: 0.45 });
    this.container.addChild(this.gloss);

    // Label
    this.label = new Text({ text: 'SPIN', style: {
      fontFamily: 'system-ui', fontSize: 20, fontWeight: '900',
      letterSpacing: 2, fill: this._theme.spinLabel ?? 0x1a0804,
    }});
    this.label.anchor.set(0.5);
    this.container.addChild(this.label);

    // Idle glow pulse
    this._idleTween = gsap.to(this.glow.scale, {
      x: 1.2, y: 1.2, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut',
    });
  }

  _bindEvents() {
    this.container.on('pointerdown', () => this._onPress());
    this.container.on('pointerup', () => this._onRelease());
    this.container.on('pointertap', () => this.emit('spin'));
  }

  _onPress() {
    gsap.to(this.container.scale, { x: 0.9, y: 0.9, duration: 0.08, ease: 'power2.in' });
    gsap.to(this.body, { pixi: { brightness: 0.8 }, duration: 0.08 });
  }
  _onRelease() {
    gsap.to(this.container.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(2.5)' });
    gsap.to(this.body, { pixi: { brightness: 1 }, duration: 0.15 });
  }

  setSpinning() {
    this.container.eventMode = 'none';
    this.label.text = '■';  // stop icon
    this.container.alpha = 0.85;
    this._idleTween?.pause();
  }

  setIdle() {
    this.container.eventMode = 'static';
    this.label.text = 'SPIN';
    this.container.alpha = 1;
    this._idleTween?.resume();
  }

  emit(type) { /* hook to external handler */ }
}
```

## Balance + win display

```javascript
class BalanceDisplay {
  constructor(x, y, theme) {
    this.container = new Container();
    this.container.x = x; this.container.y = y;
    this._value = 0;
    this._buildUI(theme);
  }

  _buildUI(theme) {
    const panel = new Graphics();
    panel.roundRect(-60, -18, 120, 36, 8).fill({ fill: makeVerticalGradient(['#1a1020','#0a0810'], 36) });
    panel.roundRect(-60, -18, 120, 36, 8).stroke({ width: 1.5, color: theme.frameStroke ?? 0xac1eff, alpha: 0.6 });
    this.container.addChild(panel);

    this.label = new Text({ text: 'BALANCE', style: {
      fontFamily: 'system-ui', fontSize: 9, fontWeight: '700', letterSpacing: 1,
      fill: 0x8878b0, align: 'center',
    }});
    this.label.anchor.set(0.5);
    this.label.y = -8;
    this.container.addChild(this.label);

    this.valueText = new Text({ text: '1,000', style: {
      fontFamily: 'system-ui', fontSize: 18, fontWeight: '900',
      fill: { fill: makeVerticalGradient(['#fff5d6','#f5c842'], 20) },
    }});
    this.valueText.anchor.set(0.5);
    this.valueText.y = 6;
    this.container.addChild(this.valueText);
  }

  setValue(v) {
    this._value = v;
    this.valueText.text = Math.round(v).toLocaleString();
  }

  animateDelta(delta) {
    const target = { v: this._value };
    gsap.to(target, {
      v: this._value + delta, duration: 0.4, ease: 'power2.out',
      onUpdate: () => { this.valueText.text = Math.round(target.v).toLocaleString(); },
      onComplete: () => { this._value += delta; },
    });
  }
}
```

## Win counter with rollup animation

```javascript
class WinDisplay extends BalanceDisplay {
  showWin(amount, duration = 2.0) {
    const obj = { v: 0 };
    this.valueText.text = '0';

    // Speed: fast then slows to final value
    gsap.to(obj, {
      v: amount,
      duration,
      ease: 'power2.out',
      onUpdate: () => { this.valueText.text = Math.round(obj.v).toLocaleString(); },
    });

    // Pulse the panel during rollup
    gsap.to(this.container.scale, {
      x: 1.08, y: 1.08,
      duration: 0.2, yoyo: true, repeat: Math.floor(duration / 0.4),
      ease: 'power2.inOut',
    });
  }

  clear() { this.valueText.text = '—'; }
}
```

## Bet selector

```javascript
class BetSelector {
  constructor(x, y, bets, defaultIndex, theme) {
    this.bets    = bets;
    this.index   = defaultIndex;
    this.container = new Container();
    this.container.x = x; this.container.y = y;
    this._buildUI(theme);
  }

  _buildUI(theme) {
    this._buildArrow(-52, '‹', () => this.change(-1));
    this._buildArrow( 52, '›', () => this.change(1));

    this.display = new Text({ text: this.bets[this.index].toString(), style: {
      fontFamily: 'system-ui', fontSize: 22, fontWeight: '900',
      fill: { fill: makeVerticalGradient(['#fff5d6','#f5c842'], 28) },
    }});
    this.display.anchor.set(0.5);
    this.container.addChild(this.display);
  }

  _buildArrow(x, symbol, onTap) {
    const btn = new Container();
    btn.x = x;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    const bg = new Graphics().circle(0, 0, 18).fill({ color: 0x2a1a40, alpha: 0.8 });
    bg.circle(0, 0, 18).stroke({ width: 1.5, color: 0xac1eff, alpha: 0.6 });
    const label = new Text({ text: symbol, style: { fontFamily: 'system-ui', fontSize: 20, fontWeight: '900', fill: 0xffffff }});
    label.anchor.set(0.5);
    btn.addChild(bg, label);
    btn.on('pointertap', () => { onTap(); this._bounce(btn); });
    this.container.addChild(btn);
  }

  _bounce(btn) {
    gsap.fromTo(btn.scale, { x: 0.85, y: 0.85 }, { x: 1, y: 1, duration: 0.2, ease: 'back.out(3)' });
  }

  change(dir) {
    this.index = Math.max(0, Math.min(this.bets.length - 1, this.index + dir));
    this.display.text = this.bets[this.index].toString();
    this.dispatchEvent?.(new CustomEvent('betChange', { detail: { bet: this.bets[this.index] }}));
  }

  get currentBet() { return this.bets[this.index]; }
}
```

## Free spins overlay

```javascript
function buildFreeSpinsOverlay(app, theme) {
  const overlay = new Container();

  // Badge: "FREE SPINS" text in top-center
  const badge = new Container();
  const badgeBg = new Graphics().roundRect(-60, -16, 120, 32, 8)
    .fill({ fill: makeVerticalGradient(['#ffea66','#ff7b1b'], 32) })
    .roundRect(-60, -16, 120, 32, 8).stroke({ width: 2, color: 0xfff5d6 });
  const badgeText = new Text({ text: 'FREE SPINS', style: {
    fontFamily: 'system-ui', fontSize: 14, fontWeight: '900', letterSpacing: 2,
    fill: 0x2a1808,
  }});
  badgeText.anchor.set(0.5);
  badge.addChild(badgeBg, badgeText);
  badge.x = app.screen.width / 2;
  badge.y = 50;

  // Spins remaining counter
  const counter = new Text({ text: '10', style: {
    fontFamily: 'system-ui', fontSize: 48, fontWeight: '900',
    fill: { fill: makeVerticalGradient(['#fff5d6','#ffea66','#c48a1a'], 60) },
  }});
  counter.anchor.set(0.5);
  counter.x = app.screen.width / 2;
  counter.y = 90;

  // Win accumulator
  const accumText = new Text({ text: 'WIN: 0', style: {
    fontFamily: 'system-ui', fontSize: 20, fontWeight: '700', fill: 0xffea66,
  }});
  accumText.anchor.set(0.5);
  accumText.x = app.screen.width / 2;
  accumText.y = 130;

  overlay.addChild(badge, counter, accumText);
  overlay.update = (spinsLeft, totalWin) => {
    counter.text = spinsLeft.toString();
    accumText.text = `WIN: ${totalWin.toLocaleString()}`;
    gsap.fromTo(counter.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' });
  };

  return overlay;
}
```

## Loading screen

```javascript
function buildLoadingScreen(app, gameName, theme) {
  const screen = new Container();
  const bg = new Graphics().rect(0, 0, app.screen.width, app.screen.height)
    .fill({ fill: makeVerticalGradient(theme.chassisOuter, app.screen.height) });
  screen.addChild(bg);

  // Title
  const title = new Text({ text: gameName.toUpperCase(), style: {
    fontFamily: 'system-ui', fontSize: 32, fontWeight: '900', letterSpacing: 4,
    fill: { fill: makeVerticalGradient(theme.titleGradient ?? ['#fff5d6','#f5c842'], 40) },
  }});
  title.anchor.set(0.5);
  title.x = app.screen.width / 2;
  title.y = app.screen.height * 0.35;
  screen.addChild(title);

  // Progress bar
  const barBg = new Graphics().roundRect(-120, -8, 240, 16, 8).fill({ color: 0x2a1a40, alpha: 0.8 });
  const barFill = new Graphics();
  barBg.x = barFill.x = app.screen.width / 2;
  barBg.y = barFill.y = app.screen.height * 0.55;
  screen.addChild(barBg, barFill);

  screen.setProgress = (pct) => {
    barFill.clear();
    barFill.roundRect(-120, -8, 240 * pct, 16, 8)
      .fill({ fill: makeVerticalGradient(theme.spinFill, 16) });
  };

  return screen;
}
```

## Repo placement & check-in

This skill builds the UI; it does not decide where the files live in the game repo or how they get
checked in. For GameForge directory placement and Perforce (P4) check-in workflow, defer to the
`webgamedev-structure` skill.

## References

- `references/mobile-layout-patterns.md` — responsive layout math for portrait/landscape, safe areas, notch handling
- `references/paytable-screen.md` — complete paytable overlay with symbol value tables, feature rules display, navigation
- `references/jackpot-meters.md` — progressive jackpot display with continuous counter animation, tier-based styling (Mini/Minor/Major/Grand)
