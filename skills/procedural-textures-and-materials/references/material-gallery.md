# Material Gallery

Named surface recipes built from the noise toolkit in `noise-functions.md`. Each bakes to a canvas at
load and serves as a PixiJS `Texture` or a Three.js `CanvasTexture` (often as both a color map and a
derived bump/roughness map). Tint per theme using `slot-art-style-presets` palette tokens.

## Recipe shape

```javascript
function bakeMaterial(w, h, colorFn) {
  const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(w,h);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const [r,g,b] = colorFn(x/w, y/h);            // 0..1 uv -> [0..255]^3
    const i=(y*w+x)*4; img.data[i]=r; img.data[i+1]=g; img.data[i+2]=b; img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0); return cv;
}
const N = makeValueNoise(7);   // shared seeded noise
```

## Brushed metal

Anisotropic streaks + a soft vertical light gradient.

```javascript
function brushedMetal(u, v, base=[170,175,185]) {
  const streak = brushed(N, u*256, v*256);            // elongated noise
  const light  = 0.8 + 0.3*(1-v);                      // top brighter
  const f = (0.85 + streak*0.3) * light;
  return base.map(c => clamp255(c*f));
}
```

## Marble

Domain-warped fBm veins over a light base.

```javascript
function marble(u, v, base=[238,236,230], vein=[60,60,70]) {
  const t = warped(N, u*4, v*4, 6);                    // swirling field
  const veinMask = Math.pow(Math.abs(Math.sin(t*8)), 4);
  return base.map((c,i)=> clamp255(c*(1-veinMask) + vein[i]*veinMask));
}
```

## Velvet / felt (casino table)

Low-frequency fBm for a soft nap; deep saturated base. Great for backgrounds.

```javascript
function velvet(u, v, base=[20,80,40]) {              // casino green
  const nap = fbm(N, u*40, v*40, { octaves:3, gain:0.6 });
  const sheen = 0.9 + 0.2*nap;
  return base.map(c=>clamp255(c*sheen));
}
```

## Sandstone (Egyptian)

Grainy fBm + warm gradient + occasional darker strata.

```javascript
function sandstone(u, v, base=[206,180,130]) {
  const grain = fbm(N, u*120, v*120, { octaves:5, gain:0.55 });
  const strata = 0.92 + 0.08*Math.sin(v*30 + fbm(N,u*4,v*4)*6);
  const f = (0.85 + grain*0.25) * strata;
  return base.map(c=>clamp255(c*f));
}
```

## Wood grain

Ring pattern from distance + noise jitter.

```javascript
function wood(u, v, light=[150,100,55], dark=[90,55,25]) {
  const cx=0.5, cy=0.5; const d=Math.hypot(u-cx,(v-cy)*0.3);
  const rings = Math.sin((d*60) + fbm(N,u*6,v*6)*8)*0.5+0.5;
  return light.map((c,i)=>clamp255(c*(1-rings)+dark[i]*rings));
}
```

## Holographic film

Use the hue sweep from the shader side for animation, but a baked static version:

```javascript
function holoFilm(u, v) {
  const h = (u*0.7 + v*0.3 + fbm(N,u*3,v*3)*0.4) % 1;
  const [r,g,b] = hsv2rgb(h, 0.5, 1.0);
  return [r*255,g*255,b*255];
}
```

(For the animated shimmer, drive a shader — see
`game-shaders-and-effects/references/custom-glsl-library.md`.)

## Corroded copper

Copper base with green patina blooms from a high-threshold noise mask.

```javascript
function copper(u, v, base=[184,115,51], patina=[80,160,140]) {
  const m = fbm(N, u*8, v*8, { octaves:5 });
  const t = Math.max(0, (m-0.55))*2.2;                 // patina only above threshold
  return base.map((c,i)=>clamp255(c*(1-t)+patina[i]*t));
}
```

## Deriving maps for Three.js

A grayscale of any recipe doubles as a bump/roughness map:

```javascript
const colorTex = new THREE.CanvasTexture(bakeMaterial(512,512, brushedMetal));
const roughTex = new THREE.CanvasTexture(bakeNoiseTexture(512,512, (x,y)=>brushed(N,x,y)));
const mat = new THREE.MeshPhysicalMaterial({ map: colorTex, roughnessMap: roughTex, metalness: 0.9 });
```

For the lighting that makes these read as 3D, see `threejs-game-3d/references/lighting-presets.md`.

## Genre → material quick map

| Theme | Background | Frame/chassis |
|---|---|---|
| Egyptian | sandstone | corroded copper / gold metal |
| Cyberpunk | dark velvet + holo film accents | brushed metal |
| Asian | red velvet | gold metal + wood |
| Vegas | green velvet | brushed metal/chrome |
| Dark Fantasy | stone (marble dark) | corroded copper |
| Underwater | warped marble (blue) | brushed metal |

## Performance

Bake all materials during the loading screen; cache textures; reuse across sprites. A 512² bake is a
few ms — acceptable at load, never per frame. Cap to the sizes you display.
