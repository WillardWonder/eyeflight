# Eye Flight — Product Design

## Concept

Eye Flight turns gaze into continuous first-person steering rather than using gaze as a cursor for discrete target selection.

The player is always moving forward. Looking away from center creates a steering command:

- small, steady offsets produce fine trim
- larger offsets create stronger movement
- fast gaze changes increase turn authority
- settled gaze gives finer alignment through gates

This makes eye movement itself the flight mechanic.

## Flight loop

1. Read the upcoming route.
2. Look toward the opening.
3. Bank into the path.
4. Thread the ring.
5. Dodge debris.
6. Hit lime boost rings for a speed surge.
7. Maintain a streak for higher scores.

## Visual direction

The experience is presented as a real game rather than a technical demo:

- full-screen first-person sky and horizon
- restrained cockpit framing
- large readable gate geometry
- debris with strong danger contrast
- subtle speed streaks during boost
- minimal HUD
- gaze cursor remains small and functional

## Mobile precision

Small phone screens make gaze error much more visible. The mobile build therefore keeps:

- 21 calibration points
- 9 validation/tuning points
- left/right eye features
- local interpolation
- adaptive jitter filtering
- center micro-tune
- camera/head position stability checking

The game also pauses steering when the pose has moved too far from calibration instead of silently flying with a bad gaze estimate.
