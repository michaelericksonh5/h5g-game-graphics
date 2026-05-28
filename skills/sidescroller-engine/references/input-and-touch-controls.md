# Input and Touch Controls

Mobile-first input for 2D arcade games. The virtual joystick and action buttons are drawn entirely in PixiJS Graphics — no external images. Multitouch is handled via pointer events so the joystick and buttons fire independently. Desktop keyboard maps onto the same `InputState` object so systems never query hardware directly.

## InputState — the shared data surface

All systems read from this object. Nothing reads raw events inside game logic.

```javascript
// input-state.js
export const InputState = {
  /** Normalized axis -1..1. Combines joystick and keyboard. */
  axis: { x: 0, y: 0 },

  /** Button states — true while held */
  jump:   false,
  attack: false,
  pause:  false,

  /** Internal: prevent repeat fire on the same press */
  _jumpConsumed:   false,
  _attackConsumed: false,
  _pauseConsumed:  false,

  /**
   * Returns true once per press. Call from the system that handles jump.
   * Resets the consumed flag when the button is released.
   */
  consumeJump() {
    if (this.jump && !this._jumpConsumed) {
      this._jumpConsumed = true;
      return true;
    }
    if (!this.jump) this._jumpConsumed = false;
    return false;
  },

  consumeAttack() {
    if (this.attack && !this._attackConsumed) {
      this._attackConsumed = true;
      return true;
    }
    if (!this.attack) this._attackConsumed = false;
    return false;
  },

  consumePause() {
    if (this.pause && !this._pauseConsumed) {
      this._pauseConsumed = true;
      return true;
    }
    if (!this.pause) this._pauseConsumed = false;
    return false;
  },
};
```

## Virtual joystick drawn in PixiJS Graphics

No sprite assets — everything is drawn with the Graphics API. The joystick base is a translucent ring; the knob is a filled circle that moves within a radius.

```javascript
// virtual-joystick.js
import { Graphics, Container } from 'pixi.js';

const BASE_RADIUS = 60;   // outer ring radius in CSS pixels
const KNOB_RADIUS = 28;   // movable knob radius
const MAX_DIST    = BASE_RADIUS - KNOB_RADIUS; // max knob travel

export class VirtualJoystick {
  /**
   * @param {Container} stage — the PixiJS Container to add this to
   * @param {{ x: number, y: number }} anchor — bottom-left position
   * @param {object} inputState — reference to InputState.axis
   */
  constructor(stage, anchor, inputState) {
    this._input   = inputState;
    this._pointerId = null;
    this._origin  = { x: anchor.x + BASE_RADIUS + 16, y: anchor.y - BASE_RADIUS - 16 };
    this._knob    = { x: 0, y: 0 };

    this._container = new Container();
    this._container.position.set(this._origin.x, this._origin.y);
    stage.addChild(this._container);

    this._base = new Graphics();
    this._drawBase();
    this._container.addChild(this._base);

    this._knobGfx = new Graphics();
    this._drawKnob(0, 0);
    this._container.addChild(this._knobGfx);

    // Hit area is larger than visual — 44pt minimum per iOS HIG
    // BASE_RADIUS*2 = 120px which already exceeds 44pt; leave as-is
    this._base.eventMode = 'static';
    this._base.hitArea   = { contains: (x, y) =>
      x * x + y * y < (BASE_RADIUS + 16) * (BASE_RADIUS + 16)
    };

    this._base.on('pointerdown',  e => this._onDown(e));
    this._base.on('pointermove',  e => this._onMove(e));
    this._base.on('pointerup',    e => this._onUp(e));
    this._base.on('pointerupoutside', e => this._onUp(e));
  }

  _drawBase() {
    this._base.clear();
    // Outer ring
    this._base.circle(0, 0, BASE_RADIUS)
      .stroke({ color: 0xffffff, alpha: 0.25, width: 3 });
    // Inner fill — very translucent
    this._base.circle(0, 0, BASE_RADIUS)
      .fill({ color: 0xffffff, alpha: 0.08 });
  }

  _drawKnob(dx, dy) {
    this._knobGfx.clear();
    this._knobGfx.circle(dx, dy, KNOB_RADIUS)
      .fill({ color: 0xffffff, alpha: 0.45 });
    this._knobGfx.circle(dx, dy, KNOB_RADIUS)
      .stroke({ color: 0xffffff, alpha: 0.7, width: 2 });
  }

  _onDown(e) {
    if (this._pointerId !== null) return; // already tracking
    this._pointerId = e.pointerId;
    this._updateFromEvent(e);
    this._base.cursor = 'none';
  }

  _onMove(e) {
    if (e.pointerId !== this._pointerId) return;
    this._updateFromEvent(e);
  }

  _onUp(e) {
    if (e.pointerId !== this._pointerId) return;
    this._pointerId = null;
    this._input.axis.x = 0;
    this._input.axis.y = 0;
    this._drawKnob(0, 0);
  }

  _updateFromEvent(e) {
    const local = this._container.toLocal(e.global);
    const dist  = Math.sqrt(local.x * local.x + local.y * local.y);
    const clamped = Math.min(dist, MAX_DIST);
    const angle   = Math.atan2(local.y, local.x);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;

    this._input.axis.x = kx / MAX_DIST; // -1..1
    this._input.axis.y = ky / MAX_DIST;
    this._drawKnob(kx, ky);
  }
}
```

## Action buttons drawn in PixiJS Graphics

Each button is a rounded rectangle with a label. Touch target is at least 44 pt (88 CSS px on 2x). Buttons track their own pointer ID for independence from the joystick.

```javascript
// action-button.js
import { Graphics, Text, Container } from 'pixi.js';

const BTN_W  = 88;  // width in CSS px — meets 44pt minimum at 1x
const BTN_H  = 88;
const RADIUS = 20;

export class ActionButton {
  /**
   * @param {Container}  stage
   * @param {{ x, y }}   position — center of button
   * @param {string}     label    — single character or short string
   * @param {number}     color    — fill color (0xRRGGBB)
   * @param {function}   onPress  — called on each press
   * @param {function}   onRelease
   */
  constructor(stage, position, label, color, onPress, onRelease) {
    this._onPress   = onPress;
    this._onRelease = onRelease;
    this._held      = false;
    this._pointerId = null;

    this._container = new Container();
    this._container.position.set(position.x, position.y);
    stage.addChild(this._container);

    this._bg = new Graphics();
    this._drawIdle(color);
    this._container.addChild(this._bg);

    this._label = new Text({
      text: label,
      style: { fill: 0xffffff, fontSize: 28, fontWeight: 'bold', fontFamily: 'sans-serif' },
    });
    this._label.anchor.set(0.5);
    this._container.addChild(this._label);

    this._color = color;
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown',       e => this._onDown(e));
    this._bg.on('pointerup',         e => this._onUp(e));
    this._bg.on('pointerupoutside',  e => this._onUp(e));
  }

  _drawIdle(color) {
    this._bg.clear();
    this._bg.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, RADIUS)
      .fill({ color, alpha: 0.55 });
    this._bg.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, RADIUS)
      .stroke({ color: 0xffffff, alpha: 0.4, width: 2 });
  }

  _drawPressed(color) {
    this._bg.clear();
    this._bg.roundRect(-BTN_W / 2 + 2, -BTN_H / 2 + 2, BTN_W - 4, BTN_H - 4, RADIUS)
      .fill({ color, alpha: 0.85 });
    this._bg.roundRect(-BTN_W / 2 + 2, -BTN_H / 2 + 2, BTN_W - 4, BTN_H - 4, RADIUS)
      .stroke({ color: 0xffffff, alpha: 0.7, width: 2 });
  }

  _onDown(e) {
    if (this._pointerId !== null) return;
    this._pointerId = e.pointerId;
    this._held = true;
    this._drawPressed(this._color);
    this._onPress?.();
  }

  _onUp(e) {
    if (e.pointerId !== this._pointerId) return;
    this._pointerId = null;
    this._held = false;
    this._drawIdle(this._color);
    this._onRelease?.();
  }

  get held() { return this._held; }
}
```

## Assembling the touch overlay

```javascript
// touch-overlay.js
import { Container } from 'pixi.js';
import { VirtualJoystick } from './virtual-joystick.js';
import { ActionButton }    from './action-button.js';
import { InputState }      from './input-state.js';

export function buildTouchOverlay(stage, stageW, stageH) {
  const layer = new Container();
  stage.addChild(layer);

  // Joystick — bottom left
  const joystick = new VirtualJoystick(
    layer,
    { x: 20, y: stageH - 20 },
    InputState.axis
  );

  // Jump button — bottom right
  const jumpBtn = new ActionButton(
    layer,
    { x: stageW - 110, y: stageH - 110 },
    'A', 0x2266ff,
    () => { InputState.jump = true;  },
    () => { InputState.jump = false; }
  );

  // Attack button — right of jump
  const attackBtn = new ActionButton(
    layer,
    { x: stageW - 30, y: stageH - 175 },
    'B', 0xff3322,
    () => { InputState.attack = true;  },
    () => { InputState.attack = false; }
  );

  // Show/hide based on touch capability
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  layer.visible = isTouchDevice;

  return { layer, joystick, jumpBtn, attackBtn };
}
```

## Multitouch via pointer events

PixiJS routes touch events through the Pointer Events API automatically. Each touch is a separate `pointerId`. The joystick and each button track their own `_pointerId` so pressing a button while holding the joystick works correctly — they never steal each other's event streams.

Key rules for multitouch:
- Always store the `pointerId` on `pointerdown` and validate on subsequent `pointermove`/`pointerup`.
- Never use `pointerenter`/`pointerleave` for game controls — they fire on element bounds, not finger lift.
- Use `pointerupoutside` on PixiJS interactive objects to catch releases that happen when a finger drags off the element.

## Keyboard mapping for desktop

Map keyboard to the same `InputState` so systems stay device-agnostic.

```javascript
// keyboard-input.js
import { InputState } from './input-state.js';

const KEY_MAP = {
  ArrowLeft:  () => { InputState.axis.x -= 1; },
  ArrowRight: () => { InputState.axis.x += 1; },
  ArrowUp:    () => { InputState.axis.y -= 1; },
  ArrowDown:  () => { InputState.axis.y += 1; },
  KeyZ:       () => { InputState.jump   = true; },
  Space:      () => { InputState.jump   = true; },
  KeyX:       () => { InputState.attack = true; },
  KeyP:       () => { InputState.pause  = true; },
  Escape:     () => { InputState.pause  = true; },
};

const KEY_RELEASE = {
  ArrowLeft:  () => { if (InputState.axis.x < 0) InputState.axis.x = 0; },
  ArrowRight: () => { if (InputState.axis.x > 0) InputState.axis.x = 0; },
  ArrowUp:    () => { if (InputState.axis.y < 0) InputState.axis.y = 0; },
  ArrowDown:  () => { if (InputState.axis.y > 0) InputState.axis.y = 0; },
  KeyZ:       () => { InputState.jump   = false; },
  Space:      () => { InputState.jump   = false; },
  KeyX:       () => { InputState.attack = false; },
  KeyP:       () => { InputState.pause  = false; },
  Escape:     () => { InputState.pause  = false; },
};

export function installKeyboard() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return; // ignore held-key repeat events
    KEY_MAP[e.code]?.();
  });
  window.addEventListener('keyup', e => {
    KEY_RELEASE[e.code]?.();
  });
}
```

When arrow keys and WASD are both needed, duplicate entries in the maps for `KeyW`, `KeyA`, `KeyS`, `KeyD`.

## Gamepad API primer

For completeness — not required on mobile. Poll in the fixed-update loop (Gamepad API is polling, not event-driven):

```javascript
// gamepad-input.js
import { InputState } from './input-state.js';

const DEAD_ZONE = 0.12;

export function pollGamepad() {
  const pads = navigator.getGamepads();
  if (!pads) return;
  const pad = pads[0]; // first connected gamepad
  if (!pad || !pad.connected) return;

  const lx = pad.axes[0]; // left stick horizontal
  const ly = pad.axes[1]; // left stick vertical
  InputState.axis.x = Math.abs(lx) > DEAD_ZONE ? lx : 0;
  InputState.axis.y = Math.abs(ly) > DEAD_ZONE ? ly : 0;

  // Button 0 = A (Xbox) / X (PS), Button 2 = X / Square
  InputState.jump   = pad.buttons[0]?.pressed ?? false;
  InputState.attack = pad.buttons[2]?.pressed ?? false;
  InputState.pause  = pad.buttons[9]?.pressed ?? false; // Start/Options
}
```

Call `pollGamepad()` as the first step of the input-flush phase, before `playerSystem`.

## Touch target sizing

iOS HIG requires 44 pt minimum touch target. On a 2x device that is 88 CSS px. The `ActionButton` class uses `BTN_W = BTN_H = 88` to meet this minimum at any density.

For the joystick, the base ring is 120 CSS px in diameter (60 px radius) and the hit area extends to 152 px — well above the minimum. Never shrink the joystick base below 80 CSS px diameter.

Do not overlap touch targets. Place the joystick bottom-left and buttons bottom-right with at least 20 CSS px gap between them in portrait mode. In landscape on a phone, the safe area is narrower — check `window.screen.width` and scale down proportionally if needed.

## Common input bugs

**"Jump fires repeatedly while button held."** You are reading `InputState.jump` directly instead of `consumeJump()`. Use the consume method — it returns true only on the first call per press, then blocks until the button is released.

**"Joystick locks up when a second finger touches it."** The joystick grabs the first `pointerId` on `pointerdown`. A second touch fires `pointerdown` again but the guard `if (this._pointerId !== null) return` prevents hijacking. Verify the guard is in place.

**"Keyboard diagonal movement is twice as fast as cardinal."** You are adding 1 to axis without clamping. After applying all key states, normalize the axis vector: `const len = Math.sqrt(axis.x**2 + axis.y**2); if (len > 1) { axis.x /= len; axis.y /= len; }`.

**"Buttons disappear in landscape orientation."** The overlay is positioned using `stageH` at init time. Re-call `buildTouchOverlay` (or reposition buttons) inside a `resize` handler.

**"Pause input fires every frame while Escape is held."** Use `consumePause()` in the scene stack's update method. It returns true once per press.
