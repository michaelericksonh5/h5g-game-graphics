# Lighting Presets by Genre

Every scene starts with a three-point rig. These presets tune that rig per genre.
Copy the relevant preset into your scene — don't start from scratch with a single DirectionalLight.

## Egyptian / Ancient Civilization

Warm, dramatic, sandstone-tinted. Deep shadows. God rays from above.

```javascript
// Key: warm sunlight through temple opening
const key = new THREE.DirectionalLight(0xfff5d6, 3.0);
key.position.set(4, 10, 2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 3;
scene.add(key);

// Fill: bounced sandstone ambient — warm and low
const fill = new THREE.DirectionalLight(0xf5e6c4, 0.6);
fill.position.set(-3, 2, 4);
scene.add(fill);

// Rim: twilight desert sky — deep blue/purple
const rim = new THREE.DirectionalLight(0x8a6ae0, 0.8);
rim.position.set(0, 4, -8);
scene.add(rim);

// Torch glow points (scatter 2-4 around the scene)
const torch1 = new THREE.PointLight(0xff7b1b, 2.0, 8);
torch1.position.set(-3, 1.5, 2);
scene.add(torch1);

const ambient = new THREE.AmbientLight(0x1a1208, 0.4);
scene.add(ambient);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

## Cyberpunk Neon

Dark, punchy, high-contrast neon color mixing. No warm tones anywhere.

```javascript
// No white key light — use a very dim cool directional for form definition only
const key = new THREE.DirectionalLight(0x8090c0, 0.5);
key.position.set(3, 6, 2);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);

// Primary neon: hot pink
const pink = new THREE.PointLight(0xff2bd6, 3.0, 12);
pink.position.set(-4, 2, 3);
scene.add(pink);

// Secondary neon: cyan
const cyan = new THREE.PointLight(0x2bb0fb, 2.5, 10);
cyan.position.set(5, 1, -2);
scene.add(cyan);

// Accent: electric green
const green = new THREE.PointLight(0x00ff66, 1.5, 8);
green.position.set(0, 4, -5);
scene.add(green);

// Very low ambient — nearly black with a purple wash
const ambient = new THREE.AmbientLight(0x100818, 0.3);
scene.add(ambient);
```

## Asian Prosperity / Dragon

Rich reds, warm golds, jade accents. Soft and ceremonial.

```javascript
const key = new THREE.DirectionalLight(0xfff0d6, 2.5);
key.position.set(3, 8, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 6; // soft shadows
scene.add(key);

// Red lantern fill — the signature look
const lantern = new THREE.PointLight(0xff3030, 1.8, 10);
lantern.position.set(-2, 3, 3);
scene.add(lantern);

// Gold rim
const gold = new THREE.DirectionalLight(0xf5c842, 1.0);
gold.position.set(0, 3, -6);
scene.add(gold);

// Jade accent
const jade = new THREE.PointLight(0x42d65a, 0.8, 8);
jade.position.set(4, 1, -3);
scene.add(jade);

const ambient = new THREE.AmbientLight(0x1a0808, 0.5);
scene.add(ambient);
```

## Dark Fantasy / Gothic

Deep purples and silvers. Moonlight from above. Candle/torch warm spots below.

```javascript
const moon = new THREE.DirectionalLight(0xc0d0ff, 1.8);
moon.position.set(-2, 12, -4);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.radius = 8;
scene.add(moon);

// Purple magical fill
const magic = new THREE.PointLight(0x6a0dad, 2.5, 15);
magic.position.set(0, 4, 0);
scene.add(magic);

// Warm candle up-light (from below — unusual, adds menace)
const candle = new THREE.PointLight(0xff8c40, 1.5, 6);
candle.position.set(0, -1, 3);
scene.add(candle);

// Silver rim
const silver = new THREE.DirectionalLight(0xd0d8e8, 0.6);
silver.position.set(6, 2, -4);
scene.add(silver);

const ambient = new THREE.AmbientLight(0x080010, 0.3);
scene.add(ambient);
```

## Vegas Classic

Bright, saturated, cheerful. Think show room — everything is well-lit, color pops.

```javascript
const key = new THREE.DirectionalLight(0xffffff, 3.5);
key.position.set(4, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.radius = 2; // sharper shadows — theatrical
scene.add(key);

// Stage fill from opposite side
const fill = new THREE.DirectionalLight(0xffe0a0, 1.5);
fill.position.set(-5, 5, 3);
scene.add(fill);

// Red highlight — classic Vegas marquee
const marquee = new THREE.PointLight(0xff3030, 2.0, 12);
marquee.position.set(0, 6, -3);
scene.add(marquee);

const ambient = new THREE.AmbientLight(0x302010, 0.8); // warmer ambient
scene.add(ambient);
```

## Underwater / Ocean

Caustic blue-green light. Rays from above. Dim, atmospheric, mysterious.

```javascript
// Caustic sunlight from directly above — the signature underwater look
const caustic = new THREE.DirectionalLight(0xa0e8ff, 2.0);
caustic.position.set(1, 10, 1);
caustic.castShadow = true;
caustic.shadow.mapSize.set(1024, 1024);
caustic.shadow.radius = 12; // very soft — scattered by water
scene.add(caustic);

// Bioluminescent fill — deep teal
const bio = new THREE.PointLight(0x00c8a0, 2.5, 14);
bio.position.set(-3, 2, 0);
scene.add(bio);

// Coral accent — warm orange-pink
const coral = new THREE.PointLight(0xff7060, 1.5, 8);
coral.position.set(3, 0, 3);
scene.add(coral);

// Deep blue ambient — water absorbs warm light
const ambient = new THREE.AmbientLight(0x021020, 0.6);
scene.add(ambient);
```

## Sci-Fi / Space Station

Cold, precise, metallic. Blue-white primary. Holographic accents.

```javascript
const main = new THREE.DirectionalLight(0xd0e8ff, 2.0);
main.position.set(5, 8, 3);
main.castShadow = true;
scene.add(main);

// Emergency red (directional from below — adds tension)
const alert = new THREE.DirectionalLight(0xff2020, 0.4);
alert.position.set(0, -4, 2);
scene.add(alert);

// Holographic blue panel glow
const holo1 = new THREE.PointLight(0x40a0ff, 2.0, 10);
holo1.position.set(-4, 1, -2);
scene.add(holo1);

const holo2 = new THREE.PointLight(0x00ffcc, 1.5, 8);
holo2.position.set(4, 2, -3);
scene.add(holo2);

const ambient = new THREE.AmbientLight(0x040810, 0.4);
scene.add(ambient);
```

## Bloom tuning by genre

Bloom `UnrealBloomPass(size, strength, radius, threshold)`:

| Genre | strength | radius | threshold |
|---|---|---|---|
| Egyptian | 0.6 | 0.3 | 0.9 |
| Cyberpunk | 2.0 | 0.5 | 0.6 |
| Asian | 0.8 | 0.4 | 0.85 |
| Dark Fantasy | 1.5 | 0.4 | 0.75 |
| Vegas | 1.0 | 0.35 | 0.8 |
| Underwater | 1.2 | 0.6 | 0.7 |
| Sci-Fi | 1.4 | 0.4 | 0.7 |

Low threshold = more things glow. High threshold = only truly bright emissives glow.
Radius controls how far the bloom spreads; lower for crisp edges, higher for dreamy fog.

## Animating lights for "alive" scenes

Don't use static lights in a slot game. Flicker torches, pulse neon, pulse bonus lights:

```javascript
// Torch flicker (Egyptian, Fantasy)
const baseIntensity = 2.0;
function flickerTorch(light) {
  const flicker = Math.sin(Date.now() * 0.01) * 0.3
                + Math.sin(Date.now() * 0.023) * 0.2
                + Math.random() * 0.1;
  light.intensity = baseIntensity + flicker;
}

// Neon pulse (Cyberpunk)
function pulseNeon(light, baseI, speed = 2) {
  light.intensity = baseI + Math.sin(Date.now() * 0.001 * speed) * 0.5;
}

// Win state intensity surge — call on big win trigger
function winSurge(lights) {
  const targets = lights.map(l => ({ light: l, base: l.intensity }));
  const start = Date.now();
  const surgeLoop = () => {
    const t = (Date.now() - start) / 1000;
    if (t > 2) { targets.forEach(l => l.light.intensity = l.base); return; }
    targets.forEach(l => {
      l.light.intensity = l.base * (1 + Math.sin(t * 8) * 0.5 + (1 - t / 2));
    });
    requestAnimationFrame(surgeLoop);
  };
  surgeLoop();
}
```
