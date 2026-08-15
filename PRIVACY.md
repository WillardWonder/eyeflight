# Eye Flight Privacy

Eye Flight is designed as a client-side webcam game.

## Camera data

The app requests camera permission only after the player clicks **Use my webcam**.

Camera frames are processed in the visitor's browser for gaze/face landmark estimation. This repository does not contain a backend upload endpoint, analytics collector, account system, or frame-storage service.

The game does not intentionally save or upload webcam frames.

## MediaPipe

Eye Flight loads MediaPipe Tasks Vision runtime files from jsDelivr and a face-landmarker model from Google-hosted model storage.

MediaPipe's package documentation states that input data such as images and video is processed on-device rather than sent to Google servers. It also states that MediaPipe Tasks APIs may send performance and usage metrics to Google.

If you deploy a public copy of this app, you are responsible for reviewing the current MediaPipe terms/privacy documentation and any consent obligations that apply to your users or jurisdiction.

## Browser permissions

The browser and operating system control camera permission. Players can revoke access through their browser's site permissions or operating-system privacy settings.

## Hosting

When hosted on GitHub Pages, GitHub serves the static website over HTTPS. GitHub's own platform logs and policies are separate from the Eye Flight application code.
