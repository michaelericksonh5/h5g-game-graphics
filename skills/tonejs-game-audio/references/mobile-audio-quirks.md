# Mobile Audio Quirks: Unlock, Resume, and Decode

Web Audio on mobile is a minefield of platform rules that fail *silently* — no error, just no sound.
A slot with no audio on the player's phone reads as broken even when every synth is correct. This file
is the survival guide for the three things that actually break: the initial unlock, resumption after
backgrounding, and decode-time stalls. The transport/bus setup lives in `SKILL.md`; this is the mobile
reality layer around it.

## Quirk 1: the AudioContext starts suspended (the unlock)

Every browser starts the AudioContext in `suspended` state and will only move it to `running` inside a
**real user gesture**. iOS Safari is the strictest: the `Tone.start()` call must happen synchronously
inside a `touchend`/`pointerup`/`click` handler — not in a `setTimeout`, not in a promise that resolves
later, not on `pointerdown` in some iOS versions.

```javascript
// Correct: directly inside the gesture handler, awaited once.
async function unlockAudio() {
  await Tone.start();
  console.log('audio:', Tone.context.state);   // expect 'running'
}
startButton.addEventListener('pointerup', unlockAudio, { once: true });
```

Pitfalls that silently fail the unlock:

- Calling `Tone.start()` on page load or in a `DOMContentLoaded` handler — no gesture, stays suspended.
- Awaiting something *before* `Tone.start()` inside the handler — on some iOS versions the gesture
  "expires" across the await and the resume is rejected. Call `Tone.start()` **first**, then do other
  async work.
- Using `pointerdown` instead of `pointerup`/`click` — some iOS versions only honor the completed tap.

Use a "tap to start" overlay if the game has no natural first button — it guarantees a gesture before
any sound is needed.

## Quirk 2: backgrounding suspends the context (resume)

When the player switches apps, locks the phone, or the browser tab loses focus, the OS suspends the
AudioContext. On return it does **not** always auto-resume — iOS especially leaves it `suspended`, so
the next spin is silent. Wire a visibility handler to re-resume:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Tone.context.state !== 'running') {
    Tone.context.resume();   // safe to call repeatedly; no-op if already running
  }
});
```

Also resume on the next gesture as a belt-and-suspenders fallback — `visibilitychange` can fire before
the OS has actually released the audio hardware:

```javascript
window.addEventListener('pointerup', () => {
  if (Tone.context.state !== 'running') Tone.context.resume();
});
```

If you run `Tone.Transport`-driven music, the transport also pauses with the context. After resume,
check `Tone.Transport.state` and restart the loop position if your music engine expects continuity (see
`adaptive-game-music` for the stem-resume pattern).

## Quirk 3: decode/instantiation stalls (build at load, not on trigger)

Instantiating a synth or generating a reverb impulse response is CPU work. Do it on first *trigger* and
you get a frame stall exactly when the player taps spin — the worst possible moment. Build everything
during the loading screen, after the unlock:

```javascript
async function initAudio() {
  await Tone.start();
  await roomReverb.generate();    // IR generation — await it, it's not instant
  await hallReverb.generate();
  buildAllSfx();                  // construct every pooled synth now (see procedural-sfx-design)
}
```

`Tone.Reverb.generate()` is the classic offender — it synthesizes an impulse response and returns a
promise. Trigger a reverb-routed sound before `generate()` resolves and you get silence or a click.
Always `await` both reverbs before the first spin is possible.

## Quirk 4: the iOS hardware mute switch and volume

- The **silent/mute switch** on iPhone silences Web Audio in Safari (it's treated as "media," not a
  "ringer" sound). There is no JS workaround — if a tester reports no sound, check the physical switch
  first. Optionally show a one-time hint ("turn off silent mode for sound").
- iOS has no per-tab volume API; you can only set your own bus levels (see `procedural-sfx-design/
  references/mixing-guide.md`). Don't try to read or set system volume — it isn't exposed.

## Quirk 5: voice/polyphony limits on low-end devices

Cheap Android audio stacks choke past a few dozen simultaneous voices — a 200-coin shower that spawns
200 synths will crackle or drop out. Pool and throttle (full pattern in `procedural-sfx-design/
references/mixing-guide.md`): cap clinks to one per ~40ms from a round-robin pool of 4–6 synths. The
ear hears a satisfying stream; the CPU sees a trickle.

## Quirk 6: latency is higher and variable on mobile

Mobile output latency is 100–200ms and inconsistent. For tight visual/audio sync (a reel-stop thud
landing on the settle bounce), schedule the sound against the AudioContext clock, not `setTimeout`:

```javascript
const t = Tone.now() + 0.02;       // tiny lookahead absorbs jitter
reelStop.play(t);
```

Don't chase sub-frame sync on mobile — it isn't achievable. A 20–30ms lookahead reads as "tight" and
survives the platform's jitter.

## Mobile audio launch checklist

- [ ] `Tone.start()` called inside a real `pointerup`/`click`, `{ once: true }`, and *first* in the
      handler before any other await.
- [ ] `visibilitychange` + gesture fallback both call `Tone.context.resume()`.
- [ ] All synths built and both reverbs `generate()`-awaited during the loading screen.
- [ ] Coin/tick sounds pooled + throttled — no per-event allocation.
- [ ] Sounds scheduled on `Tone.now() + lookahead`, not `setTimeout`.
- [ ] Tested on a real iPhone *with the mute switch checked* and a mid-range Android.
