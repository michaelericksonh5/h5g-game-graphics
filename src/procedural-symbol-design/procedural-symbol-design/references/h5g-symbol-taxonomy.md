# H5G symbol taxonomy & role map

This is the symbol vocabulary H5G uses in production. Match these names and roles when you
build a symbol set so the engine, the math model, and the art all speak the same language. The
naming is confirmed across real game design docs and Spine asset sheets (Day of the Dead,
Buffalo Mountain, Green Machine, Da Vinci, Dragon's Blessings, et al.).

## Symbol roles & house IDs

| House ID | Role | What it is | Mechanic |
|---|---|---|---|
| **HP1…HPn** | High pay | Hero *items* (often explicitly "no characters") — the skull, the flower, the guitar, the heart. HP1 is the top symbol and carries the most visual weight. | Standard line/ways pays, biggest. |
| **LP1…LPn** | Low pay | Card values A / K / Q / J / (10), re-skinned as a *themed cultural object* that carries the letter (a papel-picado banner, a carved tile, an enamel badge). Never raw `Text`. | Standard pays, smallest. |
| **WD / WD1 / WD2** | Wild | Substitutes for any paying symbol. May be plain, expanding, sticky, stacked, or "walking." Often the single most prominent standard symbol (strongest glow). | Substitution; sometimes a badge event that flies onto cells. |
| **WY1 / scatter-coin** | Credit coin | A coin showing a currency value ("$1.00"). Server-placed on winning cells and **persists** on the grid. | Hold-and-collect / coin accumulation. |
| **JP1** | Jackpot coin | A coin marked "JACKPOT", visually distinct from WY1 (different metal / emblem). | 3+ triggers the jackpot wheel. |
| **SF** | Scatter / feature | Pays anywhere, triggers free spins / bonus. | Triggers the feature; usually has an anticipation tell. |
| **R1** | Replacement | A symbol introduced by a transform/replacement step. | Mystery → reveal, symbol upgrade, etc. |
| **BL** | Blank / filler | An empty dark cell shown before server data arrives. | Matches reel background; unobtrusive. |
| **Bonus-coin variants** | Actionable coins | One shared silhouette (e.g. a chili "pepper"), many roles: Multiplier ("3x"), Wide Scatter, Wide Multiplier, Extra Free Spin ("+1"), Normal Scatter. | In-bonus accumulator actions. |
| **Badge events** | Not reel symbols | OMC "One More Chance" medallion, Wild-Coin badge, PreCog anticipation FX. | Overlay/feature events drawn over the reels. |

Advanced wild/feature behaviors you should recognize and be able to build: expanding wild,
sticky wild, stacked wild, walking/marching wild, mystery symbol (transforms on reveal),
multiplier symbol, collection/coin symbol (hold-and-spin), colossal/oversized symbol.

## The six hard production rules (these are QA gates, not suggestions)

### 1. Black-fill silhouette test
Fill every high-pay symbol solid black. The set must have **zero silhouette overlap** — each
occupies a different shape zone (wide oval with extensions, pure circle/radial, tall-narrow,
inverted-triangle/organic, etc.). If two HPs read as the same blob, redesign one. A player
identifies a symbol by silhouette before color.

### 2. Two-scale readability
Symbols ship at two scales and must survive both:
- **Base game 1.0x** — ~148px cell, ~125px symbol after padding. Full detail.
- **Bonus game 0.667x** — ~99px cell, ~84px symbol. Silhouettes still distinct, card letters
  still legible, coin credit values still readable (min ~10px numeral height).

Test at 84px, not just at base size. Intricate filigree / micro-detail dies at 0.667x — use
2–3 bold elements per symbol, not lacework. Also test ~60px for the paytable screen.

### 3. Shared-silhouette differentiation (colorblind-safe)
When a set reuses one silhouette (the bonus "peppers" are all the same chili shape), members
must differ on **three** axes at once:
- **Hue** — occupy different zones of the color wheel.
- **Value/lightness** — also differ in lightness, so they survive a grayscale/colorblind sim.
- **Painted pattern** — a distinct surface motif (swirls vs starburst vs skull-and-flower vs
  vine) as a secondary, non-color differentiator.

Plus a structural cue where the role needs it (a glowing frame behind the "wide" variants).

### 4. Glow aura + rim light, NOT drawn outlines
H5G symbols have **no black stroke outlines.** Figure-ground separation comes from:
- a soft **colored glow aura** behind each symbol (also reads as festive/magical),
- a warm **rim light** on the lit edge,
- strong **value contrast** against the (dark) reel area.

This matches the suite's existing glow + rim-light guidance — the rim light is the cheapest,
strongest premium signal. A drawn outline reads as cheap/flat and is wrong for the house style.

### 5. One shared light rig across the whole set
Every symbol is rendered as if lit by the same rig:
- **Key:** warm golden, upper-left.
- **Fill:** cool purple/blue ambient, lower-right.
- **Rim:** prominent soft rim on the lit edge.

The mandate is literally "all symbols must look like they were rendered by the same artist
under the same light." Inconsistent light direction across a set is an instant "a computer made
this" tell. Bake the light direction once and apply it to every symbol's relief pass.

### 6. Theme-element exclusivity
A motif used **as a symbol** must not also appear in backgrounds, frames, or UI. Example: if the
marigold is HP2, remove every environmental marigold from the scene and bezel — otherwise the
hero symbol's identity is diluted and players get false-positive reads. Push other theme
elements (banners, candles, lanterns, pottery) into the environment instead. Net effect: the
symbol becomes the *only* source of its signature color/shape on screen, which sharpens the
hierarchy.

## Style / quality bar
H5G's stated target is a **vibrant, richly rendered digital painting** — smooth gradient
shading, dimensional and tactile, luminous. The explicit reference points are premium mobile
slot art like **Pragmatic Play / Play'n GO**: *not* flat illustration, *not* photographic
realism — a polished middle ground. Extremely saturated palette, soft transitions between
highlight and shadow, materials that read (gold = warm metallic sheen, wood = polished warmth,
paper = flatter, bone/ceramic = smooth clean surface). This is the bar the
`procedural-textures-and-materials` sculpted-relief pass exists to hit procedurally.

## How this maps to the rest of the suite
- **Identity / silhouette / material** → this skill (`procedural-symbol-design`).
- **The lit-relief pass that hits the digital-painting bar** →
  `procedural-textures-and-materials/references/sculpted-relief-shading.md`.
- **Wild/scatter/coin/jackpot mechanical roles, persistence, blank-before-server-data** →
  `slot-state-machine` (structure only; all probability/RTP/odds → `h5g-slot-math`).
- **Black-fill, two-scale, colorblind, light-rig consistency as sign-off gates** →
  `game-qa-and-testing/references/visual-qa-rubric.md`.
