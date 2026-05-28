---
name: pixijs-slot-graphics
description: Build polished 2D slot machine games and casino-style reel interfaces with PixiJS v8. Use this whenever the user wants to make slot machines, spinning reels, cascading symbols, payline animations, or any casino-style 2D game UI for the web or mobile web. Triggers on terms like "slot machine", "reels", "spin", "paylines", "scatter", "wild", "bonus round", "cascade slots", "megaways", "social casino", or any request involving PixiJS for a casino-style game. Also use when the user describes a 2D casino mini-game (wheel-of-fortune, scratch card, plinko) that benefits from PixiJS's WebGL rendering.
---

# PixiJS Slot Graphics

Build production-quality 2D slot machines and casino interfaces with PixiJS v8. This skill exists because Claude's default PixiJS output looks like a wireframe — flat rectangles, hard edges, linear motion, no easing, no glow. The fix is not more directives; it's starting from a real working template and modifying it. This skill bundles that template.

## The core principle: start from premium, not from primitive

When you generate a PixiJS slot from scratch, you will reach for `graphics.rect()` with a flat color fill and call it done. The result will look like MS Paint. Don't do that. Instead, copy `assets/premium-reel-template.html` as your starting file and adapt it. The template already has gradients, masks, bevel strokes, blur filters on spinning reels, additive-blend glow overlays, and GSAP easing wired up. To produce flat ugly output, you would have to actively delete the polish — which is a much harder failure mode than the default lazy one.

## When to reach for this skill

Slot mechanics specifically: spinning reels, symbols that snap to a grid, paylines that highlight on wins, scatter/wild/bonus triggers, cascade refills, megaways. Adjacent casino UI: wheel of fortune, scratch cards, plinko, crash games. Anything where a 2D canvas needs to feel polished and reactive on a phone screen.

If the user wants 3D (rotating cabinets, depth, real lighting), read `threejs-game-3d` instead — or combine the two via the hybrid context-sharing pattern documented in `references/hybrid-with-three.md`.

## What goes into a "non-preschool" PixiJS slot

Six things, in order of how often Claude skips them:

1. **Gradients, not solid fills.** Every structural surface uses `FillGradient` with 3+ color stops. Solid hex fills are banned for UI panels, buttons, frames, and reel backgrounds. See `references/gradients.md` for the recipe library (metallic gold, brushed steel, neon plasma, gemstone, velvet).

2. **Rounded geometry with stroked rims.** Use `roundRect` (corner radius proportional to element size — usually 8–16px on a 1080-wide canvas). Every container gets a thin high-contrast stroke that acts as a back-lit rim. Sharp corners read as "prototype" instantly.

3. **Layered glow via additive blend.** A glow is not a `dropShadow` filter. A glow is a second sprite, slightly larger, blurred, with `blendMode = 'add'` and pulsing alpha. Use this for: win lines, bonus triggers, button hover states, near-miss reels.

4. **Motion blur during spin, ease-out on stop.** Reels in motion get a vertical-only `BlurFilter` scaled to current velocity. Reels stopping use `back.out` (GSAP) for the settle bounce, never linear interpolation. The bounce is what makes the symbol feel like a physical weight landing.

5. **Masked reel viewports.** Symbols that scroll past the visible reel must be hidden by a `Graphics` mask, not by stacking another shape on top. Without masking, symbols clip over the UI and look like a bug.

6. **Anticipation timing.** When a near-win is possible (two scatters landed, third reel could trigger bonus), the third reel slows down and holds longer before stopping. This is the single biggest "feels like a real slot" trick. The template includes the timing constants — typically reel N stops at 600ms + N*150ms, with anticipation adding 800-1500ms to the final reel.

## Architecture: use pixi-reels when you can

For a real slot machine (not a one-off demo), use [`pixi-reels`](https://pixi-reels.schmooky.dev/) — an MIT-licensed reel engine for PixiJS v8 that handles reel spinning, stop phases, symbol pooling, cascade refills, megaways, and headless testing. Don't reinvent the reel state machine.

Dependencies for production use:
- `pixi.js@^8.17.0`
- `gsap@^3.14.0`
- `pixi-reels` (the engine)
- Optional: `@esotericsoftware/spine-pixi-v8` if symbols need skeletal animation

For a quick demo or a fully self-contained artifact, the template at `assets/premium-reel-template.html` includes a minimal hand-rolled reel that doesn't depend on pixi-reels — appropriate when the deliverable is one HTML file with no build step.

## Mobile-first defaults

This skill assumes mobile web is the primary target. Apply these defaults unless the user says otherwise:

- Canvas resolution adapts to `devicePixelRatio` but caps at 2 (no point rendering at 3x on retina; the GPU cost isn't worth it on phones).
- Reel cell size minimum 80px square at 1x density — smaller than that and symbols become unreadable. On a 5-reel layout, that puts canvas width at ~440px minimum.
- Use stylized 2.5D illustrated symbols, not photorealistic. Photorealism falls apart at phone scale; stylized illustration with strong outlines stays readable.
- Tap targets minimum 44pt square (iOS HIG) for the spin button and bet controls.
- Touch events: use `eventMode = 'static'` on interactive elements and listen for `pointertap`, not `click` (handles touch and mouse uniformly).
- Test in portrait orientation first — landscape is the fallback, not the other way around.

## Workflow

1. **Read the genre style preset if one applies.** If the user named a theme ("Egyptian slot", "cyberpunk slot"), load `slot-art-style-presets` first to get the palette and motif vocabulary. Don't pick colors from your head — the preset is calibrated.

2. **Copy the template.** Start from `assets/premium-reel-template.html` (full self-contained HTML, no build step) or `assets/premium-reel-template.js` (ES module, for a real project setup). Both versions have the same visual quality baseline.

3. **Replace the symbol set.** The template ships with placeholder card symbols. Generate replacement symbols using the `procedural-symbol-design` skill if it's available, or load actual sprite assets if the user provides them. Symbols must keep the same dimensions and anchor point.

4. **Apply the palette.** Swap the gradient color stops in the `THEME` constant block. Every color in the template is centralized there — don't hunt through the file.

5. **Wire up state and audio.** Win events fire `onWin(tier)` — connect to `tonejs-game-audio` if available, or to provided audio assets.

6. **Test in a phone-sized viewport.** Set the browser to 390x844 (iPhone 14 Pro size) and verify the layout works. Then check 768x1024 (iPad) and desktop.

## Reference material

Detailed references — load only what the current task needs:

- `references/gradients.md` — gradient recipe library (metallic gold, brushed steel, neon plasma, gemstone, velvet, glass, hologram). Read when designing surfaces or backgrounds.
- `references/reel-mechanics.md` — spin timing, anticipation, easing curves, near-miss detection. Read when tuning reel feel.
- `references/win-celebrations.md` — payline animations, win tier thresholds (small/medium/big/mega/grand), coin burst patterns, screen shake. Read when implementing wins.
- `references/pixi-reels-cheatsheet.md` — pixi-reels API surface for the common cases. Read before building a real reel engine.
- `references/hybrid-with-three.md` — sharing a WebGL context with Three.js for cabinet-in-3D-with-reels-in-2D setups. Read only if combining the two libraries.
- `references/performance-mobile.md` — draw call budgets, texture atlas patterns, particle limits, when to use ParticleContainer. Read when frame rate drops below 60.

## Common failures and their fixes

**"Reels spin but feel weightless and arcadey."** You're using linear easing. Replace with GSAP `back.out(1.7)` for the stop, and add a brief overshoot of about 30px below the final position before settling up.

**"Symbols clip over the UI when scrolling past the reel window."** No mask. Add a `Graphics` object sized to the reel viewport, set `reelContainer.mask = mask`. The mask must be added to the stage too, just made invisible — PixiJS won't apply a mask that isn't in the scene graph.

**"Win line animation looks weak."** You're animating opacity on a solid line. Add a second wider blurred copy with `blendMode = 'add'` underneath, scale both by tier, and animate scale + alpha together. The blurred layer is what reads as "energy."

**"Performance drops on Android when many particles spawn."** Migrate the particle layer to `ParticleContainer` (PixiJS v8 supports 100K+ particles in one). Standard containers do per-sprite transform updates; ParticleContainer batches.

**"Text looks pixelated on retina."** You set `Text.resolution` lower than `devicePixelRatio`. Match them, but cap at 2. Or use SDF (`BitmapText` from `@pixi/text-bitmap`) for fully crisp scaled text.

## Style and tone

Slot games are about anticipation and reward, not honesty. The visual language is intentionally seductive — bright, glowing, slightly over-the-top. Restraint and "good taste" produce mediocre slots. When in doubt, push the bloom harder, the particles thicker, the chimes louder.

This does not mean garish. The High 5 brand skill (if loaded) provides specific token constraints — purple-dominant palette with strategic accent use. Adhere to brand tokens when working on H5C-branded games; otherwise apply the genre preset's palette discipline.
