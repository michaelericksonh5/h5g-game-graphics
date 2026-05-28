---
name: game-qa-and-testing
description: "Test and QA a generated HTML5 slot/arcade game before calling it done — performance (60fps, frame budget, draw calls), visual quality sign-off (the \"did an artist make this?\" rubric), cross-device/browser checks, and functional smoke tests of the spin→win→bonus loop. Use this LAST in any game build, or whenever the user says \"test the game\", \"does it run at 60fps\", \"QA this\", \"check performance\", \"review the slot\", \"is it ready to ship\", \"sign off\", or reports a visual/perf bug. This skill verifies the OUTPUT of the other graphics skills; it defers slot-MATH correctness (RTP/odds) to the h5g-slot-math suite and deep ART-ASSET review to the slot-art-qa-reviewer agent. Load alongside the rest of the Graphics suite."
---

# Game QA and Testing

The suite builds a game; this skill proves it's actually good before sign-off. "It renders without a
console error" is not done. A slot is done when it holds 60fps on a mid-range phone, the spin→win→bonus
loop works, and it passes the visual rubric ("did you hire an artist?", not "did a computer make this?").

## The QA mandate

**Never report a game build as complete without running this QA pass.** Building UI/visual code is not
the same as verifying it works — type-checking and a clean console verify code correctness, not *game*
correctness. If you cannot actually run the game (no Preview/browser tool available), say so explicitly
rather than claiming success.

## What this skill owns vs. defers

| Concern | Owner |
|---|---|
| 60fps / frame budget / draw calls / load time | **this skill** (`references/performance-checklist.md`) |
| Visual quality sign-off (RED/YELLOW/GREEN) | **this skill** (`references/visual-qa-rubric.md`) |
| Functional smoke test (spin/win/bonus/audio) | **this skill** (below) |
| Cross-device / browser / orientation coverage | **this skill** (`references/device-test-matrix.md`) |
| How to drive the verification tools | **this skill** (`references/preview-tooling.md`) |
| RTP / hit-frequency / odds / math correctness | **h5g-slot-math** (rtp-verification) — do NOT re-derive here |
| Deep per-asset art critique | **slot-art-qa-reviewer** agent (if available) |

This skill is the *gameplay/runtime* QA gate. It checks that the math the engine was given runs and
pays plausibly (a smoke test, see `slot-state-machine`), not whether the math is *certified* — that is
h5g-slot-math's job.

## The QA loop

Run this loop before sign-off, and again after any change that touches rendering, timing, or audio:

1. **Launch** the game in a real runtime (Preview MCP or Chrome MCP — see `references/preview-tooling.md`).
   A static read of the code is not QA.
2. **Console gate** — zero uncaught errors, zero failed asset/network loads, no `await Tone.start()`
   warnings. A red console fails QA immediately.
3. **Functional smoke** — drive the golden path *and* edge cases (next section).
4. **Performance** — measure FPS during a spin and during a big-win celebration (the worst frame). Apply
   `references/performance-checklist.md`. Verify on a throttled/mobile profile, not just desktop.
5. **Visual sign-off** — screenshot key states and grade against `references/visual-qa-rubric.md`. RED or
   YELLOW means iterate; only GREEN ships.
6. **Device matrix** — confirm the critical cells in `references/device-test-matrix.md` (portrait phone
   first).
7. **Report** — state what was tested, the FPS numbers, the visual grade, and any blockers. Do not claim
   "60fps" or "works" without having observed it.

## Functional smoke test — golden path + edges

Drive these and confirm each emits the right visual + audio + state transition:

- **Audio unlock**: first tap actually starts the AudioContext (state `running`); sound plays after.
- **Golden spin**: bet → spin → reels stagger-stop → no win → returns to IDLE, balance debited once.
- **Winning spin**: win lines highlight, counter rolls up, audio tier matches win size, balance credited.
- **Anticipation**: 2 scatters landed → last reel slows/holds + anticipation stinger fires.
- **Bonus trigger**: 3rd scatter → fanfare + free-spins entry; free spins decrement; total accumulates;
  clean return to base game.
- **Rapid input / stop-on-tap**: spamming spin doesn't double-debit, desync reels, or stack overlays.
- **Backgrounding**: tab-away during a spin and return → audio resumes, no stuck state (see
  `tonejs-game-audio` mobile-audio-quirks).
- **Insufficient balance**: spin with balance < bet → blocked gracefully, no negative balance.

Any desync, double-debit, stuck overlay, or silent failure is a blocker, not a polish item.

## Performance targets (summary)

| Metric | Target (mid-range phone) | Fail |
|---|---|---|
| Steady-state FPS (idle/spin) | 60 | sustained < 55 |
| Worst-frame FPS (big-win + particles) | ≥ 50 | dips < 40 or visible hitch |
| Frame budget | ≤ 16.6ms | any frame > 20ms during normal play |
| Draw calls (PixiJS/Three) | < 100 | climbing over time (leak) |
| First interaction ready | < 3s | > 5s |
| Memory over a 5-min session | flat | climbing (texture/synth leak) |

Full method, profiling, and the triage order are in `references/performance-checklist.md`.

## Visual sign-off (summary)

Grade each key state (base reels, a win, the bonus screen, the loading screen) RED / YELLOW / GREEN
against `references/visual-qa-rubric.md`. The headline checks: symbols readable at 70px and distinct in
silhouette; consistent theme palette (from `slot-art-style-presets`); no flat `MeshBasicMaterial`/raw
box edges in 3D; win celebration reads as a payoff, not a flicker; nothing looks like placeholder
programmer-art. GREEN only when it would survive "did you hire an artist?".

**Two automatic RED fails** (the most common "a computer made this" tells, enforce strictly):

- **Emoji or stock Unicode pictographs used as symbols** (🐉 🦈 🔔 👑 ☥). Symbols must be drawn in code
  and material-shaded (`procedural-symbol-design`). Render-difference across devices = not shippable.
- **Flat fills / 2-stop gradients with no material or lighting.** Premium surfaces show sculpted relief:
  key + fill + **rim** light, a material (gold/gem/stone), and AO in crevices
  (`procedural-textures-and-materials/references/sculpted-relief-shading.md`). A glossy-vector look that
  never answers "where is the light / what material is this / how does it sit in depth" caps at YELLOW.

When QA finds either, the fix is to send the asset back through the owning skill (symbol → symbol-design,
panel → hud-and-ui, material/shader → textures or shaders) and re-grade — QA reviews *and drives the
adjustment*, it doesn't just report.

## References

- `references/performance-checklist.md` — how to measure FPS, frame budget, draw calls, memory; mobile throttling; triage order when frames drop
- `references/visual-qa-rubric.md` — RED/YELLOW/GREEN visual sign-off rubric and the per-state checks
- `references/device-test-matrix.md` — device/browser/orientation cells to cover, priority order, what each catches
- `references/preview-tooling.md` — driving the Preview MCP / Chrome MCP tools to launch, screenshot, read console, and profile a generated game
