# Driving the Verification Tools

QA requires *running* the game, not reading its code. This file maps the QA loop onto the browser
automation tools Claude has available, so you can launch a generated single-HTML slot, screenshot its
states, read the console, resize to a phone viewport, and force states for profiling. Tool names below
are the MCP tools commonly present (`Claude_Preview` and `Claude_in_Chrome`); use whichever your
environment exposes. If none is available, you cannot complete QA — say so explicitly instead of
claiming the game runs.

## Two tool families

- **Preview MCP** (`preview_start`, `preview_screenshot`, `preview_console_logs`, `preview_eval`,
  `preview_resize`, `preview_network`, `preview_stop`): lightweight, fast for a self-contained HTML file.
  First choice for a single-file slot build.
- **Chrome MCP** (`navigate`, `computer`/screenshot, `read_console_messages`, `read_network_requests`,
  `javascript_tool`, `resize_window`): full browser; use for real input simulation, multi-tab, or when
  Preview can't load the page.

Pick one and drive the whole loop with it; don't half-switch mid-pass.

## Map the QA loop to tool calls

| QA step | Preview MCP | Chrome MCP |
|---|---|---|
| Launch the build | `preview_start` (path/URL to the HTML) | `navigate` to the file/URL |
| Console gate | `preview_console_logs` | `read_console_messages` |
| Failed loads | `preview_network` | `read_network_requests` |
| Screenshot a state | `preview_screenshot` | screenshot via `computer` |
| Phone viewport | `preview_resize` (e.g. 390×844) | `resize_window` |
| Force a state / read FPS | `preview_eval` (run JS in page) | `javascript_tool` |
| Tear down | `preview_stop` | close tab |

## Console gate first

Right after launch, pull console logs and fail immediately on any uncaught error, failed asset/network
load, or an `await Tone.start()` / AudioContext warning. A red console is an automatic QA fail — fix it
before grading anything visual.

## Set a phone viewport before grading

The primary target is portrait phone. Resize to ~390×844 (iPhone) or ~393×851 (Pixel) *before*
screenshotting, so the visual rubric and layout checks reflect the real case, not a desktop window.

## Force states with in-page eval

You can't wait for a random big win. Inject a seeded RNG or call the engine directly to force the exact
state you need to profile/screenshot. Example via `preview_eval` / `javascript_tool`:

```javascript
// Force a guaranteed max-tier win for the worst-frame perf capture + celebration screenshot.
window.__engine?.forceResult?.({ tier: 'mega' });   // expose a debug hook in the build for QA
window.__engine?.spin?.();
// Then read the frame-time sampler's last log (see performance-checklist.md).
```

If the build doesn't expose a debug hook, add one in a QA/debug build — repeatable state-forcing is what
makes performance and visual QA objective instead of "I spun a few times."

## Read FPS from the page

Run the frame-time sampler from `performance-checklist.md` via eval, let it collect ~300 frames during a
forced big win, and read the logged `avg/max/fps` line back through the console logs tool. That number is
your sign-off evidence — capture the **worst** frame, not just the average.

## Screenshots to capture every pass

At phone viewport, capture: base reels (idle), a forced winning spin mid-celebration, the bonus/free-spins
screen, the loading screen, and the paytable. Grade each against `references/visual-qa-rubric.md`.

## What the tools can't verify

Emulated viewports don't reproduce: the iOS mute switch, true thermal throttling, real touch latency, or
the actual phone-speaker audio mix. For those, a real device is required — note them as "not verified
on hardware" in the report (see `references/device-test-matrix.md`). Don't let a clean emulator pass
imply a clean device pass.
