# Eye Flight

**Eye Flight** is a first-person flying game controlled by gaze.

The aircraft moves forward automatically. Look toward where you want to fly, thread rings, dodge debris, and hit boost gates to build speed and score.

## Core interaction

- **Look left / right** to bank and steer.
- **Look up / down** to climb and dive.
- Quick gaze changes create stronger turns.
- Settled gaze produces finer trim for lining up gates.
- Pale rings score when you fly through them.
- Lime rings trigger a temporary speed boost.
- Red-edged debris damages the airframe.
- Near misses award bonus points.
- Three impacts end the flight early.

## Gaze setup

The camera mode uses a high-precision gaze setup:

- 21-point mobile calibration
- 9-point mobile precision tune
- separate left/right eye features
- roll-corrected eye coordinates
- local affine interpolation
- adaptive One Euro gaze filtering
- automatic center micro-tune
- mobile face-position stability guard
- 1280×720 selfie-camera request when available

Desktop uses a shorter calibration map while keeping the same underlying gaze pipeline.

## Mobile

Eye Flight is designed for phones as well as desktop:

- prefers the front/selfie camera
- supports portrait and landscape
- uses safe-area layout for notches and home indicators
- automatically recalibrates after orientation changes
- includes a Camera sheet for multi-camera devices
- pauses steering when tracking becomes unreliable instead of continuing on stale gaze

For best results, keep the phone near eye level and reasonably steady after calibration.

## Demo mode

Mouse and touch can simulate gaze so the flight game can be tested without a camera.

## Controls

- **C** — full recalibration
- **R** — quick recenter
- **M** — toggle demo/camera mode
- **F** — fullscreen
- **P** — camera preview

## Privacy

Eye Flight contains no account system, camera-frame upload backend, or frame-storage service. Camera frames are processed in the browser for gaze estimation.

See [`privacy.html`](./privacy.html).

## Hosting

This is a static GitHub Pages-ready app. Upload the files in this folder to the root of a repository and enable Pages from `main` / root.

See [`DEPLOY_TO_GITHUB_PAGES.md`](./DEPLOY_TO_GITHUB_PAGES.md).

## Local preview

```bash
python3 serve.py
```

## Technical notes

The first-person flight view is a procedural 2.5D canvas simulation. It does not require WebGL or downloaded art assets. The gaze-tracking runtime/model is loaded separately by the browser.

## License

Application code is provided under the MIT License. Third-party runtime/model assets retain their own licenses and terms.


## 1.0.1 stability fix

This release fixes a first-gate freeze in the normal scoring path. The gate sound previously received no combo value, which could generate an invalid Web Audio frequency in stricter browser implementations and abort the animation frame.

The release now:
- passes a valid combo value into gate audio
- validates every generated audio parameter
- treats audio as optional so sound can never stop gameplay
- keeps `requestAnimationFrame` alive after a recoverable frame error
- shows a recoverable error screen if the same runtime error repeats
- clears safety-paused state on retry, demo start, and replay
- removes obsolete target-game logic from the flight loop
- pauses the timer while gaze tracking is genuinely lost


## 1.0.2 mobile latency + calibration redesign

This release changes the phone tracking profile rather than simply adding more smoothing.

### What was wrong

The previous phone calibration ran on the browser animation loop. That loop can run at 60–120 Hz while the landmark model may only produce a new eye result around 20–30 times per second. Re-reading the same landmark result made calibration look more confident than it really was and let points advance too quickly.

The previous flight tracker also dropped high-motion eye tracking to roughly 8 Hz. That made sense for an efficiency experiment, but it is the wrong tradeoff for a gaze-steered flight game because eye motion is exactly when steering must feel responsive.

### What changed

- calibration now consumes only **fresh landmark results**
- mobile calibration is now **25 points in a 5×5 map**
- the 5×5 layout adds substantially more vertical coverage on tall phone screens
- each point waits for both **minimum wall time and enough unique stable eye samples**
- unstable eye/head motion slows a point instead of being averaged in
- the 9-point tuning pass also uses unique stable samples
- the final center tune now waits for more unique frames
- mobile camera capture now prefers **960×540 @ 30 fps** to reduce camera/model latency
- high-motion flight tracking no longer collapses to 8 Hz
- mobile steering uses a **low-latency gaze path** while the visible cursor stays more heavily filtered
- gaze filters update only when a new landmark sample arrives
- a small bounded prediction term compensates for part of camera/model latency
- the mobile regression uses richer **left-eye + right-eye features**
- local interpolation uses binocular distance rather than average-eye distance alone
- the final center hold can optionally learn a small **near-field pose correction** for close phone use

A phone held close to the face has a different geometry from a laptop webcam. Small head translations can create much larger apparent changes, so the phone build also retains its pose-stability guard.

No software-only RGB selfie-camera tracker is laboratory grade. Accuracy still depends on lighting, glasses glare, camera field of view, device movement, and face geometry.
