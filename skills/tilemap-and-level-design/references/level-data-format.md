# Level Data Format Reference

JSON schema, loader, Tiled `.tmj` importer, and procedural generation.

---

## JSON schema

```jsonc
{
  "version": 1,
  "name": "level-01",
  "width": 80,          // tiles
  "height": 20,
  "tileSize": 32,       // logical pixels

  // Tile ids that are treated as solid by the collision grid.
  // Add new solid tile types here without touching the loader.
  "collisionTileIds": [1, 2, 3, 4, 6, 13, 14, 15, 16],

  "layers": [
    {
      "name": "background",
      "index": 0,
      // Flat array, row-major: index = row * width + col. 0 = empty.
      "data": [0, 0, 0, /* ... width * height entries */ 0]
    },
    {
      "name": "collision",
      "index": 1,
      "data": [/* ... */]
    },
    {
      "name": "decoration",
      "index": 2,
      "data": [/* ... */]
    }
  ],

  // Entity spawns: any game object that is not a tile
  "entities": [
    { "type": "player_spawn", "col": 2, "row": 16 },
    { "type": "enemy_patrol", "col": 30, "row": 14, "props": { "patrolDist": 5 } },
    { "type": "coin",         "col": 18, "row": 12 },
    { "type": "checkpoint",   "col": 40, "row": 16 },
    { "type": "level_exit",   "col": 78, "row": 16 }
  ],

  // Optional: camera bounds override (defaults to full map)
  "cameraBounds": { "x": 0, "y": 0, "width": 2560, "height": 640 }
}
```

---

## Loader

```javascript
import * as PIXI from 'pixi.js';

/**
 * Load a level JSON file, build a TileMap, and emit entity spawns.
 *
 * @param {PIXI.Application} app
 * @param {string}           url       Path to level JSON (relative to assets folder)
 * @param {TileAtlas}        atlas     Built by buildTileAtlas() in the main skill
 * @returns {{ tileMap: TileMap, entities: EntitySpawn[], cameraBounds: Rect }}
 */
export async function loadLevel(app, url, atlas) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load level: ${url} (${resp.status})`);
  const json = await resp.json();

  if (json.version !== 1) throw new Error(`Unsupported level version: ${json.version}`);

  const { width, height, tileSize, layers: layerDefs, collisionTileIds, entities } = json;
  const solidSet = new Set(collisionTileIds);

  // Build typed arrays for each layer
  const layers = layerDefs
    .sort((a, b) => a.index - b.index)
    .map(ld => {
      const arr = new Uint16Array(width * height);
      for (let i = 0; i < ld.data.length; i++) arr[i] = ld.data[i];
      return arr;
    });

  const tileMap = new TileMap({ width, height, tileSize, layers, collisionTileIds: solidSet });

  const cameraBounds = json.cameraBounds ?? { x: 0, y: 0, width: width * tileSize, height: height * tileSize };

  return { tileMap, entities: entities ?? [], cameraBounds };
}

// ---- TileMap class (minimal; full version in SKILL.md) ----

export class TileMap {
  constructor({ width, height, tileSize, layers, collisionTileIds }) {
    this.width     = width;
    this.height    = height;
    this.tileSize  = tileSize;
    this.layers    = layers;

    this.solidGrid = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      this.solidGrid[i] = collisionTileIds.has(layers[1]?.[i] ?? 0) ? 1 : 0;
    }
  }

  tileAt(layerIdx, col, row) {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return 0;
    return this.layers[layerIdx]?.[row * this.width + col] ?? 0;
  }

  isSolid(col, row) {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return false;
    return this.solidGrid[row * this.width + col] === 1;
  }

  setTile(layerIdx, col, row, id) {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return;
    const idx = row * this.width + col;
    this.layers[layerIdx][idx] = id;
    // Keep collision grid in sync when the collision layer changes
    if (layerIdx === 1) this.solidGrid[idx] = id !== 0 ? 1 : 0;
  }
}
```

---

## Tiled .tmj importer

Tiled (mapeditor.org) exports JSON as `.tmj`. The schema differs from the internal format above. This adapter converts a `.tmj` into the internal level JSON at build time or load time.

```javascript
/**
 * Convert a Tiled .tmj export to the internal level JSON format.
 * Supports: orthogonal maps, CSV / base64-uncompressed layer data,
 * object layers for entity spawns, tileset firstgid offsets.
 *
 * @param {object} tmj   Parsed .tmj JSON
 * @returns {object}     Internal level JSON (version 1)
 */
export function importTmj(tmj) {
  if (tmj.orientation !== 'orthogonal') throw new Error('Only orthogonal Tiled maps are supported');

  const { width, height, tilewidth: tileSize } = tmj;
  const firstgid = tmj.tilesets?.[0]?.firstgid ?? 1;

  const layers     = [];
  const entities   = [];
  const solidIds   = new Set();

  // Map Tiled layer names to internal indices
  const LAYER_NAME_MAP = { background: 0, collision: 1, decoration: 2 };

  for (const tiledLayer of tmj.layers) {
    if (tiledLayer.type === 'tilelayer') {
      const idx = LAYER_NAME_MAP[tiledLayer.name.toLowerCase()] ?? layers.length;
      // Tiled tile ids start at firstgid; 0 = empty in Tiled
      const raw  = tiledLayer.data; // already an array if encoding is CSV/uncompressed
      const data = raw.map(id => (id === 0 ? 0 : id - firstgid + 1));

      // If the layer is named "collision", all non-zero tiles are solid
      if (tiledLayer.name.toLowerCase() === 'collision') {
        data.forEach(id => { if (id !== 0) solidIds.add(id); });
      }

      layers.push({ name: tiledLayer.name.toLowerCase(), index: idx, data });
    }

    if (tiledLayer.type === 'objectgroup') {
      for (const obj of tiledLayer.objects) {
        // Tiled object position is in world pixels; convert to tile coords
        const col = Math.floor(obj.x / tileSize);
        const row = Math.floor(obj.y / tileSize);
        entities.push({
          type:  obj.type || obj.name,
          col,
          row,
          props: obj.properties
            ? Object.fromEntries(obj.properties.map(p => [p.name, p.value]))
            : {},
        });
      }
    }
  }

  return {
    version: 1,
    name:    tmj.properties?.find(p => p.name === 'levelName')?.value ?? 'imported',
    width,
    height,
    tileSize,
    collisionTileIds: [...solidIds],
    layers:  layers.sort((a, b) => a.index - b.index),
    entities,
  };
}
```

Usage:

```javascript
const tmjText = await fetch('assets/levels/world1-1.tmj').then(r => r.text());
const tmj     = JSON.parse(tmjText);
const levelJson = importTmj(tmj);
const { tileMap, entities } = await loadLevel(app, levelJson, atlas);  // pass object directly
```

Modify `loadLevel` to accept either a URL string or a pre-parsed object:

```javascript
export async function loadLevel(app, urlOrJson, atlas) {
  const json = typeof urlOrJson === 'string'
    ? await fetch(urlOrJson).then(r => r.json())
    : urlOrJson;
  // ... rest of loader unchanged
}
```

---

## Procedural level generation

Generates a playable side-scroller level without any authored data. Suitable for infinite runners, test levels, or randomised stages.

```javascript
/**
 * Generate a platform level procedurally.
 *
 * @param {object} opts
 * @param {number} opts.width        Map width in tiles (default 120)
 * @param {number} opts.height       Map height in tiles (default 20)
 * @param {number} opts.tileSize     Logical px per tile (default 32)
 * @param {number} opts.seed         Integer seed for deterministic output
 * @returns {object}                 Internal level JSON (version 1)
 */
export function generateLevel({ width = 120, height = 20, tileSize = 32, seed = Date.now() } = {}) {
  const rng  = seededRng(seed);
  const col  = new Uint16Array(width * height); // collision layer
  const bg   = new Uint16Array(width * height); // background layer
  const dec  = new Uint16Array(width * height); // decoration layer

  const SOLID_GROUND = 2;    // tile id: dirt fill
  const GROUND_TOP   = 1;    // tile id: ground top
  const PLATFORM_L   = 3;
  const PLATFORM_R   = 4;
  const STONE        = 6;
  const DECOR_GRASS  = 5;

  // ---- Generate floor profile ----
  // Smooth random walk for floor row (row index from top)
  const floorRow = new Int32Array(width);
  floorRow[0] = Math.floor(height * 0.75);
  for (let c = 1; c < width; c++) {
    const delta = rng() < 0.5 ? (rng() < 0.4 ? 1 : 0) : (rng() < 0.4 ? -1 : 0);
    floorRow[c] = Math.max(height - 6, Math.min(height - 2, floorRow[c - 1] + delta));
  }

  // Fill floor and underground
  for (let c = 0; c < width; c++) {
    const fr = floorRow[c];
    // Ground top tile
    col[fr * width + c]  = GROUND_TOP;
    // Dirt fill down to bottom
    for (let r = fr + 1; r < height; r++) col[r * width + c] = SOLID_GROUND;
  }

  // ---- Floating platforms ----
  const platformCount = Math.floor(width / 12);
  for (let p = 0; p < platformCount; p++) {
    const startCol = 8 + Math.floor(rng() * (width - 20));
    const row      = floorRow[startCol] - 3 - Math.floor(rng() * 4);
    if (row < 2) continue;
    const pLen = 3 + Math.floor(rng() * 5);
    for (let dc = 0; dc < pLen; dc++) {
      const pc = startCol + dc;
      if (pc >= width) break;
      const mid = dc === 0 ? PLATFORM_L : (dc === pLen - 1 ? PLATFORM_R : STONE);
      col[row * width + pc] = mid;
    }
  }

  // ---- Decoration pass: grass tufts on ground-top tiles ----
  for (let c = 0; c < width; c++) {
    const fr = floorRow[c];
    if (fr > 0 && rng() < 0.4) dec[(fr - 1) * width + c] = DECOR_GRASS;
  }

  // ---- Background: sky gradient via tile 0 (empty = sky color handled by PixiJS background) ----
  // Stone backdrop 2 rows above underground fill
  for (let c = 0; c < width; c++) {
    const fr = floorRow[c];
    if (fr + 2 < height) bg[(fr + 2) * width + c] = STONE;
  }

  // ---- Entity spawns ----
  const entities = [
    { type: 'player_spawn', col: 2,        row: floorRow[2] - 1 },
    { type: 'level_exit',   col: width - 3, row: floorRow[width - 3] - 1 },
  ];

  // Enemies on platforms
  for (let c = 10; c < width - 10; c += 15 + Math.floor(rng() * 10)) {
    entities.push({ type: 'enemy_patrol', col: c, row: floorRow[c] - 1,
      props: { patrolDist: 4 + Math.floor(rng() * 4) } });
  }

  // Coins floating above floor
  for (let c = 5; c < width - 5; c += 4 + Math.floor(rng() * 4)) {
    entities.push({ type: 'coin', col: c, row: floorRow[c] - 2 });
  }

  return {
    version: 1,
    name: `proc_${seed}`,
    width, height, tileSize,
    collisionTileIds: [GROUND_TOP, SOLID_GROUND, PLATFORM_L, PLATFORM_R, STONE],
    layers: [
      { name: 'background', index: 0, data: Array.from(bg)  },
      { name: 'collision',  index: 1, data: Array.from(col) },
      { name: 'decoration', index: 2, data: Array.from(dec) },
    ],
    entities,
  };
}

// ---- Deterministic LCG RNG ----
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
```

---

## Smoke test

```javascript
import { generateLevel, loadLevel } from './level-data-format.js';

// Generate a level and verify tile counts
const json = generateLevel({ width: 80, height: 20, seed: 1234 });

console.assert(json.layers.length === 3,              'Three layers expected');
console.assert(json.entities.some(e => e.type === 'player_spawn'), 'Player spawn missing');
console.assert(json.collisionTileIds.length > 0,      'No solid tile ids');

// Verify collision layer has at least one solid tile
const solidCount = json.layers[1].data.filter(id => json.collisionTileIds.includes(id)).length;
console.assert(solidCount > 0, `Collision layer empty (seed 1234)`);

console.log(`[smoke] level generated: ${json.width}×${json.height}, ${solidCount} solid tiles, `
          + `${json.entities.length} entities`);
```
