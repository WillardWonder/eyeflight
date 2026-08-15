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
