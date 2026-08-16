# Eye Flight 1.3 — Assisted Dual Control

Eye Flight is a first-person browser flying game with two independent camera controls:

- **Head = flight stick.**
- **Eyes = look stick.**

Version 1.3 focuses on making the controls easier to learn and more stable in real use.

## What changed

### Easier steering

The aircraft no longer treats head input like an acceleration command.

Head input now controls a target lateral/vertical velocity. Returning your head to center actively brakes sideways/up-down motion, so the ship settles instead of continuing to drift and overshoot.

The default **Easy** steering preset also gives a small alignment assist when a gate is close and the player is not making a strong head command. The assist is intentionally weak: it helps with final alignment without taking control away.

Three steering presets are available in the Camera panel:

- **Easy** — smoother, lower sensitivity, light gate alignment help
- **Balanced** — more direct with less assistance
- **Direct** — fastest response and no gate assist

### Better 3D head tracking

Head steering still uses MediaPipe facial transformation matrices rather than 2D face displacement.

The rotation pipeline is:

```text
facial transformation matrix
→ rotation-only 3×3
→ orthonormalization
→ neutral-relative 3D rotation
→ yaw / pitch
→ One Euro angle filtering
→ personalized directional ranges
→ personalized deadzone
→ virtual left stick
```

The important change in 1.3 is that yaw and pitch are filtered **before** they are normalized into stick values. That prevents small pose noise from being amplified by the player's calibrated range.

The stick response curve is also softer near center and reaches full authority more gradually.

### Better eye look while the head moves

The five-position head setup now does two jobs.

While you move your head left/right/up/down, the setup asks you to keep your eyes on the center dot. Eye Flight records both:

- the 3D head pose
- the raw eye/gaze features

From those paired samples it learns how the eye map shifts when your head rotates.

During flight, that learned head-linked gaze bias is subtracted from the gaze result. This helps preserve the intended separation:

```text
head movement → aircraft steering
eye movement → camera look
```

instead of head movement accidentally dragging the eye-look cursor with it.

### More stable gaze filtering

The Stable eye-look preset uses One Euro filtering on real-camera gaze on both mobile and desktop.

Eye-look presets:

- **Stable** — lower jitter, default
- **Normal** — quicker response
- **Quick** — fastest camera movement

### Tracking dropout handling

A single missed face frame no longer instantly snaps both controls to neutral.

The tracker keeps the last valid control briefly through a short dropout, but fails closed if the face remains missing. Repeated inference errors also clear stale pose state instead of leaving frozen controls active.

### Easier recentering

There is now a visible **Center** button during READY and PLAY.

Centering resets:

- the gaze center
- the 3D head neutral orientation

The learned personal head ranges remain intact.

Keyboard **R** still performs the same action.

## Setup

Camera play runs through:

1. gaze calibration
2. gaze validation/tuning
3. five-position head setup
4. launch

The head setup uses:

- center
- left
- right
- up
- down

Each pose is sampled over several frames. Median/MAD statistics are used to estimate stable pose values and neutral noise.

On mobile, the gaze setup still uses:

- 21 calibration points
- 9 validation/tune points
- separate left/right eye measurements
- roll-corrected eye-local geometry
- global + local gaze mapping
- adaptive filtering

## Demo mode

Desktop demo approximates the camera controls:

- **WASD / arrows = head steering**
- **mouse = eye look**

## Controls

- **C** — full recalibration
- **R** — center head + eyes
- **M** — camera/demo toggle
- **F** — fullscreen
- **P** — camera preview

## Privacy

Camera frames are processed in-browser. Eye Flight has no account system, frame-upload backend, or frame-storage service.

See [`privacy.html`](./privacy.html).

## Hosting

This is a static GitHub Pages-ready app. Upload the contents of this folder to the repository root and enable Pages.

## Local preview

```bash
python3 serve.py
```

## License

Application code is provided under the MIT License. Third-party runtime/model assets retain their own licenses and terms.
