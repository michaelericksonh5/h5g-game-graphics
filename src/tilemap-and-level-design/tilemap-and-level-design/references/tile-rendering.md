# Tile Rendering Reference

PixiJS v8 · mobile-first · zero external assets

---

## Mobile performance budget

| Metric | Budget | Notes |
|---|---|---|
| Visible sprites (dynamic layer) | ≤ 300 | Above this, batching overhead climbs on low-end phones |
| RenderTexture bakes per load | ≤ 4 | One per static layer; reuse across camera moves |
| Tile size (logical px) | ≥ 24, ≤ 64 | 32 is the sweet spot: readable, 30×55 tiles at 1080×1920 |
| Max map size before chunking | 200×50 tiles | ~400 KB of tile data; stream larger maps in chunks |
| Draw calls per frame | ≤ 12 | Baked layers = 1 each; culled pool = 1 per visible batch |

---

## Strategy 1 — Baked RenderTexture (static layers)

Use this for layers that never change at runtime: background scenery, the base collision layer, and non-interactive decoration. Renders the entire layer into a single texture once at load time.

```javascript
import * as PIXI from 'pixi.js';

/**
 * Bake a full tile layer to a single RenderTexture.
 * @param {PIXI.Application} app
 * @param {TileMap}          tileMap
 * @param {number}           layerIdx   LAYER.BACKGROUND | LAYER.COLLISION etc.
 * @param {TileAtlas}        atlas      { texture: RenderTexture, cols: number, tileSize: number }
 * @returns {PIXI.Sprite}   A sprite the size of the entire map; position at (0,0) in world space.
 */
export async function bakeLayer(app, tileMap, layerIdx, atlas) {
  const { width, height, tileSize: TS } = tileMap;
  const rt = PIXI.RenderTexture.create({ width: width * TS, height: height * TS });

  const container = new PIXI.Container();
  // Container must be in the scene graph before renderer.render() in PixiJS v8
  app.stage.addChild(container);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const id = tileMap.tileAt(layerIdx, col, row);
      if (id === 0) continue;
      const frame = tileFrameFrom(atlas, id);
      const sp    = new PIXI.Sprite(frame);
      sp.x = col * TS;
      sp.y = row * TS;
      container.addChild(sp);
    }
  }

  app.renderer.render({ container, target: rt, clearColor: 0x00000000 });
  app.stage.removeChild(container);
  container.destroy({ children: true });

  const sprite = new PIXI.Sprite(rt);
  sprite.label = `bakedLayer_${layerIdx}`;
  return sprite;
}

function tileFrameFrom(atlas, id) {
  const { texture, cols, tileSize: TS } = atlas;
  const col = id % cols, row = Math.floor(id / cols);
  return new PIXI.Texture({
    source: texture.source,
    frame:  new PIXI.Rectangle(col * TS, row * TS, TS, TS),
  });
}
```

Camera movement: just set `bakedSprite.x = -cameraX; bakedSprite.y = -cameraY;` — the entire baked layer moves as one unit.

---

## Strategy 2 — Camera-culled sprite pool (dynamic/interactive layer)

Use for tiles that can change at runtime (breakable blocks, doors, moving platforms, collectibles). Maintains a pool of sprites; each frame only sprites within the camera frustum + margin are shown.

```javascript
const CULL_MARGIN = 1; // extra tile margin around camera to prevent pop-in

export class CulledTileLayer {
  constructor(app, tileMap, layerIdx, atlas) {
    this.app      = app;
    this.tileMap  = tileMap;
    this.layerIdx = layerIdx;
    this.atlas    = atlas;
    this.container = new PIXI.Container();
    // Sprite pool: reuse sprites to avoid GC churn
    this._pool  = [];
    this._active = new Map(); // key: `${col},${row}` → sprite
  }

  /**
   * Call once per frame with current camera world position.
   * @param {number} camX  world X of camera top-left
   * @param {number} camY  world Y of camera top-left
   * @param {number} viewW viewport width in logical px
   * @param {number} viewH viewport height in logical px
   */
  update(camX, camY, viewW, viewH) {
    const { tileSize: TS, width, height } = this.tileMap;
    const c0 = Math.max(0, Math.floor(camX / TS) - CULL_MARGIN);
    const r0 = Math.max(0, Math.floor(camY / TS) - CULL_MARGIN);
    const c1 = Math.min(width  - 1, Math.ceil((camX + viewW) / TS) + CULL_MARGIN);
    const r1 = Math.min(height - 1, Math.ceil((camY + viewH) / TS) + CULL_MARGIN);

    // Return sprites outside frustum to pool
    for (const [key, sp] of this._active) {
      const [sc, sr] = key.split(',').map(Number);
      if (sc < c0 || sc > c1 || sr < r0 || sr > r1) {
        this.container.removeChild(sp);
        this._pool.push(sp);
        this._active.delete(key);
      }
    }

    // Activate sprites for tiles now in view
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const key = `${col},${row}`;
        if (this._active.has(key)) continue;
        const id = this.tileMap.tileAt(this.layerIdx, col, row);
        if (id === 0) continue;
        const sp = this._pool.pop() ?? new PIXI.Sprite();
        sp.texture = tileFrameFrom(this.atlas, id);
        sp.x = col * TS - camX;  // local to container whose origin is viewport top-left
        sp.y = row * TS - camY;
        this.container.addChild(sp);
        this._active.set(key, sp);
      }
    }

    // Update world-to-screen offset for all active sprites
    for (const [key, sp] of this._active) {
      const [sc, sr] = key.split(',').map(Number);
      sp.x = sc * TS - camX;
      sp.y = sr * TS - camY;
    }
  }

  /** Invalidate one tile (after a break/place). */
  invalidate(col, row) {
    const key = `${col},${row}`;
    const sp  = this._active.get(key);
    if (!sp) return;
    const id = this.tileMap.tileAt(this.layerIdx, col, row);
    if (id === 0) {
      this.container.removeChild(sp);
      this._pool.push(sp);
      this._active.delete(key);
    } else {
      sp.texture = tileFrameFrom(this.atlas, id);
    }
  }
}
```

---

## Strategy 3 — @pixi/tilemap CompositeTilemap (chunked streaming)

Use for levels wider than ~200 tiles. Streams 16×16 tile chunks as the camera scrolls; discards chunks that leave a two-viewport-wide buffer.

```javascript
import { CompositeTilemap } from '@pixi/tilemap';

const CHUNK = 16;  // tiles per chunk side

export class ChunkedTileMap {
  constructor(tileMap, atlasBaseTexture) {
    this.tileMap        = tileMap;
    this.atlasBase      = atlasBaseTexture;
    this.loadedChunks   = new Map(); // key: `${chunkCol},${chunkRow}` → CompositeTilemap
    this.container      = new PIXI.Container();
  }

  update(camX, camY, viewW, viewH) {
    const { tileSize: TS } = this.tileMap;
    const chunkPx = CHUNK * TS;

    // Determine which chunks are needed
    const cc0 = Math.floor(camX / chunkPx) - 1;
    const cr0 = Math.floor(camY / chunkPx) - 1;
    const cc1 = Math.ceil((camX + viewW)  / chunkPx) + 1;
    const cr1 = Math.ceil((camY + viewH)  / chunkPx) + 1;

    // Unload distant chunks (beyond 2× viewport buffer)
    const bufferChunks = Math.ceil(viewW / chunkPx) * 2;
    for (const [key, ct] of this.loadedChunks) {
      const [cc, cr] = key.split(',').map(Number);
      if (cc < cc0 - bufferChunks || cc > cc1 + bufferChunks) {
        this.container.removeChild(ct);
        ct.destroy();
        this.loadedChunks.delete(key);
      }
    }

    // Load missing chunks
    for (let cr = cr0; cr <= cr1; cr++) {
      for (let cc = cc0; cc <= cc1; cc++) {
        const key = `${cc},${cr}`;
        if (this.loadedChunks.has(key)) continue;
        const ct = this._buildChunk(cc, cr);
        if (ct) {
          ct.x = cc * chunkPx;
          ct.y = cr * chunkPx;
          this.container.addChild(ct);
          this.loadedChunks.set(key, ct);
        }
      }
    }

    this.container.x = -camX;
    this.container.y = -camY;
  }

  _buildChunk(chunkCol, chunkRow) {
    const { tileMap, atlasBase } = this;
    const { width, height, tileSize: TS } = tileMap;
    const ct = new CompositeTilemap();
    let hasTiles = false;

    for (let dr = 0; dr < CHUNK; dr++) {
      for (let dc = 0; dc < CHUNK; dc++) {
        const col = chunkCol * CHUNK + dc;
        const row = chunkRow * CHUNK + dr;
        if (col >= width || row >= height) continue;
        for (let layer = 0; layer < tileMap.layers.length; layer++) {
          const id = tileMap.tileAt(layer, col, row);
          if (id === 0) continue;
          const atlasCol = id % 8, atlasRow = Math.floor(id / 8);
          ct.tile(atlasBase, dc * TS, dr * TS, {
            u: atlasCol * TS, v: atlasRow * TS, tileWidth: TS, tileHeight: TS,
          });
          hasTiles = true;
        }
      }
    }
    if (!hasTiles) { ct.destroy(); return null; }
    return ct;
  }
}
```

---

## Autotile bitmask lookup (4-bit, 16 entries)

4-bit mask: bit 0 = north, bit 1 = east, bit 2 = south, bit 3 = west.

```javascript
// Maps bitmask (0–15) → tile id in the autotile atlas row.
// Your atlas must have an autotile row with these 16 tiles in order.
export const AUTOTILE_MAP = new Uint8Array([
// mask: WSEN
//  0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
    1,   9,   5,   13,  3,   11,  7,   15,  2,   10,  6,   14,  4,   12,  8,   16,
]);

/**
 * Compute the autotile frame id for a solid tile at (col, row).
 * Returns 0 if the tile is not solid (no autotile needed).
 */
export function autotileId(tileMap, col, row) {
  if (!tileMap.isSolid(col, row)) return 0;
  const n = tileMap.isSolid(col,     row - 1) ? 1 : 0;
  const e = tileMap.isSolid(col + 1, row)     ? 2 : 0;
  const s = tileMap.isSolid(col,     row + 1) ? 4 : 0;
  const w = tileMap.isSolid(col - 1, row)     ? 8 : 0;
  return AUTOTILE_MAP[n | e | s | w];
}

/**
 * Apply autotiling over the entire collision layer.
 * Writes computed ids back to layers[LAYER.COLLISION] so the
 * visual layer picks up the correct frame on next render.
 */
export function applyAutotile(tileMap) {
  const { width, height } = tileMap;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const id = autotileId(tileMap, col, row);
      if (id > 0) tileMap.layers[1][row * width + col] = id;
    }
  }
}
```

---

## Camera culling math detail

The visible tile range for a camera at world position `(camX, camY)` with viewport `(viewW × viewH)`:

```
col_min = floor(camX / TILE) - MARGIN
col_max = ceil((camX + viewW) / TILE) + MARGIN
row_min = floor(camY / TILE) - MARGIN
row_max = ceil((camY + viewH) / TILE) + MARGIN
```

Clamp to `[0, mapWidth - 1]` and `[0, mapHeight - 1]`. At TILE=32 and viewport 390×844 (iPhone SE): 13×27 = 351 tiles visible — just within budget without a margin. Use MARGIN=0 on low-end devices, MARGIN=1 on mid-range.

---

## Perf checklist before shipping

- [ ] Static background and collision layers baked to `RenderTexture` — not re-rendered each frame.
- [ ] Dynamic layer sprite count logged in dev mode; confirm stays under 300 on a 390×844 viewport.
- [ ] `app.renderer.roundPixels = true` to prevent sub-pixel seams.
- [ ] Atlas texture dimensions are power-of-two (256×256, 512×256, etc.) — GPU upload is faster.
- [ ] No `new PIXI.Texture(...)` calls inside the game loop — all frames cached at load time.
- [ ] Chunk boundaries confirmed: no duplicate tiles at chunk seam (off-by-one in chunk loop).
