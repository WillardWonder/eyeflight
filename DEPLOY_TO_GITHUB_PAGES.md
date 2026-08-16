# Deploy Eye Flight to GitHub Pages

This folder is already structured as the root of a repository named **`eyes`**.

## Publish with the GitHub website

1. Create a new GitHub repository named **`eyes`**.
2. Extract the release ZIP.
3. Open the extracted `eyes` folder.
4. Upload the files **inside that folder** to the repository root.
5. Commit them to `main`.
6. Open **Settings → Pages**.
7. Under **Build and deployment**, choose **Deploy from a branch**.
8. Choose **main** and **/(root)**.
9. Save.

The normal public address will be:

`https://YOUR-GITHUB-USERNAME.github.io/eyes/`

GitHub Pages serves the site over HTTPS, which browsers require for camera access.

## Publish with Git

```bash
git init
git add .
git commit -m "Launch Eye Flight"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/eyes.git
git push -u origin main
```

Then enable Pages from **Settings → Pages → Deploy from a branch → main → /(root)**.

## Before announcing the site

Test these flows on the deployed HTTPS URL:

- desktop camera permission
- desktop calibration → accuracy check → ready → game
- mobile front camera
- portrait calibration
- landscape calibration
- phone rotation after calibration
- camera chooser
- demo mode
- quick recenter with **R**
- full recalibration with **C**
- privacy page
- reload after a deploy

## Updating

Commit and push changes to `main`. GitHub Pages republishes the configured branch automatically.
