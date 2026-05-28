# H5G Game Graphics & Audio

A Claude Code plugin (and standalone skill bundle) for building **production-quality, mobile-first
HTML5 slot/arcade games with zero external art assets** — every visual, sound, and bit of game-feel is
generated in code. The goal: AI output that reads as "did you hire an artist?", not "did a computer
make this?".

## What's in the suite (20 skills, two lanes + a shared core)

**Slot lane** (casino / reel games):

| Skill | Role |
|---|---|
| `slot-art-style-presets` | theme/palette/visual direction — **load first** |
| `slot-state-machine` | headless engine STRUCTURE (RNG seam, reel data, paylines, state, events) |
| `pixijs-slot-graphics` | 2D reels, symbols, win FX (PixiJS v8) |
| `procedural-symbol-design` | drawing the symbol set |
| `slot-symbol-animation-states` | symbol animation state machine |
| `slot-bonus-features` | bonus rounds / free spins features |
| `slot-hud-and-ui` | UI shell (bet, balance, win counter, paytable, jackpot meters) |

**Side-scroller / arcade-action lane** (platformers, runners, arcade games):

| Skill | Role |
|---|---|
| `sidescroller-engine` | headless STRUCTURE — fixed-timestep loop, ECS/pooling, input/touch, scene + score/lives/waves — **load first** |
| `tilemap-and-level-design` | tile rendering, procedural tile art, the collision GRID, level data |
| `platformer-physics` | movement & collision feel (gravity, AABB, coyote time, jump buffer) — consumes the collision grid |
| `procedural-sprite-animation` | draw + animate characters/enemies in code; frame states |
| `sidescroller-camera-and-parallax` | follow camera + procedural parallax backgrounds |

**Shared production core** (both lanes):

| Skill | Role |
|---|---|
| `threejs-game-3d` | 3D scene setup — geometry, PBR materials, lighting (Three.js r170+/WebGPU) |
| `game-shaders-and-effects` | post-process effects: bloom, glow, distortion (2D + 3D) |
| `procedural-textures-and-materials` | procedural textures / noise / materials |
| `particle-systems-and-juice` | particles, easing, game feel, screen shake |
| `tonejs-game-audio` | audio FOUNDATION — unlock, transport, master bus |
| `procedural-sfx-design` | event sound effects |
| `adaptive-game-music` | adaptive background music / stems |
| `game-qa-and-testing` | QA/sign-off gate — **load last** (60fps, visual rubric, device matrix) |

## Canonical build orders

**Slot:** `slot-art-style-presets → slot-state-machine (+ h5g-slot-math for math) → pixijs-slot-graphics →
procedural-symbol-design → slot-symbol-animation-states → slot-bonus-features → slot-hud-and-ui →
particle-systems-and-juice → tonejs-game-audio (→ procedural-sfx-design / adaptive-game-music) →
game-qa-and-testing`

**Side-scroller:** `sidescroller-engine → tilemap-and-level-design → platformer-physics →
procedural-sprite-animation → sidescroller-camera-and-parallax → particle-systems-and-juice →
(procedural-textures-and-materials / game-shaders-and-effects) → tonejs-game-audio (→ procedural-sfx-design /
adaptive-game-music) → game-qa-and-testing`

A `UserPromptSubmit` hook auto-detects which lane a prompt wants ("build me a … slot" vs. "build me a
side-scroller / platformer") and injects the matching order.

## Integration boundaries

- **Math correctness → `h5g-slot-math`.** This suite owns engine *structure* and visuals; all RTP,
  probability, reel-strip weighting, hit-frequency, odds, and certification correctness defer to the
  h5g-slot-math suite (`probability-model → dependency-audit → rtp-verification →
  internal-h5g-evidence`). No math numbers are derived or trusted inside this suite.
- **Repo placement / Perforce → `webgamedev-structure`.** This suite builds the files; that skill
  decides where they live and how they're checked in.
- **Deep per-asset art critique → `slot-art-qa-reviewer`** agent (if available). `game-qa-and-testing`
  is the fast holistic runtime sign-off.

## Layout

```
.claude-plugin/plugin.json   # plugin manifest
skills/<name>/SKILL.md       # 20 skills (auto-discovered), each with references/
hooks/hooks.json             # UserPromptSubmit orchestration (auto-loaded)
hooks/graphics-suite-orchestrator.mjs
evals/graphics-suite-scenarios.md
scripts/validate-plugin.mjs  # structure check
src/<name>/<name>/...        # SOURCE OF TRUTH (double-nested, edit here)
*.skill                      # standalone ZIP artifacts (build output)
build-skills.ps1             # repack src/ -> *.skill
build-plugin.ps1             # sync src/ -> skills/ (single-nested plugin tree)
```

## Build & validate

```powershell
pwsh -File build-plugin.ps1          # sync src/ into skills/ for the plugin
pwsh -File build-skills.ps1          # repack src/ into standalone *.skill files
node scripts/validate-plugin.mjs     # structure + reference validation
```

`src/` is the single source of truth — edit there, then run both build helpers. Never hand-edit a
`.skill` zip or the generated `skills/` tree.

**Rebuild after any edit** (run in order):

```powershell
pwsh -File build-plugin.ps1          # src/ -> skills/ (plugin tree)
pwsh -File build-skills.ps1          # src/ -> *.skill (standalone artifacts)
node scripts/validate-plugin.mjs     # confirm 20 skills + all references resolve
```

## Orchestration hook

A `UserPromptSubmit` hook detects build intent, picks the lane (slot vs. side-scroller/arcade), and
injects that lane's canonical load order. It ships **inside the plugin** (`hooks/hooks.json` +
`hooks/graphics-suite-orchestrator.mjs`, auto-loaded via `${CLAUDE_PLUGIN_ROOT}`) and is also installed
**user-globally** so it fires in every project.

Both copies share the same SHA1-of-prompt dedupe guard (a 2-second temp sentinel), so when both run
on the same prompt the canonical load order is injected **once**, never twice.

### Note on global edits

Two user-global files were edited (they affect **every** project, additive/sync only):

- `~\.claude\settings.json` — added the `UserPromptSubmit` hook entry.
- `~\.claude\hooks\graphics-suite-orchestrator.mjs` — same dedupe logic as the plugin copy, so the
  two cross-suppress.

Both the plugin and user-global hooks run; identical context is never double-injected.
