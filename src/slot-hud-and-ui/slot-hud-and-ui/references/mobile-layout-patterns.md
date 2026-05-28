# Mobile Layout Patterns

Responsive layout math for slot HUDs. Portrait-primary, touch-first, notch-aware. All measurements are
CSS pixels at 1× scaled by `devicePixelRatio` for the renderer.

## Canvas sizing

Let the canvas fill the viewport and drive the renderer from CSS size × DPR:

```javascript
function fitRenderer(app) {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);   // cap at 3 for perf
  app.renderer.resolution = dpr;
  app.renderer.resize(w, h);
  layout(app, w, h);                                        // re-place HUD
}
window.addEventListener('resize', () => fitRenderer(app));
```

Cap DPR at 3 — beyond that you pay fill-rate cost on Android for no visible gain.

## Region model

Lay the screen out as stacked bands with one flex-fill reel region. Compute band heights from screen
height, clamp to min/max:

```
JACKPOT METERS   clamp(48, 8%, 80)     (optional)
HEADER/TITLE     64
REELS            flex-fill
WIN | BALANCE    48
BET / SPIN       96   (spin button 72 diameter)
SECONDARY        44   (auto / info / turbo / max)
```

```javascript
function layout(app, w, h) {
  const safe = getSafeArea();                 // see below
  let y = safe.top;
  const place = (region, band) => { region.y = y; region.x = w/2; y += band; };

  if (jackpotMeters) place(jackpotMeters, clamp(48, h*0.08, 80));
  place(header, 64);
  const footer = 96 + 44 + 48;                // bet+spin + secondary + win/balance
  const reelH = h - y - footer - safe.bottom;
  reels.layoutInto(w, reelH, y); y += reelH;
  place(winBalanceRow, 48);
  place(betSpinRow, 96);
  place(secondaryRow, 44);
}
```

## Safe areas / notch

Read CSS env() safe-area insets and keep interactive elements out of them:

```css
:root {
  --sat: env(safe-area-inset-top);
  --sab: env(safe-area-inset-bottom);
}
```

```javascript
function getSafeArea() {
  const s = getComputedStyle(document.documentElement);
  const px = v => parseFloat(s.getPropertyValue(v)) || 0;
  return { top: px('--sat'), bottom: px('--sab') };
}
```

The bottom inset matters most — the spin button must never sit under the iOS home indicator.

## Touch targets

- **Minimum 44×44pt** for every interactive element (Apple HIG / Android both converge here).
- **8pt minimum spacing** between adjacent targets so fat-finger taps don't cross.
- Hit areas can exceed the visual: set `container.hitArea = new Rectangle(...)` larger than the sprite.

```javascript
spinButton.hitArea = new Circle(0, 0, 44);   // visual radius may be 36
```

## Portrait vs landscape

Detect orientation and switch layouts rather than scaling one to fit:

```javascript
const isPortrait = h >= w;
if (isPortrait) layoutPortrait(); else layoutLandscape();
```

- **Portrait** (primary): vertical band stack as above; reels typically 5×3 fill width.
- **Landscape**: move bet/balance to the sides of the reels, spin button bottom-right within thumb
  reach; header collapses into a corner.

## Scaling strategy

Design at a 360×640 reference and scale the whole HUD container by `min(w/360, h/640)` for a quick
responsive pass, then nudge anchored elements (spin button, safe-area-bound items) individually. Avoid
scaling text below ~11px — re-flow instead.

## Reduced motion

Respect `prefers-reduced-motion`: cut idle pulses and screen shake, keep functional feedback.

```javascript
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
```

Pairs with `particle-systems-and-juice` (gate heavy juice) and `slot-symbol-animation-states` (gate
idle breathing) on the same flag.
