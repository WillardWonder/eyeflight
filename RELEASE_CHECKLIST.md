# Eye Flight — Release Checklist

## Core flight
- [x] first-person forward flight
- [x] gaze drives continuous steering
- [x] fast gaze changes produce stronger turn authority
- [x] settled gaze produces finer trim
- [x] score gates
- [x] boost gates
- [x] debris collisions
- [x] near-miss bonuses
- [x] three-hit airframe limit
- [x] speed ramp across the run
- [x] combo scoring

## Gaze system
- [x] desktop calibration
- [x] 21-point mobile calibration
- [x] 9-point mobile tune
- [x] separate left/right eye features
- [x] roll-corrected eye geometry
- [x] local interpolation
- [x] adaptive One Euro filtering
- [x] automatic center micro-tune
- [x] phone/head position stability guard
- [x] tracking-loss steering pause
- [x] 1280×720 front-camera request when available

## Device support
- [x] desktop mouse demo
- [x] phone touch demo
- [x] selfie-camera preference
- [x] portrait and landscape layout
- [x] safe areas
- [x] orientation-change recalibration
- [x] camera chooser
- [x] camera disconnect recovery

## Hosting
- [x] static GitHub Pages structure
- [x] relative asset paths
- [x] `.nojekyll`
- [x] manifest
- [x] privacy page
- [x] local preview helper

## Final physical checks before a public launch
Automated tests cannot reproduce every phone camera, browser, lighting condition, or face geometry. Before broadly promoting the URL, run one complete camera flight on:
- iPhone/iPad Safari
- Android Chrome
- one desktop browser

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
