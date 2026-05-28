# Custom GLSL Library

Ready-to-use fragment shaders for PixiJS v8 `Filter`s. Each is a self-contained effect you attach to a
display object or the stage. For Three.js/TSL versions of bloom-class effects, see
`threejs-game-3d/references/tsl-shader-library.md`; this file is the 2D PixiJS side.

## PixiJS v8 filter wrapper

```javascript
import { Filter, GlProgram } from 'pixi.js';

function makeFilter(frag, uniforms) {
  return new Filter({
    glProgram: GlProgram.from({
      vertex: /* glsl */`
        in vec2 aPosition;
        out vec2 vTextureCoord;
        uniform vec4 uInputSize;
        uniform vec4 uOutputFrame;
        uniform vec4 uOutputTexture;
        vec4 filterVertexPosition(void){
          vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
          p = p / uOutputTexture.xy * 2.0 - 1.0;
          p.y *= uOutputTexture.z;
          return vec4(p, 0.0, 1.0);
        }
        vec2 filterTextureCoord(void){ return aPosition * (uOutputFrame.zw * uInputSize.zw); }
        void main(void){ gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`,
      fragment: frag,
    }),
    resources: uniforms ? { uniforms } : undefined,
  });
}
```

## Additive glow (cheap bloom for 2D)

A single-pass approximation: sample neighbours, add bright parts back. Good for neon reels/symbols.

```glsl
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform vec2 uTexelSize;   // 1.0/resolution
uniform float uStrength;   // 0.0–2.0
out vec4 fragColor;
void main(){
  vec4 base = texture(uTexture, vTextureCoord);
  vec4 sum = vec4(0.0);
  for (int x=-2; x<=2; x++) for (int y=-2; y<=2; y++){
    vec4 s = texture(uTexture, vTextureCoord + vec2(float(x),float(y))*uTexelSize*1.5);
    sum += max(s - 0.6, 0.0);     // keep only bright pixels
  }
  fragColor = base + sum * (uStrength / 25.0);
}
```

## Holographic shimmer

Animated rainbow sheen modulated by luminance — for premium/special symbols.

```glsl
in vec2 vTextureCoord; uniform sampler2D uTexture; uniform float uTime; out vec4 fragColor;
vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0,0.0,1.0); }
void main(){
  vec4 c = texture(uTexture, vTextureCoord);
  float lum = dot(c.rgb, vec3(0.299,0.587,0.114));
  vec3 sheen = hue(fract(vTextureCoord.x*0.8 + vTextureCoord.y*0.4 + uTime*0.15));
  fragColor = vec4(mix(c.rgb, c.rgb + sheen*0.35, lum), c.a);
}
```

## Displacement distortion (heat/water)

Drive with a noise texture; offset the lookup. Use for underwater themes or bonus reveals.

```glsl
in vec2 vTextureCoord; uniform sampler2D uTexture; uniform sampler2D uNoise;
uniform float uTime; uniform float uAmount; out vec4 fragColor;
void main(){
  vec2 n = texture(uNoise, vTextureCoord*0.5 + uTime*0.03).rg - 0.5;
  fragColor = texture(uTexture, vTextureCoord + n*uAmount);
}
```

## Color grading (ColorMatrix alternative)

Win/dim states are usually done with PixiJS's built-in `ColorMatrixFilter` (`.brightness()`,
`.saturate()`, `.desaturate()`) — prefer it over custom GLSL for those. Use custom grading only for a
themed tint LUT:

```glsl
in vec2 vTextureCoord; uniform sampler2D uTexture; uniform vec3 uTint; uniform float uMix; out vec4 fragColor;
void main(){ vec4 c=texture(uTexture,vTextureCoord); vec3 g=vec3(dot(c.rgb,vec3(0.299,0.587,0.114)));
  fragColor=vec4(mix(c.rgb, g*uTint, uMix), c.a); }
```

## Scan lines (retro/cyberpunk)

```glsl
in vec2 vTextureCoord; uniform sampler2D uTexture; uniform float uResolutionY; out vec4 fragColor;
void main(){ vec4 c=texture(uTexture,vTextureCoord);
  float s=0.85+0.15*sin(vTextureCoord.y*uResolutionY*3.14159);
  fragColor=vec4(c.rgb*s, c.a); }
```

## Vignette

```glsl
in vec2 vTextureCoord; uniform sampler2D uTexture; uniform float uRadius; uniform float uSoft; out vec4 fragColor;
void main(){ vec4 c=texture(uTexture,vTextureCoord); float d=distance(vTextureCoord,vec2(0.5));
  fragColor=vec4(c.rgb*smoothstep(uRadius,uRadius-uSoft,d), c.a); }
```

## Driving time uniforms

```javascript
const holo = makeFilter(HOLO_FRAG, { uTime: 0 });
symbol.filters = [holo];
app.ticker.add((t) => { holo.resources.uniforms.uniforms.uTime += t.deltaMS / 1000; });
```

## Material / relief shading (sculpted symbols)

The main height→normal→Blinn+rim+Fresnel shader is in `SKILL.md`. Supporting variants:

**No separate height texture?** Derive height from albedo luminance (cheap, works for engraved icons):

```glsl
float heightFromLum(sampler2D t, vec2 uv){
  vec3 c = texture(t, uv).rgb; return dot(c, vec3(0.299,0.587,0.114));
}
```

**Faceted gem** — quantize the normal into flat facets and spike the spec for jewel "fire":

```glsl
// after computing N: snap to a coarse lattice so each facet is flat, then high-pow spec
vec3 Nf = normalize(floor(N * 6.0) / 6.0 + 0.001);
float fire = pow(max(dot(Nf, H), 0.0), 220.0);     // sharp, bright glints
vec3 jitter = 0.12 * sin(Nf.xyx * 17.0);           // per-facet color shift
fragColor.rgb += fire + jitter;
```

**Anisotropic brushed metal** — bend the half-vector along the brush axis `T` (e.g. `vec3(1,0,0)`):

```glsl
float TdotH = dot(normalize(T - N*dot(T,N)), H);
float aniso = uSpecStr * pow(sqrt(max(1.0 - TdotH*TdotH, 0.0)), uShine);
```

**Feeding the height map:** bake a grayscale height field once to a `RenderTexture` (PixiJS) from your
fBm/Worley generator (`procedural-textures-and-materials/references/noise-functions.md`), bind it as
`uHeight`, and animate only `uLight` for a moving glint. Bake static symbols entirely; reserve this live
shader for hero/special symbols — see `filter-performance.md` for the per-frame budget.

## Notes

- Update `uTexelSize`/`uResolutionY` on resize.
- Stack filters sparingly — see `filter-performance.md` for the mobile budget.
- Reserve heavy multi-pass bloom for 3D (Three.js `UnrealBloomPass`); the additive glow above is the
  2D-affordable substitute.
- Material shading is per-pixel: bake when static, run the live shader only for animated highlights.
