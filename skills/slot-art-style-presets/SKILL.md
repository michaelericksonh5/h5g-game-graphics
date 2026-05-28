---
name: slot-art-style-presets
description: "Apply a complete visual and audio genre identity to a slot machine or casino game. Each preset provides: color palette, symbol vocabulary, typography direction, chassis shape language, particle style, shader/effect direction (which effects to use — the actual effect implementation belongs to game-shaders-and-effects), and audio mood — all calibrated together. This skill sets theme/palette/visual-direction; it does NOT implement bloom, glow, or other effects (use game-shaders-and-effects) and does not build 3D scenes (use threejs-game-3d). Use at the start of any game build when the user names a theme: \"Egyptian slot\", \"cyberpunk slot\", \"underwater slot\", \"fantasy slot\", \"Vegas classic\", \"Asian prosperity\", \"sci-fi slot\", \"dark gothic slot\", \"fairy tale slot\", or \"retro arcade\". Load this skill FIRST, then use its palette and vocabulary to configure all other skills. Also triggers for \"game theme\", \"art style\", \"visual direction\", or \"what should my slot look like\"."
---

# Slot Art Style Presets

The genre vocabulary that makes a game feel intentional, not assembled from random parts. Load this first — it sets the palette and language that every other skill reads from.

## How to use a preset

When the user names a genre, output the THEME_CONFIG block for that genre and tell them:
- Set these as the `THEME` constant in `pixijs-slot-graphics` (replace the generic one)
- These colors apply to all gradients, glows, and strokes throughout the game
- The symbol list drives `procedural-symbol-design`
- The audio mood configures `adaptive-game-music`
- The shader recs configure `game-shaders-and-effects`

## Egyptian — Pharaoh's Gold

```javascript
const THEME_CONFIG = {
  // Chassis
  chassisOuter:  ['#a87838', '#6e4818', '#2a1808'],
  chassisInner:  ['#1a0e04', '#3a2008'],
  frameStroke:   0xf5c842,
  frameGlow:     0xc4901a,

  // Reels
  reelBg:        ['#1a0e04', '#2a1808', '#1a0e04'],

  // Symbols (5 themed + 3 specials + 5 card letters)
  symbols: ['ANKH','EYE','SCARAB','PHARAOH','PYRAMID','A','K','Q','J','T','WILD','SCATTER','BONUS'],
  symbolGlyphs: { ANKH:'☥', EYE:'𓂀', SCARAB:'𓆣', PHARAOH:'𓁹', PYRAMID:'△',
                  A:'A', K:'K', Q:'Q', J:'J', T:'10', WILD:'★', SCATTER:'✦', BONUS:'◆' },

  // UI
  spinFill:  ['#fff5d6','#ffea66','#c48a1a'],
  spinStroke: 0xfff5d6,
  winLineColor: 0xffea66,
  winLineGlow:  0xf5c842,

  // Typography
  titleText:     'PHARAOH\'S GOLD',
  fontWeight:    900,
  letterSpacing: 3,
  titleGradient: ['#fff5d6','#ffea66','#c48a1a'],

  // Particles
  coinColor: 0xf5c842,
  sparkleColor: 0xffea66,
  particleStyle: 'coins+scarabs', // gold coins and small scarab beetles

  // Shaders
  bloomStrength: 0.6, bloomThreshold: 0.9,
  lightingPreset: 'egyptian',

  // Audio
  audioGenre: 'egyptian',
  musicScale: 'pentatonic_minor', // C D Eb G Ab
  tempoBase: 96,
};
```

**Chassis shape:** Ornate — beveled frame with stepped pillar corners suggesting carved stone. Hieroglyph band motif along frame edge (thin horizontal stripes at top/bottom of frame).
**Background:** 3-layer parallax — starry desert sky (far), temple pillars (mid), floor sand dunes (near).

---

## Cyberpunk Neon — Neon City

```javascript
const THEME_CONFIG = {
  chassisOuter:  ['#0a0a12','#050508','#000'],
  chassisInner:  ['#000','#08080f'],
  frameStroke:   0xff2bd6,   // hot pink primary
  frameGlow:     0xff2bd6,

  reelBg:        ['#000','#050510','#000'],

  symbols: ['A','K','Q','J','T','WILD','SCATTER','BONUS'],
  symbolGlyphs: { A:'A', K:'K', Q:'Q', J:'J', T:'10',
                  WILD:'⧫', SCATTER:'▲', BONUS:'◉' },

  spinFill:  ['#fff','#ff2bd6','#6e0d52'],
  spinStroke: 0x2bb0fb,
  winLineColor: 0x2bb0fb,
  winLineGlow:  0xff2bd6,

  titleText: 'NEON CITY',
  fontWeight: 900, letterSpacing: 8,
  titleGradient: ['#fff','#ff2bd6','#0a0020'],

  coinColor: 0xff2bd6,
  sparkleColor: 0x2bb0fb,
  particleStyle: 'energy_sparks',

  bloomStrength: 2.0, bloomThreshold: 0.6,
  lightingPreset: 'cyberpunk',
  additionalEffects: ['scanlines', 'chromatic_aberration'],

  audioGenre: 'cyberpunk',
  musicScale: 'chromatic_minor',
  tempoBase: 128,
};
```

**Chassis shape:** Hard edges, angular — no curves. Hexagonal accent panels. Glowing circuit trace lines along the frame. "FLATSCREEN" style reels suggesting a digital monitor mounted in a physical cabinet.
**Background:** Rain-slicked neon city street, distant holographic ads, flying vehicles.

---

## Asian Prosperity — Dragon Fortune

```javascript
const THEME_CONFIG = {
  chassisOuter:  ['#8a0000','#5a0000','#2a0000'],
  chassisInner:  ['#1a0800','#2a1000'],
  frameStroke:   0xf5c842,
  frameGlow:     0xff3030,

  reelBg:        ['#1a0800','#2a1208','#1a0800'],

  symbols: ['DRAGON','TIGER','PHOENIX','COIN','LOTUS','A','K','Q','J','T','WILD','SCATTER','BONUS'],
  symbolGlyphs: { DRAGON:'龍', TIGER:'虎', PHOENIX:'鳳', COIN:'福', LOTUS:'花',
                  A:'A', K:'K', Q:'Q', J:'J', T:'10', WILD:'★', SCATTER:'✦', BONUS:'◆' },

  spinFill:  ['#fff5d6','#ffea66','#c48a1a'],
  spinStroke: 0xff3030,
  winLineColor: 0xffea66,
  winLineGlow:  0xff3030,

  titleText: 'DRAGON FORTUNE',
  fontWeight: 900, letterSpacing: 2,
  titleGradient: ['#fff5d6','#ffea66','#c48a1a'],

  coinColor: 0xf5c842,
  sparkleColor: 0xffea66,
  particleStyle: 'coins+flower_petals',

  bloomStrength: 0.8, bloomThreshold: 0.85,
  lightingPreset: 'asian',

  audioGenre: 'asian',
  musicScale: 'pentatonic_major',
  tempoBase: 104,
};
```

**Chassis shape:** Ornate curved with double-eave roof motif at top. Red lacquer with gold inlay. Dragon scale texture on pillar elements. Paper lantern accent lights.

---

## Dark Fantasy — Shadows of Asgard

```javascript
const THEME_CONFIG = {
  chassisOuter:  ['#2a1a3a','#160a22','#080412'],
  chassisInner:  ['#080412','#120820'],
  frameStroke:   0x8a30e8,
  frameGlow:     0x5010a0,

  reelBg:        ['#050210','#0a0520','#050210'],

  symbols: ['THOR','ODIN','LOKI','MJOLNIR','RUNE','A','K','Q','J','T','WILD','SCATTER','BONUS'],
  symbolGlyphs: { THOR:'⚡', ODIN:'☽', LOKI:'🜂', MJOLNIR:'⚒', RUNE:'ᚱ',
                  A:'A', K:'K', Q:'Q', J:'J', T:'10', WILD:'✦', SCATTER:'☆', BONUS:'◆' },

  spinFill:  ['#d0c0ff','#8a30e8','#2a0870'],
  spinStroke: 0xd0c0ff,
  winLineColor: 0x8a30e8,
  winLineGlow:  0x6010c0,

  titleText: 'SHADOWS OF ASGARD',
  fontWeight: 900, letterSpacing: 2,
  titleGradient: ['#d0c0ff','#8a30e8','#1a0440'],

  coinColor: 0x8a30e8,
  sparkleColor: 0xd0c0ff,
  particleStyle: 'rune_sparks+silver_stars',

  bloomStrength: 1.5, bloomThreshold: 0.75,
  lightingPreset: 'fantasy',

  audioGenre: 'fantasy',
  musicScale: 'dorian',
  tempoBase: 88,
};
```

---

## Underwater — Depths of Atlantis

```javascript
const THEME_CONFIG = {
  chassisOuter:  ['#0a2a3a','#051820','#020e14'],
  chassisInner:  ['#020a10','#041218'],
  frameStroke:   0x05bfc8,
  frameGlow:     0x00c8a0,

  reelBg:        ['#020810','#041018','#020810'],

  symbols: ['SHARK','MERMAID','OCTOPUS','CORAL','PEARL','A','K','Q','J','T','WILD','SCATTER','BONUS'],
  symbolGlyphs: { SHARK:'🦈', MERMAID:'🧜', OCTOPUS:'🐙', CORAL:'🪸', PEARL:'◉',
                  A:'A', K:'K', Q:'Q', J:'J', T:'10', WILD:'✦', SCATTER:'★', BONUS:'◆' },

  spinFill:  ['#d6f7ff','#2bb0fb','#0a3a6e'],
  spinStroke: 0x05bfc8,
  winLineColor: 0x05bfc8,
  winLineGlow:  0x00c8a0,

  coinColor: 0x2bb0fb,
  sparkleColor: 0x05bfc8,
  particleStyle: 'bubbles+fish',

  bloomStrength: 1.2, bloomThreshold: 0.7,
  lightingPreset: 'underwater',
  additionalEffects: ['caustic_overlay', 'bubble_displacement'],

  audioGenre: 'underwater',
  musicScale: 'whole_tone',
  tempoBase: 80,
};
```

---

## Vegas Classic — Lucky Sevens

```javascript
const THEME_CONFIG = {
  chassisOuter:  ['#2a0808','#1a0404','#0a0202'],
  chassisInner:  ['#0a0202','#180404'],
  frameStroke:   0xf5c842,
  frameGlow:     0xff3030,

  reelBg:        ['#080200','#100400','#080200'],

  symbols: ['SEVEN','BELL','CHERRY','BAR','STAR','A','K','Q','J','T','WILD','SCATTER','BONUS'],
  symbolGlyphs: { SEVEN:'7', BELL:'🔔', CHERRY:'🍒', BAR:'BAR', STAR:'⭐',
                  A:'A', K:'K', Q:'Q', J:'J', T:'10', WILD:'★', SCATTER:'✦', BONUS:'◆' },

  spinFill:  ['#fff5d6','#ffea66','#c48a1a'],
  spinStroke: 0xff3030,
  winLineColor: 0xffea66,
  winLineGlow:  0xff3030,

  titleText: 'LUCKY SEVENS',
  fontWeight: 900, letterSpacing: 4,
  titleGradient: ['#fff5d6','#ffea66','#c48a1a'],

  bloomStrength: 1.0, bloomThreshold: 0.8,
  lightingPreset: 'vegas',

  audioGenre: 'vegas',
  musicScale: 'major_blues',
  tempoBase: 120,
};
```

---

## Additional genres (summary)

**Sci-Fi Space Station:** Chrome + electric blue + holographic teal. Symbol vocab: Alien, Robot, Planet, Rocket, Black Hole. Scanline + chromatic aberration effects. Electronic music, 116 BPM.

**Fairy Tale / Enchanted Forest:** Soft lavender + rose gold + mint green. Symbol vocab: Princess, Dragon, Castle, Magic Wand, Fairy. Soft bloom, sparkle particles. Music box + harp music, 76 BPM.

**Retro Arcade (8-bit):** 4-color palette per screen (CGA/NES style), black background. Symbol vocab: Pac-Man-ish shapes, hearts, stars, coins. Chiptune audio, 140 BPM, hard scanlines.

**Horror / Gothic Halloween:** Deep crimson + bone white + black. Symbol vocab: Skull, Pumpkin, Bat, Spider, Cauldron. Heavy vignette, desaturated except accent colors. Minor key organ, 84 BPM.

**Irish Luck / Celtic:** Emerald + gold + shamrock green. Symbol vocab: Shamrock, Pot of Gold, Harp, Rainbow, Horseshoe. Soft warm bloom. Celtic folk patterns, pennywhistle tones, 108 BPM.
