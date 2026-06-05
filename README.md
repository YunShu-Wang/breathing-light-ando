# Breathing Light

An interactive front-end installation about emotion and time. The browser shows a single first-person view looking straight up at a circular skylight inside a quiet concrete dome. Eye state, breathing light, minute-hand sound, and clap peaks modulate the space.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open the Vite URL in a browser and allow camera and microphone permissions. The page itself intentionally has no visible buttons, text, menus, or debug UI.

## Permissions

The camera is used for browser-side eye openness detection through MediaPipe Face Landmarker. The microphone is used for clap peak detection with Web Audio API analyser data. No media is sent to a server by this project.

Some browsers require a first click or touch before audio can start. The full canvas accepts that gesture silently without showing an interface.

## Image Replacement

The running version uses CSS-generated dome and sky layers so it works before final image generation. Replaceable image locations are prepared here:

- `src/assets/ando/`
- `src/assets/sky/`

If you add generated images with the expected filenames, the app will use them automatically:

- `src/assets/ando/dome-main.jpg`
- `src/assets/ando/dome-weak-light.jpg`
- `src/assets/ando/dome-strong-light.jpg`
- `src/assets/ando/dome-whiteout.jpg`
- `src/assets/sky/spring.jpg`
- `src/assets/sky/summer.jpg`
- `src/assets/sky/autumn.jpg`
- `src/assets/sky/winter.jpg`

The image2.0 prompts are in `src/prompts/image2-prompts.json`.

## Interaction Logic

- Eyes open: light breathes slowly from darkness to strong natural white, then back to darkness.
- Minute-hand sound: a restrained minute-hand movement sound plays only at the brightest point of each breathing cycle.
- Clap disturbance: valid claps temporarily disturb the breathing rhythm. Faster claps create stronger center light and can push the scene into a whiteout breath.
- Whiteout breath: peak light fills the frame softly, then fades back toward the dome.
- Eyes closed meditation: sustained closure enters a quiet state, fades sound and clap response, and crossfades seasonal sky inside only the circular skylight.
- Reopen: the breathing light fades back in over roughly one to two seconds.

## Browser Limits

Camera, microphone, and audio startup behavior depends on the browser. Permission prompts may appear. If sound is muted at first, click or tap once anywhere in the window.
