# Eye Flight 1.3 — Release Checklist

## Head tracking
- [x] MediaPipe facial transformation matrix
- [x] rotation-only extraction
- [x] rotation orthonormalization
- [x] neutral-relative yaw/pitch
- [x] personal left/right/up/down ranges
- [x] MAD-derived neutral deadzones
- [x] One Euro filtering on yaw/pitch before stick mapping
- [x] softer center response curve
- [x] short missed-frame grace
- [x] prolonged face loss fails closed
- [x] repeated inference errors clear stale pose state

## Eye tracking
- [x] 21-point mobile calibration
- [x] 15-point desktop calibration
- [x] 9-point mobile validation/tune
- [x] separate eye features
- [x] roll-corrected eye geometry
- [x] local + global mapping
- [x] One Euro camera-gaze filtering on mobile and desktop
- [x] Stable / Normal / Quick look presets
- [x] head-motion gaze compensation learned during head setup

## Flight controls
- [x] head controls aircraft independently
- [x] eyes control view independently
- [x] target-velocity steering
- [x] active braking when head returns to center
- [x] Easy / Balanced / Direct presets
- [x] low-authority Easy-mode gate alignment assist
- [x] visible live HEAD and EYES indicators
- [x] visible Center button
- [x] R key recenter retained

## Game stability
- [x] first-gate audio crash fix retained
- [x] audio parameters guarded
- [x] isolated render failure self-recovers
- [x] world-object count bounded
- [x] stale tracking fails closed

## Automated regression coverage
- [x] easy head curve
- [x] neutral head jitter suppression
- [x] personalized head range mapping
- [x] head-motion gaze correction
- [x] auto-braking steering
- [x] eyes look without steering the aircraft
- [x] mobile 21+9 gaze setup
- [x] stable gaze jitter filtering
- [x] short tracking dropout grace
- [x] prolonged tracking loss
- [x] repeated inference failure handling
- [x] preset UI wiring
- [x] first gate
- [x] strict Web Audio
- [x] animation-frame recovery

## Real-device checks still required
Automated tests cannot reproduce every phone, face, browser, lighting condition, or thermal state.

Before wide release, verify on at least:
- iPhone Safari
- Android Chrome
- one desktop browser

Focus on steering feel in Easy mode, head/eye independence, one-tap Center, and several consecutive gates.
