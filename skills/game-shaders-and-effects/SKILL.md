---
name: game-shaders-and-effects
description: "Apply advanced visual effects and shaders to slot and casino games — bloom, motion blur, holographic shimmer, displacement distortion, godrays, chromatic aberration, scan lines, color grading. Use when the user wants specific effects that go beyond basic rendering: \"make the neon glow\", \"add bloom\", \"screen shake effect\", \"lens distortion\", \"film grain\", \"cinematic look\", \"glowing reels\", \"win flash effect\", or any request to enhance the visual quality of an existing game scene. Works with both PixiJS filters (2D) and Three.js EffectComposer passes (3D). This skill owns the EFFECTS layer applied on top of a scene; use it instead of threejs-game-3d when the request is about an effect (glow, bloom, distortion) rather than building the 3D scene, materials, or lighting themselves. Load alongside pixijs-slot-graphics or threejs-game-3d."
---

# Game Shaders and Effects

The library of visual effects that separate "looks like a real game" from "looks like a prototype." These run on the GPU — adding them costs milliseconds per frame, not hundreds.

## Two jobs: post-FX *and* material shading

This skill owns two distinct shader jobs:

1. **Post-process FX** (most of this file) — bloom, motion blur, distortion, vignette, color grading: passes applied *on top of* a finished scene.
2. **Material shading** — lighting a surface so it reads as *sculpted gold / faceted gem / carved stone* instead of a flat fill. This is the live-shader half of `procedural-textures-and-materials`' sculpted-relief technique, and it's the difference between "premium" and "preschool" symbols. Use it for hero symbols, special states, and any element that needs a view-tracking highlight or Fresnel rim a baked texture can't give.

### Material/relief fragment shader (height → normal → Blinn + rim + Fresnel)

Light a flat shape from a procedural (or baked) height field. For *static* materials, bake instead (`procedural-textures-and-materials/references/sculpted-relief-shading.md`); use this shader when the highlight must move or the rim must track the view.

```glsl
// PixiJS v8 filter frag — see custom-glsl-library.md for the makeFilter() wrapper.
in vec2 vTextureCoord;
uniform sampler2D uTexture;   // albedo (the material fill)
uniform sampler2D uHeight;    // grayscale height field, same UVs
uniform vec2  uTexel;         // 1.0/resolution
uniform vec3  uLight;         // normalized light dir
uniform float uShine;         // 32 stone .. 256 gem
uniform float uSpecStr;       // 0.15 stone .. 1.0 gem/lacquer
uniform vec3  uRimColor;      // cool/accent rim
out vec4 fragColor;
void main(){
  vec4 albedo = texture(uTexture, vTextureCoord);
  float hl = texture(uHeight, vTextureCoord - vec2(uTexel.x,0.)).r;
  float hr = texture(uHeight, vTextureCoord + vec2(uTexel.x,0.)).r;
  float hd = texture(uHeight, vTextureCoord - vec2(0.,uTexel.y)).r;
  float hu = texture(uHeight, vTextureCoord + vec2(0.,uTexel.y)).r;
  vec3  N  = normalize(vec3((hl-hr)*3.0, (hd-hu)*3.0, 1.0));
  vec3  V  = vec3(0.0,0.0,1.0);
  vec3  H  = normalize(uLight + V);
  float diff = max(dot(N, uLight), 0.0);
  float spec = uSpecStr * pow(max(dot(N, H), 0.0), uShine);
  float rim  = pow(1.0 - max(dot(N, V), 0.0), 3.0);     // Fresnel edge
  float ao   = mix(0.55, 1.0, texture(uHeight, vTextureCoord).r);
  vec3  lit  = albedo.rgb * (0.3 + diff) * ao + spec + rim * uRimColor;
  fragColor  = vec4(lit, albedo.a);
}
```

Tune `uShine`/`uSpecStr`/`uRimColor` per material (full table in `sculpted-relief-shading.md`). Three.js/TSL surfaces should instead use `MeshPhysicalMaterial` + a procedural normal/roughness map (`threejs-game-3d`) — this GLSL path is the 2D PixiJS equivalent.

## PixiJS filter effects

PixiJS v8 applies filters as post-process passes on any `Container`. Filters stack — apply multiple by passing an array.

### Motion blur (reel spin)

```javascript
import { BlurFilter } from 'pixi.js';

// Create once per reel — don't create in the render loop
const reelBlur = new BlurFilter({ quality: 2 });
reelBlur.blurX = 0;  // no horizontal blur
reelBlur.blurY = 0;  // start at 0, scale to velocity

// In the spin update loop:
const blurAmount = Math.min(velocity / 1800 * 25, 25); // max 25px
reelBlur.blurY = blurAmount;
reel.strip.filters = blurAmount > 1 ? [reelBlur] : null; // disable when not spinning
```

Set `filters = null` when not spinning — this saves the offscreen render target allocation. Never leave filters active on objects that don't need them.

### Glow / additive bloom (PixiJS)

The PixiJS way to glow is not `DropShadowFilter` — it's a layered additive sprite. For symbol glows, win line glows, and button halos:

```javascript
import { BlurFilter, Graphics } from 'pixi.js';

function makeGlowLayer(width, height, color, strength = 0.7, spread = 22) {
  const glow = new Graphics();
  glow.ellipse(0, 0, width * 0.55, height * 0.55);
  glow.fill({ color, alpha: strength });

  const blur = new BlurFilter({ strength: spread, quality: 3 });
  glow.filters = [blur];
  glow.blendMode = 'add';
  return glow;
}

// Usage: add BELOW the element that should glow
const btnGlow = makeGlowLayer(100, 100, 0xac1eff, 0.8, 28);
btnContainer.addChildAt(btnGlow, 0);

// Animate for "pulsing" idle:
gsap.to(btnGlow.scale, { x: 1.2, y: 1.2, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
```

### Color matrix effects

PixiJS `ColorMatrixFilter` enables per-channel color transforms. Use for:

```javascript
import { ColorMatrixFilter } from 'pixi.js';

// Desaturate non-winning symbols during win presentation
const dimFilter = new ColorMatrixFilter();
dimFilter.saturate(-0.8);  // near-grayscale
dimFilter.brightness(0.6); // darken
nonWinnerSymbol.filters = [dimFilter];

// Win highlight — oversaturate and brighten
const winFilter = new ColorMatrixFilter();
winFilter.saturate(0.6);
winFilter.brightness(1.25);
winnerSymbol.filters = [winFilter];

// Free spins golden tint on entire stage
const freeSpinsFilter = new ColorMatrixFilter();
freeSpinsFilter.colorTone(0xffd76a, 0.35); // warm golden wash
app.stage.filters = [freeSpinsFilter];
```

### Displacement distortion

For liquid/water effects, portal warping, bonus entry transitions:

```javascript
import { DisplacementFilter, Sprite, Texture } from 'pixi.js';

// Displacement needs a grayscale noise sprite as the map
// Generate one procedurally or use a pre-made noise texture
const noiseSprite = new Sprite(noiseTexture);
noiseSprite.texture.source.addressMode = 'repeat';
app.stage.addChild(noiseSprite); // must be in scene graph

const displace = new DisplacementFilter({ sprite: noiseSprite, scale: 30 });
targetContainer.filters = [displace];

// Animate the noise sprite position for flowing effect
app.ticker.add(() => {
  noiseSprite.x += 0.5;
  noiseSprite.y += 0.3;
});
```

## Three.js EffectComposer passes

### Standard post chain setup

```javascript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Bloom — always include this
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.2, 0.4, 0.85
);
composer.addPass(bloom);

// Film grain — optional, adds cinematic texture
const film = new FilmPass(0.25, false); // 0.25 = grain intensity
composer.addPass(film);

// Always last — tone mapping and gamma
composer.addPass(new OutputPass());
```

### Dynamic bloom on win events

Surge bloom intensity during win celebrations:

```javascript
function winBloomSurge(bloomPass, tier) {
  const targets = { s: bloomPass.strength, r: bloomPass.radius };
  const targetStrength = bloomPass.strength + tier * 0.4;

  gsap.to(targets, {
    s: targetStrength,
    r: bloomPass.radius + 0.1,
    duration: 0.15,
    onUpdate: () => {
      bloomPass.strength = targets.s;
      bloomPass.radius = targets.r;
    },
    onComplete: () => {
      gsap.to(targets, {
        s: bloomPass.strength,
        r: bloomPass.radius,
        duration: 1.0,
        ease: 'power2.out',
        onUpdate: () => {
          bloomPass.strength = targets.s;
          bloomPass.radius = targets.r;
        },
      });
    },
  });
}
```

### Chromatic aberration (lens impact effect)

```javascript
const chromaShader = {
  uniforms: { tDiffuse: { value: null }, uOffset: { value: 0.0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uOffset; varying vec2 vUv;
    void main() {
      vec2 dir = normalize(vUv - vec2(0.5));
      float r = texture2D(tDiffuse, vUv + dir * uOffset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir * uOffset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }`,
};
const chromaPass = new ShaderPass(chromaShader);
composer.addPass(chromaPass);

// Spike on screen shake
function triggerChromaticHit(intensity = 0.008, duration = 0.4) {
  chromaPass.uniforms.uOffset.value = intensity;
  gsap.to(chromaPass.uniforms.uOffset, { value: 0, duration, ease: 'expo.out' });
}
```

### Vignette (focus player on reels)

```javascript
const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.5 },
    darkness: { value: 1.5 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float offset; uniform float darkness; varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      gl_FragColor = vec4(mix(texel.rgb, vec3(0.0), dot(uv,uv) * darkness), texel.a);
    }`,
};
const vignettePass = new ShaderPass(vignetteShader);
// Intensify during anticipation: vignettePass.uniforms.darkness.value = 2.5;
```

## Win flash overlay (full-screen)

For Big Win and above — a white or gold flash that fills the screen then quickly fades:

```javascript
// PixiJS version
function triggerWinFlash(app, color = 0xffea66) {
  const flash = new Graphics();
  flash.rect(0, 0, app.screen.width, app.screen.height).fill({ color, alpha: 0 });
  app.stage.addChild(flash);

  gsap.timeline()
    .to(flash, { pixi: { alpha: 0.7 }, duration: 0.06 })
    .to(flash, { pixi: { alpha: 0 }, duration: 0.4, ease: 'power2.out',
                 onComplete: () => flash.destroy() });
}
```

## Screen shake

Tier-scaled, returns a stop function so it can be interrupted:

```javascript
function screenShake(target, tier = 2) {
  const mag = [0, 2, 5, 9, 14][Math.min(tier, 4)];
  const dur = [0, 0.3, 0.5, 0.7, 1.0][Math.min(tier, 4)];
  if (mag === 0) return () => {};

  const baseX = target.x, baseY = target.y;
  const tween = gsap.to(target, {
    x: `+=${mag}`,
    duration: 0.04,
    yoyo: true,
    repeat: Math.round(dur / 0.04),
    ease: 'sine.inOut',
    onComplete: () => { target.x = baseX; target.y = baseY; },
  });
  return () => { tween.kill(); target.x = baseX; target.y = baseY; };
}
```

## References

- `references/filter-performance.md` — which filters are safe on mobile, resolution tricks, batch filter applications, disabling when off-screen
- `references/custom-glsl-library.md` — additional raw GLSL shaders for PixiJS custom filters (when TSL/built-in isn't enough)
