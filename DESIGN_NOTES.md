# Eye Flight 1.3 — Ease-of-Control Design

## Main problem addressed

A camera-controlled aircraft becomes frustrating when:

- small tracking noise becomes steering
- releasing the input does not stop drift
- head movement contaminates eye-look
- a single missed detection causes a control jerk
- the player has no quick way to recenter

Version 1.3 targets those failure modes directly.

## Head / left-stick pipeline

Head control remains 3D-matrix based.

New behavior:

1. relative yaw/pitch is computed from the calibrated neutral orientation
2. yaw/pitch are filtered before range normalization
3. per-user deadzones are applied
4. a softer nonlinear curve reduces center sensitivity
5. output is mapped to target aircraft velocity
6. returning to center aggressively brakes lateral velocity

This makes steering behave more like a forgiving analog stick than a momentum-heavy acceleration controller.

## Eye / right-stick pipeline

The eye map remains independently calibrated.

During head setup, the user keeps gaze fixed at screen center while the head visits four directional poses. Those paired eye + pose samples fit a small linear correction model:

```text
head yaw/pitch → systematic gaze-map shift
```

That predicted shift is removed during runtime before gaze smoothing.

This is not intended to guess where the player is looking. It only compensates for the repeatable error caused by head rotation while the eyes remain fixed.

## Presets

### Steering
- Easy
- Balanced
- Direct

Easy is the default.

### Eye look
- Stable
- Normal
- Quick

Stable is the default.

## Easy-mode assist

When a gate is relatively close and the player's head command is small, Easy mode adds a low-authority velocity nudge toward the gate center.

The assist shuts down as player input increases.

## Tracking loss

A very short missed detection receives a grace window to prevent frame-to-frame control flicker.

A sustained loss or repeated inference error clears live pose state and pauses useful control rather than continuing with stale data.

## Recenter

The visible Center button is considered part of the control system, not a debug feature. Camera geometry and player posture can drift during real use; fast recentering reduces the cost of that drift.
