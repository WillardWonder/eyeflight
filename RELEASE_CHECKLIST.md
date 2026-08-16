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

<<<<<<< HEAD
Focus on steering feel in Easy mode, head/eye independence, one-tap Center, and several consecutive gates.
=======
Verify calibration, launch, steering, gate scoring, debris collisions, boost gates, phone rotation, camera switching, and quick recenter.


## 1.0.1 stability regression checks
- [x] normal first gate with strict Web Audio validation
- [x] boost gate after first gate
- [x] debris impact after gate
- [x] one forced render exception recovers on the next animation frame
- [x] 75-second engine stress run
- [x] bounded world-object count during stress run
- [x] finite steering/speed/distance/score state during stress run


## 1.0.2 mobile latency + calibration regression
- [x] 25-point 5×5 mobile calibration
- [x] repeated RAF frames cannot count as new calibration samples
- [x] first mobile calibration point remains visible for ~1.1 s minimum in the synthetic 30 Hz tracker test
- [x] 9-point unique-frame tuning pass
- [x] richer binocular calibration model
- [x] optional near-field pose compensation
- [x] high-motion tracking no longer drops to 8 Hz
- [x] separate low-latency flight-control gaze path
- [x] visible cursor remains filtered separately
- [x] first-gate stability fix retained
- [x] desktop demo runtime retained
- [x] mobile touch demo runtime retained
>>>>>>> f5af1189569bfc8f9903689c1055c5dce91ef747
