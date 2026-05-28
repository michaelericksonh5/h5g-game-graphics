#!/usr/bin/env node

// Graphics_Skills orchestration guardrail (plugin copy).
// When a submitted prompt looks like "build me a <theme> slot/arcade game" OR a side-scroller /
// platformer / arcade-action game, inject the canonical multi-skill load order for that lane so
// the suite is pulled in the right sequence. Mirrors the h5g-slot-math UserPromptSubmit guard.
//
// Dedupe guard: an identical copy of this script may also be registered in user-global
// settings.json. Both are allowed to run, but a short temp-file sentinel keyed by a hash of the
// prompt ensures the SAME context is not injected twice within a 2s window — whichever process
// runs second sees the sentinel and exits quietly.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const input = fs.readFileSync(0, "utf8");
let payload = {};
try {
  payload = input.trim() ? JSON.parse(input) : {};
} catch {
  process.exit(0);
}

const promptRaw = String(payload.prompt || "");
const prompt = promptRaw.toLowerCase();

const buildVerbs = ["build", "make", "create", "prototype", "scaffold", "generate", "design"];

// --- SLOT lane intent ---
const slotIntent = [
  "build a slot", "build me a slot", "make a slot", "create a slot",
  "slot machine", "slot game", "casino game",
  "5-reel", "5 reel", "three-reel", "3-reel", "megaways", "cluster pays", "all-ways",
];
const slotNouns = ["slot", "slots", "reel", "reels", "casino"];
const slotThemes = [
  "egyptian", "cyberpunk", "underwater", "fantasy", "vegas", "asian", "prosperity",
  "sci-fi", "scifi", "gothic", "fairy tale", "fairytale", "pirate",
];
const slotFeatures = ["free spins", "free spin", "bonus round", "scatter", "wild", "jackpot", "paylines", "payline"];

const hasSlotIntent = slotIntent.some((t) => prompt.includes(t));
const hasSlotVerbNoun = buildVerbs.some((v) => prompt.includes(v)) && slotNouns.some((n) => prompt.includes(n));
const hasSlotTheme =
  slotThemes.some((t) => prompt.includes(t)) &&
  (slotNouns.some((n) => prompt.includes(n)) || slotFeatures.some((f) => prompt.includes(f)));
const slot = hasSlotIntent || hasSlotVerbNoun || hasSlotTheme;

// --- SIDE-SCROLLER / ARCADE-ACTION lane intent ---
const scrollerIntent = [
  "side-scroller", "sidescroller", "side scroller", "platformer", "endless runner",
  "auto-runner", "autorunner", "metroidvania", "run and gun", "run-and-gun",
  "jump and run", "jump-and-run", "2d platform game",
];
const scrollerNouns = [
  "platformer", "side-scroller", "sidescroller", "side scroller", "runner",
  "tilemap", "tile map", "level", "character controller",
];
const scrollerSignals = [
  "coyote time", "jump buffer", "parallax", "tilemap", "tile map", "sprite sheet",
  "character controller", "walk cycle", "run cycle", "one-way platform", "moving platform",
];

const hasScrollerIntent = scrollerIntent.some((t) => prompt.includes(t));
const hasScrollerVerbNoun = buildVerbs.some((v) => prompt.includes(v)) && scrollerNouns.some((n) => prompt.includes(n));
const hasScrollerSignal = scrollerSignals.some((s) => prompt.includes(s));
const scroller = hasScrollerIntent || hasScrollerVerbNoun || hasScrollerSignal;

// Decide the lane. Side-scroller signals are more specific, so they win a tie. "arcade game"
// alone is ambiguous and falls back to the slot/casino lane (which already mentions arcade).
let lane = null;
if (scroller && !hasSlotIntent) lane = "scroller";
else if (slot) lane = "slot";
else if (scroller) lane = "scroller";
else if (buildVerbs.some((v) => prompt.includes(v)) && prompt.includes("arcade game")) lane = "slot";

if (!lane) process.exit(0);

// --- dedupe guard (prevents double-injection across the plugin + user-global copies) ---
try {
  const hash = crypto.createHash("sha1").update(lane + "|" + prompt).digest("hex").slice(0, 16);
  const sentinel = path.join(os.tmpdir(), `gfx-orch-${hash}`);
  const now = Date.now();
  if (fs.existsSync(sentinel)) {
    const age = now - fs.statSync(sentinel).mtimeMs;
    if (age < 2000) process.exit(0); // a sibling copy already injected for this prompt
  }
  fs.writeFileSync(sentinel, String(now));
} catch {
  // If the temp write fails for any reason, fall through and still inject (better than silence).
}

const SLOT_CONTEXT = [
  "Graphics_Skills suite active: this looks like a request to build a slot/casino game.",
  "Load the graphics skills in this canonical order, each in its lane:",
  "1) slot-art-style-presets (theme/palette FIRST) →",
  "2) slot-state-machine (engine STRUCTURE) — defer ALL RTP/probability/weighting/odds correctness to the h5g-slot-math suite →",
  "3) pixijs-slot-graphics (2D reels/symbols/win FX) →",
  "4) procedural-symbol-design (draw symbols) →",
  "5) slot-symbol-animation-states (symbol state animations) →",
  "6) slot-bonus-features (bonus/free-spins features) →",
  "7) slot-hud-and-ui (UI shell; repo placement/P4 → webgamedev-structure) →",
  "8) particle-systems-and-juice (game feel) →",
  "9) tonejs-game-audio (audio FOUNDATION/unlock/bus) → procedural-sfx-design (event SFX) + adaptive-game-music (music/stems) →",
  "10) game-qa-and-testing (QA/sign-off LAST: 60fps, visual rubric, device matrix — do not report done without it).",
  "Use threejs-game-3d for 3D scene setup and game-shaders-and-effects for post-process effects (bloom/glow) when requested.",
  "Output a single self-contained HTML5 build, mobile-first, zero external art assets.",
].join(" ");

const SCROLLER_CONTEXT = [
  "Graphics_Skills suite active: this looks like a request to build a side-scroller / platformer / arcade-action game.",
  "Load the graphics skills in this canonical order, each in its lane:",
  "1) sidescroller-engine (headless STRUCTURE FIRST: fixed-timestep loop, ECS/pooling, input/touch, scene + score/lives/waves) →",
  "2) tilemap-and-level-design (tile rendering + procedural tile art + the collision GRID + level data) →",
  "3) platformer-physics (movement & collision feel — gravity, AABB, coyote time, jump buffer; CONSUMES the collision grid) →",
  "4) procedural-sprite-animation (draw + animate characters/enemies in code; frame states) →",
  "5) sidescroller-camera-and-parallax (follow camera + procedural parallax backgrounds) →",
  "6) particle-systems-and-juice (game feel; exposes screen-shake) →",
  "7) procedural-textures-and-materials + game-shaders-and-effects (surfaces / post-process FX when requested) →",
  "8) tonejs-game-audio (audio FOUNDATION/unlock/bus) → procedural-sfx-design (event SFX) + adaptive-game-music (music/stems) →",
  "9) game-qa-and-testing (QA/sign-off LAST: 60fps, visual rubric, device matrix — do not report done without it).",
  "Repo placement/Perforce → webgamedev-structure. If RNG-driven loot/odds must be balanced or certified, defer that correctness to the h5g-slot-math suite.",
  "Output a single self-contained HTML5 build, mobile-first, zero external art assets.",
].join(" ");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: lane === "scroller" ? SCROLLER_CONTEXT : SLOT_CONTEXT,
  },
}));
