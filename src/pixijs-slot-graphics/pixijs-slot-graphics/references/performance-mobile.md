# Mobile Performance for PixiJS Slots

Mobile web is the deployment target. A slot at 60fps on desktop can stutter at 30fps on a 3-year-old Android. This reference is the optimization toolkit.

## The frame budget

At 60fps, you have 16.6ms per frame for everything: input, animation, layout, render. On a budget Android device, the GPU can swallow that whole budget if you're not careful. The targets:

- 60fps on iPhone 12 and equivalent Android (Pixel 6, Galaxy S21)
- 30fps minimum on iPhone 8 and equivalent Android (Pixel 3, Galaxy S9)
- The 30fps floor is acceptable but should only happen during particle storms (big-win celebrations); idle and spin should stay at 60.

## Draw call budget

Each draw call is a GPU command — roughly 60µs per call on a typical mobile GPU. Stay under 100 draw calls per frame for smooth 60fps; 150+ and budget devices will stutter.

How to check: `app.renderer.info.drawCalls` after each render (PixiJS v8 exposes this).

How to reduce:
- Use a sprite sheet (texture atlas) so multiple sprites share a texture and batch into one draw call. PixiJS bakes this automatically — same texture = same draw call.
- Use `ParticleContainer` for particle effects (more on this below).
- Avoid mixing filtered and unfiltered objects in interleaved order. Each filter changes GL state and breaks batching.
- Avoid Graphics objects with frequently-changing geometry. Each rebuild costs a draw call. Bake static decorations into a texture.

## ParticleContainer for many sprites

`Container` updates per-sprite transforms every frame and supports the full PixiJS feature set per child. `ParticleContainer` skips most of that and pushes hundreds of thousands of sprites into a single draw call.

When to use ParticleContainer:
- Coin showers (50-200 coin sprites)
- Confetti
- Background particle ambience (stars, dust)
- Any time you have 50+ sprites that share a texture

When NOT to use it:
- Individual sprites that need their own filters
- Sprites that need to be interactive

```javascript
import { ParticleContainer, Sprite } from 'pixi.js';

const coins = new ParticleContainer({
  dynamicProperties: { position: true, rotation: true, scale: true, alpha: true },
});

for (let i = 0; i < 200; i++) {
  const coin = new Sprite(coinTexture);
  coin.x = Math.random() * 1000;
  coin.y = -50;
  coins.addParticle(coin);
}
app.stage.addChild(coins);
```

## Resolution and devicePixelRatio

Retina screens have `devicePixelRatio` of 2 or 3. Rendering at 3x means 9x the pixel work — punishing on mobile GPUs.

```javascript
await app.init({
  resolution: Math.min(window.devicePixelRatio, 2),
  autoDensity: true,
});
```

Cap at 2. Past 2x, the visual gain is imperceptible but the GPU cost is linear in pixel count.

For text specifically, set `Text.resolution = app.renderer.resolution` to keep text crisp without going over.

## Texture compression

For projects with substantial sprite assets (themed slots with character art, etc), use KTX2 (compressed GPU textures). They take less GPU memory and decode faster than PNG.

```bash
# Convert PNG to KTX2 (offline build step)
toktx --bcmp --uastc --zcmp 22 character.ktx2 character.png
```

PixiJS v8 supports KTX2 loading natively. Reduces VRAM use by 50-75% with minimal quality loss.

For procedurally-drawn symbols (no external assets), this doesn't apply — but you should still bake them to a single texture atlas at load time rather than redrawing every frame.

## Filter costs

Each filter (Blur, ColorMatrix, custom) requires rendering to an offscreen target, processing, and compositing back. On mobile, large blur radii are expensive — a BlurFilter with strength 20 on a 500x500 area can cost 2-3ms.

Optimization:
- Use `BlurFilter` with `quality: 2` for mobile, not the default 4. The visual difference is minor; the perf gain is significant.
- For static glow effects, bake the blur into a sprite once at startup rather than running BlurFilter every frame.
- For win celebration glows (only active briefly), filters are fine. For idle ambient glows, bake them.

```javascript
const blur = new BlurFilter({ strength: 20, quality: 2 });
```

## Spin loop optimizations

The reel spin is the most frequent visual event in a slot. Optimize it specifically:

1. **Symbol pooling** — never create or destroy symbol sprites during a spin. Pool per reel, reuse.
2. **Motion blur scoped per reel** — apply BlurFilter to the reel strip container, not to individual symbols. One filter instance, batched.
3. **Disable filters when blur is 0** — set `strip.filters = null` between spins so the offscreen render target isn't allocated for nothing.
4. **Don't redraw the chassis every frame** — it's static. The chassis Graphics should be drawn once at init.

## Garbage collection

Mobile JS engines garbage-collect aggressively. Avoid allocating objects in the per-frame ticker:

```javascript
// BAD — allocates an object every frame
app.ticker.add(() => {
  const pos = { x: Math.random() * 100, y: Math.random() * 100 };
  particle.position.copyFrom(pos);
});

// GOOD — reuse a single Point
const _tmpPos = new Point();
app.ticker.add(() => {
  _tmpPos.set(Math.random() * 100, Math.random() * 100);
  particle.position.copyFrom(_tmpPos);
});
```

Allocations in tickers cause GC pauses — visible as occasional 50-100ms frame hitches.

## Texture sizes

Power-of-two textures (256, 512, 1024) render slightly faster than non-POT on mobile due to GPU mipmapping. Not a huge factor on modern devices but worth respecting for atlases.

Max recommended single texture size on mobile: 2048x2048. Larger and some older Android devices fall back to software rendering.

## Audio considerations

Audio is *cheap* compared to graphics, BUT decoding compressed audio (mp3/ogg) on first play causes a brief stutter. Decode all audio assets at startup, not on first event.

```javascript
// Decode upfront so first SFX play doesn't stutter the spin
await Promise.all(audioAssets.map(a => a.decodeAudio()));
```

## Measuring

Use the PixiJS devtools extension during development to see draw calls, texture memory, and per-frame timing breakdowns. Don't optimize blind — measure first.

For production telemetry, sample `app.renderer.info` periodically and ship the data back. Players on cheaper devices will surface in the histogram.

## Checklist before shipping

- [ ] 60fps idle on a mid-range Android in production build
- [ ] No frame drops during anticipation spin sequences
- [ ] Big-win celebration stays above 45fps
- [ ] Draw calls under 100 during spin, under 200 during celebration
- [ ] Texture memory under 64MB total
- [ ] All audio decoded before first user interaction
- [ ] Resolution capped at 2.0
- [ ] All particle systems use ParticleContainer
- [ ] No object allocations in tickers
