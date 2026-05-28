# Device & Browser Test Matrix

Slot players are overwhelmingly on phones, and the long tail of devices is where "works on my machine"
games break. This is the coverage matrix for sign-off: which cells to test, in what priority, and what
each cell uniquely catches. You will rarely have every physical device — so this also says which cells
are non-negotiable (test even if only emulated/throttled) and which are nice-to-have.

## Priority order

Test top-to-bottom; stop-the-line if a P0 cell fails.

| Pri | Cell | Why it's here |
|---|---|---|
| **P0** | Mobile portrait, mid-range Android, Chrome | the median real player; the 60fps target device |
| **P0** | Mobile portrait, iPhone, Safari | strictest Web Audio rules + safe-area/notch |
| **P0** | Audio unlock on first tap (both above) | silent-fail is the #1 mobile audio bug |
| **P1** | Mobile landscape (both) | layout reflow, reels resize, UI doesn't clip |
| **P1** | Low-end Android (4× CPU throttle) | proves the perf floor, not just the median |
| **P2** | Desktop Chrome, large viewport | scaling up, mouse vs touch input |
| **P2** | iPad / tablet portrait + landscape | in-between layout, larger safe area |
| **P3** | Desktop Safari / Firefox | WebGPU→WebGL fallback, codec/audio quirks |

## What each cell uniquely catches

- **iPhone Safari**: AudioContext requires a direct gesture and won't resume after backgrounding without
  help; the mute switch silences Web Audio (see `tonejs-game-audio/references/mobile-audio-quirks.md`).
  Safe-area insets / notch clip top UI if not handled.
- **Mid-range Android Chrome**: the real framerate. `devicePixelRatio` of 3+ tanks fill rate unless
  capped at 2. Thermal throttle after sustained play.
- **Landscape**: portrait-first layouts often overlap the spin bar with the reels on rotation; confirm
  the layout system (see `slot-hud-and-ui/references/mobile-layout-patterns.md`) reflows.
- **Low-end throttle**: surfaces particle/filter/shadow costs the median device hides.
- **WebGPU fallback (3D)**: a TSL shader that compiles to WGSL may differ subtly in the GLSL path —
  verify the fallback renders, not just the WebGPU path (see `threejs-game-3d`).

## Per-cell smoke (fast pass)

In each tested cell, run the abbreviated loop:
1. First tap unlocks audio (hear a sound).
2. One losing spin, one winning spin — visuals + audio + balance correct.
3. Rotate the device (mobile) — layout reflows, nothing clipped.
4. Background and return — audio resumes, no stuck state.
5. Console clean.

A full functional + performance + visual pass (per `SKILL.md`) runs on the **P0 portrait phone** cell;
other cells get the smoke pass unless one surfaces a bug.

## Orientation & safe areas

- Portrait is the primary target — design and verify there first.
- Use `env(safe-area-inset-*)` (or the layout system's equivalent) and confirm on a notched iPhone that
  jackpot meters / header aren't under the notch and the spin bar isn't under the home indicator.
- Lock or gracefully handle orientation per the game's design; if both are supported, both must pass P1.

## Emulation vs. real devices

- Emulated/throttled covers layout, most perf, and functional logic — acceptable for most cells when
  hardware isn't available.
- **Real-device-only truths**: iOS mute switch behavior, true thermal throttling, actual touch latency,
  real phone-speaker audio mix (lows roll off — see `procedural-sfx-design/references/mixing-guide.md`).
  Flag these as "verified emulated only" in the report if you couldn't test on metal.

## Reporting

List the cells covered, how (real / emulated+throttled), and the result. Be explicit about gaps:
`"P0 Android-portrait (4× throttle): pass, 58–60fps. P0 iPhone Safari: emulated only — audio unlock
verified in emulator, NOT verified on a physical mute switch."` Unverified P0 cells are blockers for a
real ship, even if everything tested passed.
