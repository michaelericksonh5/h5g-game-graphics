# Symbol Gradient Mapping

Every symbol tier gets a calibrated gradient. The gradient communicates value before the player even reads the symbol — gold reads as "expensive", blue reads as "rare", gray reads as "common".

## How to apply in PixiJS v8

```javascript
import { FillGradient } from 'pixi.js';

function makeSymbolGradient(key, size, genre) {
  const recipe = GRADIENT_RECIPES[genre]?.[key] || GRADIENT_RECIPES.generic[key];
  if (!recipe) return '#888888';

  const g = new FillGradient(
    recipe.x0 * size, recipe.y0 * size,
    recipe.x1 * size, recipe.y1 * size
  );
  recipe.stops.forEach(([pos, color]) => g.addColorStop(pos, color));
  return g;
}
```

Axis notation: (0,0)→(0,1) = vertical top-to-bottom. (0,0)→(1,1) = diagonal TL→BR.

## Generic / Card symbols (any genre)

```javascript
GRADIENT_RECIPES.generic = {
  A:  { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#fff5d6'],[0.3,'#ffea66'],[0.65,'#f5c842'],[1,'#9c6a1a']] },
  K:  { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffd1d1'],[0.35,'#ff4d6d'],[0.7,'#c01840'],[1,'#5a0a1e']] },
  Q:  { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#d6e6ff'],[0.35,'#3b8eea'],[0.7,'#1a5aaa'],[1,'#0a2050']] },
  J:  { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#d6ffd9'],[0.35,'#42d65a'],[0.7,'#1a8a30'],[1,'#084018']] },
  T:  { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffe2d1'],[0.35,'#ff8a3b'],[0.7,'#c05818'],[1,'#4a2208']] },
  WILD:    { x0:0.3,y0:0.1, x1:0.7,y1:0.9, stops: [[0,'#ffffff'],[0.2,'#fffae0'],[0.5,'#ffea66'],[1,'#9c6a1a']] },
  SCATTER: { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#f0d6ff'],[0.3,'#ac1eff'],[0.7,'#6a0aaa'],[1,'#2a0450']] },
  BONUS:   { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffd6f7'],[0.3,'#ff2bd6'],[0.7,'#aa0a98'],[1,'#420038']] },
};
```

## Egyptian genre overrides

Gold and lapis dominate. Sandstone for mid-tier.

```javascript
GRADIENT_RECIPES.egyptian = {
  ANKH:    { x0:0.3,y0:0, x1:0.7,y1:1, stops: [[0,'#fff5d6'],[0.2,'#ffe066'],[0.5,'#f5c842'],[0.8,'#c4901a'],[1,'#6e4808']] },
  EYE:     { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#d6eeff'],[0.3,'#2bb0fb'],[0.65,'#0a68b8'],[1,'#041830']] },
  SCARAB:  { x0:0.2,y0:0.1, x1:0.8,y1:0.9, stops: [[0,'#d8ffe0'],[0.3,'#3ad662'],[0.6,'#08a830'],[1,'#024010']] },
  PHARAOH: { x0:0,y0:0, x1:1,y1:1, stops: [[0,'#ffe8c8'],[0.35,'#f5a832'],[0.65,'#c07810'],[1,'#5a3000']] },
  PYRAMID: { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#f5e6c4'],[0.4,'#e8c890'],[0.75,'#c4a060'],[1,'#6e4828']] },
  // Low-value card overrides to sandy tones
  A: { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#fff5d6'],[0.5,'#f5c842'],[1,'#7a5010']] },
};
```

## Cyberpunk genre overrides

Pure neon; backgrounds near-black; maximal saturation.

```javascript
GRADIENT_RECIPES.cyberpunk = {
  A:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffffff'],[0.2,'#ff2bd6'],[0.6,'#aa0898'],[1,'#300028']] },
  K:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffffff'],[0.2,'#2bb0fb'],[0.6,'#0a68b8'],[1,'#001830']] },
  Q:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffffff'],[0.2,'#ac1eff'],[0.6,'#6a0ada'],[1,'#180040']] },
  J:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffffff'],[0.2,'#00ff66'],[0.6,'#008830'],[1,'#001808']] },
  T:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffffff'],[0.2,'#ffea66'],[0.6,'#c89800'],[1,'#302000']] },
  WILD: { x0:0.3,y0:0, x1:0.7,y1:1, stops: [[0,'#ffffff'],[0.15,'#ff2bd6'],[0.5,'#2bb0fb'],[1,'#0a0020']] },
  SCATTER: { x0:0,y0:0, x1:1,y1:1, stops: [[0,'#ffffff'],[0.2,'#00ff66'],[0.5,'#2bb0fb'],[1,'#0a0020']] },
};
```

## Asian Prosperity overrides

Red, gold, jade. No cool tones except jade accents.

```javascript
GRADIENT_RECIPES.asian = {
  A:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#fff5d6'],[0.3,'#ffea66'],[0.65,'#c89800'],[1,'#5a3800']] },
  K:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#ffd6d6'],[0.3,'#ff2020'],[0.65,'#a80808'],[1,'#380000']] },
  Q:    { x0:0.2,y0:0.1, x1:0.8,y1:0.9, stops: [[0,'#d6ffd9'],[0.3,'#42d65a'],[0.65,'#088830'],[1,'#021808']] },
  WILD: { x0:0,y0:0, x1:1,y1:1, stops: [[0,'#ffffff'],[0.2,'#ffea66'],[0.5,'#ff2020'],[1,'#380000']] },
};
```

## Fantasy / Mythological overrides

Deep purples, silver, crimson, arcane blues.

```javascript
GRADIENT_RECIPES.fantasy = {
  A:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#e8d6ff'],[0.3,'#ac1eff'],[0.65,'#6a0ada'],[1,'#180038']] },
  K:    { x0:0,y0:0, x1:0,y1:1, stops: [[0,'#f0f4ff'],[0.3,'#b0c0e0'],[0.65,'#6070a0'],[1,'#182038']] },
  WILD: { x0:0.3,y0:0, x1:0.7,y1:1, stops: [[0,'#ffffff'],[0.15,'#ffe066'],[0.4,'#f5c842'],[0.8,'#6e4808'],[1,'#2a1800']] },
};
```

## Glow colors to pair with each symbol

The background glow layer should match the symbol's dominant hue:

```javascript
const GLOW_COLORS = {
  // Egyptian
  ANKH: 0xf5c842, EYE: 0x2bb0fb, SCARAB: 0x42d65a, PHARAOH: 0xff8a3b, PYRAMID: 0xe8c890,
  // Generic cards
  A: 0xf5c842, K: 0xff4d6d, Q: 0x3b8eea, J: 0x42d65a, T: 0xff8a3b,
  WILD: 0xffea66, SCATTER: 0xac1eff, BONUS: 0xff2bd6,
};

function getGlowColor(key, genre) {
  return GLOW_COLORS[key] || 0xffffff;
}
```

## Rim stroke colors (outer border)

The rim stroke creates separation from any background. Don't use white for every symbol — match to the tier:

| Tier | Rim color | Notes |
|---|---|---|
| WILD | `0xffea66` (gold) | Universally premium |
| SCATTER | `0xac1eff` (electric purple) | Mystical |
| BONUS | `0xff2bd6` (hot pink) | Exciting |
| Premium themed | Match gradient highlight | E.g. ANKH = gold rim |
| Card letters | `0xffffff` at 0.65 alpha | Clean and clear |
