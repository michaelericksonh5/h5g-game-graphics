# Jackpot Meters

A progressive jackpot meter is a *display* of a value that ticks upward. This file covers rendering the
meter and animating the counter. **The jackpot odds, contribution rate, and seed/reset values are
regulated math owned by `h5g-slot-math`** (`probability-model`, `internal-h5g-evidence` for RMG/
jurisdiction rules) — this component only shows a number it is told.

## Tiered meters

Standard four-tier progressive (Mini / Minor / Major / Grand), each its own styled bar:

```javascript
const TIERS = [
  { key:'MINI',  label:'MINI',  palette:['#7fd8ff','#2aa8e0'] },
  { key:'MINOR', label:'MINOR', palette:['#9bff8f','#34c759'] },
  { key:'MAJOR', label:'MAJOR', palette:['#ffd35a','#ff9500'] },
  { key:'GRAND', label:'GRAND', palette:['#ff7ad9','#ff2d8e'] },
];

function buildJackpotMeters(width, theme) {
  const bar = new Container();
  TIERS.forEach((tier, i) => bar.addChild(makeMeter(tier, i, width)));
  return bar;
}
```

Grand is visually dominant (largest, most glow); Mini smallest. Stack vertically in portrait, row in
landscape.

## Continuous counter animation

A progressive should look alive — increment smoothly between server pushes rather than jumping:

```javascript
class JackpotCounter {
  constructor(textNode) { this.text = textNode; this._display = 0; this._target = 0; this._rate = 0; }

  // Called when a fresh authoritative value arrives.
  setTarget(value, nextTickSeconds = 1) {
    this._target = value;
    this._rate = Math.max(0, (value - this._display)) / nextTickSeconds;  // per second toward target
  }

  update(dt) {
    if (this._display < this._target) {
      this._display = Math.min(this._target, this._display + this._rate * dt);
      this.text.text = Math.floor(this._display).toLocaleString();
    }
  }
}
// Drive update(dt) from the PixiJS ticker.
```

The displayed value is purely cosmetic interpolation toward the **authoritative** server/engine value.
Never let the display *lead* the real value in a real-money context — only smooth toward known values.

## Win reveal

When a jackpot is hit:

1. Freeze the meter, flash its bar (gold/white, 3× pulse).
2. Full-screen takeover banner with the tier name + the won amount rolling up.
3. Reset the meter to its seed value with a quick fade (the seed is math-authority data).

```javascript
async function revealJackpot(meter, amount) {
  await pulse(meter.bar, 3);
  const banner = makeJackpotBanner(meter.tier, amount, meter.theme);
  stage.addChild(banner);
  rollup(banner.value, 0, amount, 2.5);     // reuse WinDisplay rollup easing
  await delay(4000);
  banner.destroy();
}
```

## Styling for "valuable"

- Metallic gradient fill + inner gloss (see `slot-art-style-presets` palette tokens).
- A slow shimmer sweep across the Grand meter to draw the eye.
- Comma-grouped numerals, currency symbol per locale.
- Subtle glow that intensifies as the value grows (optional, cosmetic only).

## Math authority boundary

> Do **not** compute or hardcode jackpot trigger odds, the contribution percentage, or the seed/reset
> amount here. For regulated progressives those are certification-gated. Route to
> `h5g-slot-math:probability-model` (odds), `h5g-slot-math:internal-h5g-evidence` (RMG/jurisdiction
> process), and treat any number this component shows as data supplied by the verified engine/server.
