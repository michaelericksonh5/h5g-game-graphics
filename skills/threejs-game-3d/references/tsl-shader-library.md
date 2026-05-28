# TSL Shader Library

TSL (Three Shader Language) is the 2026 way to write Three.js shaders. It compiles to both WGSL (WebGPU) and GLSL (WebGL 2) from the same source. Write once, both renderers.

## TSL basics

```javascript
// All TSL nodes import from 'three/tsl'
import { 
  vec2, vec3, vec4, float, int,
  sin, cos, abs, fract, mod, mix, clamp, smoothstep, step,
  uniform, attribute, varying,
  positionWorld, positionLocal, normalWorld, uv,
  texture, color
} from 'three/tsl';

// Uniforms you update from JS
const time = uniform(0);
// In render loop: time.value = clock.getElapsedTime();

// Assign to material nodes
material.colorNode = yourColorExpression;
material.emissiveNode = yourGlowExpression;
```

## Recipe: Neon plasma rail / edge glow

Perfect for cabinet frame borders, payline highlights, win effects.

```javascript
import { vec3, float, sin, cos, uniform, positionWorld, uv, mix, color, smoothstep, abs } from 'three/tsl';

const time = uniform(0);
const plasmaColor = color(0x00ff88); // change for theme
const darkColor   = color(0x001a08);

// Edge glow based on UV proximity to frame edge
const edgeDist = uv().x.oneMinus().min(uv().x).min(uv().y.oneMinus()).min(uv().y);
const edgeGlow = smoothstep(float(0.0), float(0.06), edgeDist).oneMinus();

// Pulsing time-based shimmer along the edge
const shimmer = sin(positionWorld.x.mul(12).add(time.mul(3))).mul(0.3).add(0.7);
const pulse   = sin(time.mul(2)).mul(0.2).add(0.8);

const finalColor = mix(darkColor, plasmaColor, edgeGlow.mul(shimmer).mul(pulse));

material.colorNode    = finalColor;
material.emissiveNode = plasmaColor.mul(edgeGlow.mul(2.0));
```

## Recipe: Holographic / iridescent surface

For futuristic overlays, bonus game portals, sci-fi symbols.

```javascript
import { vec3, sin, cos, uniform, normalWorld, positionWorld, uv, mix, color, float, dot } from 'three/tsl';

const time     = uniform(0);
const viewDir  = vec3(0, 0, 1); // approximation; use camera pos in real build

// Fresnel — edge brightens as surface faces away from camera
const fresnel = float(1).sub(dot(normalWorld, viewDir)).pow(float(2)).clamp(float(0), float(1));

// Rainbow hue shift cycling
const r = sin(uv().x.mul(6).add(time)).mul(0.5).add(0.5);
const g = sin(uv().x.mul(6).add(time).add(float(2.09))).mul(0.5).add(0.5);
const b = sin(uv().x.mul(6).add(time).add(float(4.19))).mul(0.5).add(0.5);
const rainbow = vec3(r, g, b);

const baseColor = color(0x111122);
const holo      = mix(baseColor, rainbow, fresnel.mul(0.7));

material.colorNode    = holo;
material.emissiveNode = rainbow.mul(fresnel.mul(1.5));
```

## Recipe: Liquid metal / chrome

For high-value symbol backgrounds, jackpot frame, premium cabinet finish.

```javascript
import { vec3, sin, cos, uniform, normalWorld, uv, mix, color, float, vec2, dot } from 'three/tsl';

const time    = uniform(0);
const silver  = color(0xe8eef5);
const shadow  = color(0x1a2030);
const reflect = color(0xffffff);

// Simulate a rotating environment reflection using normal-based lookup
const nx = normalWorld.x;
const ny = normalWorld.y;

const envU = sin(nx.mul(3.14).add(time.mul(0.2))).mul(0.5).add(0.5);
const envV = cos(ny.mul(3.14)).mul(0.5).add(0.5);

const metalness = mix(shadow, silver, envU);
const specular  = mix(metalness, reflect, envV.pow(float(8)));

material.colorNode = specular;
material.roughnessNode = float(0.05);
material.metalnessNode = float(1.0);
```

## Recipe: Scan lines (CRT / retro monitor effect)

For retro arcade aesthetic, bonus screens, retro-themed backgrounds.

```javascript
import { uv, sin, float, mix, color, step, fract } from 'three/tsl';

const baseTexture = texture(yourTexture, uv());
const screenUV    = uv().mul(float(resolution.y / 2)); // density of lines
const scanLine    = fract(screenUV.y).step(float(0.5));
const darkened    = baseTexture.rgb.mul(float(0.7));

material.colorNode = mix(darkened, baseTexture.rgb, scanLine);
```

## Recipe: Godray / volumetric light shaft

For bonus game entry, jackpot reveal, divine/fantasy theme.

```javascript
import { vec2, vec3, uv, uniform, float, mix, color, length, smoothstep } from 'three/tsl';

const time       = uniform(0);
const lightPos   = uniform(vec2(0.5, 0.8)); // screen-space light position
const rayColor   = color(0xfffae0);
const bgColor    = color(0x0a0418);

const dir        = uv().sub(lightPos);
const dist       = length(dir);
const rays       = float(0);

// March 32 samples toward light (simplified)
// Full implementation with loop in references/godray-full.glsl
const falloff    = smoothstep(float(1.0), float(0.0), dist.mul(float(2.0)));

material.colorNode = mix(bgColor, rayColor, falloff.mul(float(0.6)));
```

## Recipe: Chromatic aberration (post-process)

For big-win screen shake, lens distortion on camera hit. Applied via `ShaderPass` in EffectComposer.

```javascript
const chromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    uOffset: { value: 0.003 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - vec2(0.5);
      float r = texture2D(tDiffuse, vUv + dir * uOffset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir * uOffset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};
// Animate uOffset: 0 normally, spike to 0.008 on win screen shake
```

## Recipe: Gold shimmer animation

For jackpot frames, big-win text, premium symbol borders. Animated diagonal shimmer stripe.

```javascript
import { uv, sin, cos, uniform, float, vec2, mix, color, smoothstep, dot } from 'three/tsl';

const time     = uniform(0);
const goldDark = color(0x9c6a1a);
const goldMid  = color(0xf5c842);
const goldHigh = color(0xfffae0);

// Diagonal stripe moving across the surface
const diagUV   = uv().x.add(uv().y);
const stripe   = sin(diagUV.mul(float(4)).sub(time.mul(1.5))).mul(0.5).add(0.5);
const shimmer  = stripe.smoothstep(float(0.7), float(0.95));

const base     = mix(goldDark, goldMid, uv().y);
const final    = mix(base, goldHigh, shimmer);

material.colorNode    = final;
material.emissiveNode = goldHigh.mul(shimmer.mul(0.8));
```

## Updating uniforms in the render loop

```javascript
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Update all time uniforms
  timeUniform.value = t;

  // Camera orbit (for cabinet preview)
  camera.position.x = Math.sin(t * 0.3) * 6;
  camera.position.z = Math.cos(t * 0.3) * 6;
  camera.lookAt(0, 0, 0);

  composer.render();
}
```

## Performance on mobile

- Each TSL material that has `colorNode` or `emissiveNode` set compiles a custom shader. Shader compilation causes a one-time stall on first render — do a warmup render off-screen or use a loading screen.
- Avoid branching (`if` / `select`) in tight loops inside TSL — GPUs parallelize poorly across divergent branches.
- Use `uniform()` for values that change per-frame; use `const` for compile-time constants. Changing a `const` requires recompile.
- On mobile, limit to 2-3 custom TSL materials per scene. Standard PBR materials use Three.js's built-in optimized shader which is much cheaper.
