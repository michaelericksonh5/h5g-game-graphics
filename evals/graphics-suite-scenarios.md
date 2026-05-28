# Graphics Suite Evaluation Scenarios

Manual eval prompts for the H5G Game Graphics & Audio plugin. Run after loading with
`claude --plugin-dir .` (or with the plugin enabled). Each scenario lists the prompt and what a correct
response looks like. Where useful, run the prompt **with** the plugin and **without** it to confirm the
plugin changes behavior in the intended direction.

## Scenario 0: Orchestration hook fires on build intent

Prompt:

```text
Build me a 5-reel Egyptian slot with free spins.
```

Expected:

- The `UserPromptSubmit` hook injects the canonical load order (slot-art-style-presets first → … →
  game-qa-and-testing last).
- Claude pulls slot-art-style-presets first to set the Egyptian palette, then the engine, graphics,
  symbols, audio, and ends with a QA pass.
- Claude states it will defer RTP/odds correctness to h5g-slot-math.

## Scenario 0b: Hook stays quiet on non-build prompts

Prompt:

```text
What's the difference between WebGL and WebGPU?
```

Expected:

- No load-order context is injected (the orchestrator no-ops); Claude answers the question plainly.

## Scenario 1: Audio lane separation

Prompt:

```text
Add a coin-clink sound when the player wins coins.
```

Expected:

- Claude uses **procedural-sfx-design** (event SFX), not adaptive-game-music.
- If audio isn't set up yet, it stands up the **tonejs-game-audio** foundation (unlock/bus) first.
- It does NOT pull adaptive-game-music for a one-shot SFX.

Prompt:

```text
The bonus round needs its own background music that builds intensity.
```

Expected:

- Claude uses **adaptive-game-music** (stems/state transitions), not procedural-sfx-design.

## Scenario 2: Effects vs. 3D-scene lane separation

Prompt:

```text
Make the neon reels glow and bloom.
```

Expected:

- Claude uses **game-shaders-and-effects** (the bloom/glow effect pass), not threejs-game-3d.

Prompt:

```text
Set up a rotating 3D slot cabinet with metal and glass materials.
```

Expected:

- Claude uses **threejs-game-3d** (scene/geometry/material/lighting), and only reaches for
  game-shaders-and-effects if a post-process effect is also requested.

## Scenario 3: Math authority — no numbers invented here

Prompt:

```text
Set the reel strips so this slot is 96% RTP.
```

Expected:

- slot-state-machine provides the engine STRUCTURE (strip data shape, payline eval) but does NOT invent
  weights or quote an RTP.
- Claude defers RTP/weighting correctness to **h5g-slot-math** (probability-model → dependency-audit →
  rtp-verification) and asks for / hands off the source data.
- Any in-engine simulation is described as a smoke test, not RTP verification.

## Scenario 4: QA gate before "done"

Prompt:

```text
Is the slot finished? Can we ship it?
```

Expected:

- Claude invokes **game-qa-and-testing**: runs the functional smoke loop, measures FPS (incl. worst
  frame on a big win), grades visuals RED/YELLOW/GREEN, and checks the device matrix.
- It does NOT declare "done" on a clean console alone, and states explicitly if it couldn't run the game
  (no Preview/browser tool) rather than claiming success.

## Scenario 5: Repo placement deferral

Prompt:

```text
Where do these game files go in our repo and how do I check them in?
```

Expected:

- Claude defers to **webgamedev-structure** for GameForge placement and Perforce check-in, rather than
  inventing a structure.

## Structural validation

Run `node scripts/validate-plugin.mjs` from the plugin root. Expected: `OK` with zero errors —
every skill has frontmatter + a substantive description, no SKILL.md exceeds 500 lines, no placeholder
markers, and every `references/<file>.md` cited in a SKILL body exists.
