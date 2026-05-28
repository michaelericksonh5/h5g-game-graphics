---
name: tilemap-and-level-design
description: Build tile-based levels for 2D side-scrollers and arcade games with PixiJS v8. Use whenever the user wants to create a tilemap, tile map, tiles, tileset, level design, platform level, level data, collision map, autotiling, chunked level, or import from a level editor. Owns tile-based level RENDERING (per-tile sprites, baked RenderTexture, CompositeTilemap), procedural tile art generation (no external assets), the collision GRID data structure and extraction, autotiling bitmask logic, and level data format (JSON schema, loader, Tiled .tmj import, procedural generation). Disambiguation: physics/collision RESOLUTION belongs to platformer-physics (which consumes this skill's collision grid); the game loop and character controller belong to sidescroller-engine; parallax backgrounds belong to sidescroller-camera-and-parallax; reusable texture patterns belong to procedural-textures-and-materials.
---

# Tilemap and Level Design

Tile-based level rendering, procedural tile art, the collision grid, and level data. This skill exists because tile maps done naively cost a draw call per tile — a 100×20 level is 2,000 sprites and 60 fps dies on mobile. The fix is baking static layers to a `RenderTexture` once, culling dynamic layers to the camera window, and handing the physics system a flat byte array — not PixiJS objects.

## The core principle: separate data from display from physics

Three concerns, three structures:

- **Level data** — a JSON document: tile id arrays, entity spawns, layer metadata. Load once, treat as read-only. Format defined in `references/level-data-format.md`.
- **Display** — PixiJS containers/textures for what the player sees. Static layers baked to `RenderTexture`; dynamic layers culled by camera frustum.
- **Collision grid** — a `Uint8Array` (or `boolean[]`) indexed by `row * mapWidth + col`. Handed to `platformer-physics` at load time; never re-derived per frame.

Keep these three structures in sync at load time and never couple them at runtime.

## Tile grid model

```javascript
export const TILE = 32;  // logical pixels per tile side — all coordinate math uses this constant

// World ↔ tile coordinate conversion
export const worldToTile  = (wx, wy) => ({ col: Math.floor(wx / TILE), row: Math.floor(wy / TILE) });
export const tileToWorld  = (col, row) => ({ x: col * TILE, y: row * TILE });
export const tileCenter   = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

// Layer indices: lower index = drawn first (further back)
export const LAYER = { BACKGROUND: 0, COLLISION: 1, DECORATION: 2 };
```

A loaded level exposes:

```javascript
class TileMap {
  constructor({ width, height, tileSize = TILE, layers, collisionTileIds }) {
    this.width   = width;   // tiles
    this.height  = height;
    this.tileSize = tileSize;

    // layers[LAYER.COLLISION] is the authority for solid tiles
    this.layers  = layers;  // Array<Uint16Array> each length width*height

    // Flat collision grid — the only thing platformer-physics needs
    this.solidGrid = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      this.solidGrid[i] = collisionTileIds.has(layers[LAYER.COLLISION][i]) ? 1 : 0;
    }
  }

  tileAt(layerIdx, col, row) {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return 0;
    return this.layers[layerIdx][row * this.width + col];
  }

  isSolid(col, row) {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return false;
    return this.solidGrid[row * this.width + col] === 1;
  }
}
```

## Procedural tile art (no external assets)

Bake once at startup into a `PIXI.Texture` atlas. All tiles share one atlas → one draw call per batch.

```javascript
import * as PIXI from 'pixi.js';

const TILE_IDS = { EMPTY: 0, GROUND_TOP: 1, DIRT: 2, PLATFORM_EDGE_L: 3,
                   PLATFORM_EDGE_R: 4, DECOR_GRASS: 5, STONE: 6 };

function buildTileAtlas(app) {
  const cols = 8, rows = 2;
  const rt = PIXI.RenderTexture.create({ width: cols * TILE, height: rows * TILE });
  const g  = new PIXI.Graphics();

  // GROUND_TOP (id=1): green top strip over earthy body
  g.rect(0, 0, TILE, TILE)
   .fill({ color: 0x4a7c3f })
   .rect(0, TILE * 0.35, TILE, TILE * 0.65)
   .fill({ color: 0x7a5230 })
   .rect(0, TILE * 0.3, TILE, TILE * 0.08)
   .fill({ color: 0x3d6b32 });
  app.renderer.render({ container: g, target: rt, transform: new PIXI.Matrix().translate(TILE, 0) });

  // DIRT (id=2): mottled brown fill
  g.clear().rect(0, 0, TILE, TILE).fill({ color: 0x7a5230 });
  for (let i = 0; i < 6; i++) {
    const px = 4 + (i * 5) % (TILE - 8), py = 4 + (i * 7) % (TILE - 8);
    g.circle(px, py, 2).fill({ color: 0x5c3d1e });
  }
  app.renderer.render({ container: g, target: rt, transform: new PIXI.Matrix().translate(TILE * 2, 0) });

  // PLATFORM_EDGE_L/R (id=3,4): light stone plank with rounded ends
  g.clear().roundRect(0, TILE * 0.2, TILE, TILE * 0.6, 4).fill({ color: 0xc8b89a })
   .roundRect(2, TILE * 0.22, TILE - 4, TILE * 0.56, 3).fill({ color: 0xddd0b8 });
  app.renderer.render({ container: g, target: rt, transform: new PIXI.Matrix().translate(TILE * 3, 0) });

  // DECOR_GRASS (id=5): tufts of grass — decoration layer only, not solid
  g.clear().rect(0, 0, TILE, TILE).fill({ color: 0, alpha: 0 });
  const blades = [[4,20],[8,16],[12,22],[18,18],[24,14],[28,20]];
  for (const [bx, h] of blades) {
    g.moveTo(bx, TILE).lineTo(bx - 2, TILE - h).lineTo(bx + 2, TILE - h).fill({ color: 0x5aa832 });
  }
  app.renderer.render({ container: g, target: rt, transform: new PIXI.Matrix().translate(TILE * 5, 0) });

  // STONE (id=6): grey block with highlight rim
  g.clear().rect(0, 0, TILE, TILE).fill({ color: 0x606060 })
   .rect(1, 1, TILE - 2, 3).fill({ color: 0x909090 })
   .rect(1, TILE - 4, TILE - 2, 3).fill({ color: 0x404040 });
  app.renderer.render({ container: g, target: rt, transform: new PIXI.Matrix().translate(TILE * 6, 0) });

  g.destroy();
  return { texture: rt, tileSize: TILE, cols };
}

// Sprite frame for a given tile id
function tileFrame(atlas, id) {
  return new PIXI.Texture({ source: atlas.texture.source,
    frame: new PIXI.Rectangle((id % atlas.cols) * TILE, Math.floor(id / atlas.cols) * TILE, TILE, TILE) });
}
```

## Rendering strategies

See `references/tile-rendering.md` for full code and mobile perf budget. Summary:

| Strategy | When to use | Draw calls |
|---|---|---|
| **Baked RenderTexture** | Static background/collision layers that never change | 1 per bake |
| **Camera-culled sprites** | Dynamic/interactive tiles (moving platforms, breakable blocks) | 1 per visible tile |
| **`@pixi/tilemap` CompositeTilemap** | Long scrolling levels (>200 tiles wide), chunked streaming | 1 per 16×16 chunk |

Rule of thumb for mobile: keep the visible sprite count under 300. A 1080×1920 viewport at TILE=32 is ~34×60 = 2,040 tiles worst case — always cull or bake.

### Static layer bake (one-liner pattern)

```javascript
async function bakeStaticLayer(app, tileMap, layerIdx, atlas) {
  const rt = PIXI.RenderTexture.create({
    width:  tileMap.width  * TILE,
    height: tileMap.height * TILE,
  });
  const container = new PIXI.Container();
  for (let row = 0; row < tileMap.height; row++) {
    for (let col = 0; col < tileMap.width; col++) {
      const id = tileMap.tileAt(layerIdx, col, row);
      if (id === 0) continue;
      const sprite = new PIXI.Sprite(tileFrame(atlas, id));
      sprite.x = col * TILE;
      sprite.y = row * TILE;
      container.addChild(sprite);
    }
  }
  app.renderer.render({ container, target: rt });
  container.destroy({ children: true });
  return new PIXI.Sprite(rt);
}
```

## Collision grid hand-off to platformer-physics

After loading, expose `tileMap.solidGrid` and `tileMap.isSolid` directly:

```javascript
// In your game bootstrap
const tileMap = await loadLevel(app, 'level-01.json', atlas);

// Hand the grid to the physics system — that's the ONLY coupling
physicsWorld.setTileGrid({
  solidGrid: tileMap.solidGrid,
  width:     tileMap.width,
  height:    tileMap.height,
  tileSize:  tileMap.tileSize,
  isSolid:   (col, row) => tileMap.isSolid(col, row),
});
```

`platformer-physics` calls `isSolid(col, row)` during its sweep — it never holds a PixiJS reference. Updating the grid at runtime (breakable blocks, doors opening):

```javascript
function breakTile(tileMap, col, row) {
  const idx = row * tileMap.width + col;
  tileMap.layers[LAYER.COLLISION][idx] = 0;
  tileMap.solidGrid[idx] = 0;          // physics sees it immediately next frame
  rebuildChunkDisplay(tileMap, col, row);  // visual update only
}
```

## Autotiling (4-bit bitmask)

Autotiling makes ground edges look finished without manually authoring every border tile. See `references/tile-rendering.md` for the full 16-entry lookup table. Pattern:

```javascript
function autotileBitmask(tileMap, col, row) {
  const n = tileMap.isSolid(col,     row - 1) ? 1 : 0;
  const e = tileMap.isSolid(col + 1, row)     ? 2 : 0;
  const s = tileMap.isSolid(col,     row + 1) ? 4 : 0;
  const w = tileMap.isSolid(col - 1, row)     ? 8 : 0;
  return n | e | s | w;  // 0–15, index into AUTOTILE_MAP
}
```

## Workflow

1. **Define tile ids and collision set** in your par config before writing level JSON.
2. **Generate or import level data.** Procedural levels: see `references/level-data-format.md`. Tiled export: use the `.tmj` importer in the same file.
3. **Build the atlas** with `buildTileAtlas(app)` at startup.
4. **Load the level**, construct `TileMap`, build `solidGrid`.
5. **Hand `solidGrid` to `platformer-physics`.**
6. **Bake static layers** to `RenderTexture`; add culled sprite pool for dynamic layers.
7. **Apply autotile pass** over the collision layer after all tiles are placed.

## Common failures and their fixes

**Seams between tiles (1-pixel gaps).** Your sprite positions are fractional. Keep `TILE` an integer, use `Math.round` on all tile-to-world conversions, and set `app.renderer.roundPixels = true`. Sub-pixel positions cause gaps under anti-aliasing.

**Off-by-one in tile ↔ world conversion.** `worldToTile` must floor, not round. `Math.round(wx / TILE)` maps pixels near the boundary to the wrong tile; `Math.floor` is always correct for grid lookup.

**Physics grid out of sync with visual tiles.** If you update `layers[LAYER.COLLISION]` without updating `solidGrid`, the physics system sees the old state. Always write both arrays in `breakTile` / `placeTile` helpers — never write directly from outside.

**Huge maps tanking performance.** Do not create sprites for tiles outside the camera + 1-tile margin. Chunk the map and stream chunks in as the camera scrolls. See `references/tile-rendering.md` for the chunking code.

**`RenderTexture` bake produces blank output.** The `container` must be added to the stage before rendering (PixiJS v8 requires the container to be in the scene graph for `render()`), or you must pass `clearColor` in the render options. Add `app.stage.addChild(container)` before baking, then `app.stage.removeChild(container)` after.

## Cross-skill pointers

- **platformer-physics** — consumes `solidGrid` + `isSolid`; owns sweep-AABB resolution; does not touch PixiJS.
- **sidescroller-engine** — owns the game loop, player controller, entity management; imports `TileMap` from this skill.
- **sidescroller-camera-and-parallax** — owns camera scroll math and layered background parallax; reads camera bounds that tile culling also uses.
- **procedural-textures-and-materials** — reusable noise/gradient texture utilities; the tile atlas bake above can delegate to it for richer surface patterns.
- **game-qa-and-testing** — QA layer; feed it the level JSON and the smoke test in `references/level-data-format.md`.
- **webgamedev-structure** — repo layout, Perforce depot paths, asset pipeline placement for level JSON files.

## References

- `references/tile-rendering.md` — camera culling math, three render strategies with full code, chunked streaming, baking, autotile bitmask lookup table, mobile perf budget.
- `references/level-data-format.md` — JSON level schema, loader, Tiled `.tmj` importer, procedural level generation example.
