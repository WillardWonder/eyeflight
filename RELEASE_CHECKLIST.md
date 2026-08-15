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
