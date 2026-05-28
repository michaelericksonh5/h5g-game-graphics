# Spine Integration Path

When a slot graduates from procedurally-drawn symbols to artist-authored **Spine 2D** skeletal
symbols, the five animation states map onto named Spine animations. The state machine and event wiring
stay identical — only the *renderer* of each symbol changes. This lets you prototype with
`procedural-symbol-design` and later swap in Spine assets without touching game logic.

> For authoring, rigging review, packaging, and validation of Spine assets themselves, use the
> **spine-2-0-skills** plugin (`spine-slot-animation`, `review-spine-rigging`, `validate-spine-package`,
> `package-spine-handoff`). This file only covers the *runtime swap* in the slot.

## Animation name contract

Agree on a fixed set of animation names so code is asset-agnostic. Recommended track names:

| State | Spine animation | Loop | Track |
|---|---|---|---|
| Idle breathing | `idle` | yes | 0 |
| Landing | `land` | no | 0 (then → `idle`) |
| Win highlight | `win` | yes | 0 |
| Dimmed | `idle` + tint | yes | 0 (tint via slot color) |
| Wild expand | `expand` | no | 0 |
| Scatter trigger | `trigger` | no | 0 |
| Multiplier reveal | `reveal` | no | 1 (overlay) |

Document this contract in the game brief so riggers export exactly these names.

## Runtime: pixi-spine

PixiJS uses `pixi-spine` (or `@esotericsoftware/spine-pixi`) to render `.skel`/`.json` + atlas:

```javascript
import { Spine } from '@esotericsoftware/spine-pixi-v8';

const symbol = Spine.from({ skeleton: 'symbols.skel', atlas: 'symbols.atlas' });
symbol.state.setAnimation(0, 'idle', true);    // track 0, looping

// State changes mirror the procedural API exactly:
function setSymbolState(symbol, state) {
  switch (state) {
    case 'land':   symbol.state.setAnimation(0, 'land', false);
                   symbol.state.addAnimation(0, 'idle', true, 0); break;   // queue idle after
    case 'win':    symbol.state.setAnimation(0, 'win', true); break;
    case 'expand': symbol.state.setAnimation(0, 'expand', false); break;
    case 'idle':   symbol.state.setAnimation(0, 'idle', true); break;
  }
}
```

## Adapter so logic never changes

Wrap both renderers behind one interface; the reel/engine code calls the interface only:

```javascript
class SymbolView {            // procedural implementation
  setState(s) { /* GSAP tweens from animation-timing-table.md */ }
}
class SpineSymbolView {       // spine implementation
  constructor(spine) { this.spine = spine; }
  setState(s) { setSymbolState(this.spine, s); }
}
// Reels hold SymbolView | SpineSymbolView and call view.setState('land') etc.
```

Because the engine emits `reelStop`, `win`, `scatterTrigger` events (see `slot-state-machine`), neither
view implementation needs to know about game rules.

## Mixing (smooth transitions)

Set mix times so states blend instead of snapping:

```javascript
const data = new SpineAnimationStateData(symbol.skeleton.data);
data.defaultMix = 0.15;
data.setMix('win', 'idle', 0.25);
data.setMix('idle', 'land', 0);     // land should be instant on impact
```

## Performance on mobile

- Share one atlas across all symbols; avoid per-symbol texture swaps.
- Cap the number of simultaneously *winning* (looping `win`) skeletons; dim losers to `idle`.
- Spine meshes cost more than sprites — budget-test on a mid-range Android (see the perf guidance in
  `slot-hud-and-ui` and `pixijs-slot-graphics`).
- Keep the procedural fallback available for low-end devices or while art is in progress.

## Handoff checklist

- [ ] Animation names match the contract table above.
- [ ] Atlas is power-of-two and shared.
- [ ] Each symbol has at least `idle`, `land`, `win`.
- [ ] Special symbols (Wild/Scatter) have `expand`/`trigger`.
- [ ] Package validated via `spine-2-0-skills:validate-spine-package` before integration.
