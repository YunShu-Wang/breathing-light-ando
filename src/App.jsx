import { useEffect, useMemo, useRef, useState } from "react";
import { createAudioEngine } from "./systems/audioEngine.js";
import { createClapDetection } from "./systems/clapDetection.js";
import { createEyeDetection } from "./systems/eyeDetection.js";
import { createImageStateController } from "./systems/imageStateController.js";
import { createLightController } from "./systems/lightController.js";

const APP_STATE = {
  IDLE_LOADING: "IDLE_LOADING",
  EYES_OPEN_CLOCK: "EYES_OPEN_CLOCK",
  CLAP_DISTURBANCE: "CLAP_DISTURBANCE",
  WHITEOUT_BREATH: "WHITEOUT_BREATH",
  EYES_CLOSED_MEDITATION: "EYES_CLOSED_MEDITATION"
};

const BREATH_MS = 7600;

const andoAssets = import.meta.glob("./assets/ando/*.jpg", {
  eager: true,
  query: "?url",
  import: "default"
});

const skyAssets = import.meta.glob("./assets/sky/*.jpg", {
  eager: true,
  query: "?url",
  import: "default"
});

function assetUrl(map, name) {
  const key = Object.keys(map).find((path) => path.endsWith(name));
  return key ? map[key] : "";
}

function alpha(value) {
  return Math.max(0, Math.min(1, value)).toFixed(3);
}

export default function App() {
  const [frame, setFrame] = useState({
    appState: APP_STATE.IDLE_LOADING,
    lightIntensity: 0.04,
    pulse: 0,
    whiteout: 0,
    sky: { current: "spring", next: "summer", crossfade: 0 }
  });

  const stateRef = useRef(APP_STATE.IDLE_LOADING);
  const lastClapAt = useRef(0);
  const rafRef = useRef(0);
  const lastFrameAt = useRef(performance.now());
  const systemsRef = useRef(null);
  const whiteoutUntil = useRef(0);
  const breathPeakArmed = useRef(true);
  const breathStartedAt = useRef(performance.now());
  const audioUnlockedRef = useRef(false);
  const forceSoundTestRef = useRef(false);

  const assets = useMemo(
    () => ({
      domeMain: assetUrl(andoAssets, "dome-main.jpg"),
      domeWeak: assetUrl(andoAssets, "dome-weak-light.jpg"),
      domeStrong: assetUrl(andoAssets, "dome-strong-light.jpg"),
      domeWhiteout: assetUrl(andoAssets, "dome-whiteout.jpg"),
      spring: assetUrl(skyAssets, "spring.jpg"),
      summer: assetUrl(skyAssets, "summer.jpg"),
      autumn: assetUrl(skyAssets, "autumn.jpg"),
      winter: assetUrl(skyAssets, "winter.jpg")
    }),
    []
  );

  useEffect(() => {
    const audio = createAudioEngine();
    const light = createLightController();
    const sky = createImageStateController();

    const setMode = (next) => {
      if (stateRef.current === next) return;
      stateRef.current = next;
      if (next === APP_STATE.EYES_CLOSED_MEDITATION) {
        light.enterMeditation();
        audio.setActive(false);
      }
      if (next === APP_STATE.EYES_OPEN_CLOCK) {
        light.fadeToClock();
        audio.setActive(true);
      }
    };

    systemsRef.current = { audio, light, sky, setMode };

    const animate = () => {
      const now = performance.now();
      const delta = now - lastFrameAt.current;
      lastFrameAt.current = now;

      if (
        stateRef.current === APP_STATE.CLAP_DISTURBANCE &&
        now - lastClapAt.current > 1750
      ) {
        setMode(APP_STATE.EYES_OPEN_CLOCK);
      }

      if (stateRef.current === APP_STATE.WHITEOUT_BREATH && now > whiteoutUntil.current) {
        setMode(APP_STATE.EYES_OPEN_CLOCK);
      }

      if (stateRef.current === APP_STATE.EYES_OPEN_CLOCK) {
        const phase = ((now - breathStartedAt.current) % BREATH_MS) / BREATH_MS;
        const breath = (1 - Math.cos(phase * Math.PI * 2)) / 2;
        light.setBreath(Math.pow(breath, 1.35));

        if (breath > 0.985 && breathPeakArmed.current) {
          audio.minuteHand(1);
          breathPeakArmed.current = false;
        }
        if (breath < 0.34) {
          breathPeakArmed.current = true;
        }
      }

      const lightState = light.tick(delta, stateRef.current);
      setFrame({
        appState: stateRef.current,
        lightIntensity: lightState.intensity,
        pulse: lightState.pulse,
        whiteout: lightState.whiteout,
        sky: sky.getState(now)
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    const start = async () => {
      const forceMeditation = new URLSearchParams(window.location.search).has("meditation");
      forceSoundTestRef.current = new URLSearchParams(window.location.search).has("sound");
      const eye = createEyeDetection({
        onEyeState: ({ state }) => {
          if (state === "closed") {
            setMode(APP_STATE.EYES_CLOSED_MEDITATION);
          }
          if (state === "open" && stateRef.current === APP_STATE.EYES_CLOSED_MEDITATION) {
            setMode(APP_STATE.EYES_OPEN_CLOCK);
          }
        }
      });
      const clap = createClapDetection({
        audioContext: audio.getContext(),
        onClap: ({ rate }) => {
          if (stateRef.current === APP_STATE.EYES_CLOSED_MEDITATION) return;
          lastClapAt.current = performance.now();
          light.clapPulse(rate);
          audio.tick(0.55 + rate * 0.55);
          if (rate > 0.86) {
            stateRef.current = APP_STATE.WHITEOUT_BREATH;
            whiteoutUntil.current = performance.now() + 3400;
            light.whiteoutBreath();
          } else {
            stateRef.current = APP_STATE.CLAP_DISTURBANCE;
          }
        }
      });

      systemsRef.current.eye = eye;
      systemsRef.current.clap = clap;

      try {
        await eye.start();
      } catch (error) {
        console.error("Eye setup failed", error);
      }

      try {
        await clap.start();
      } catch (error) {
        console.error("Clap setup failed", error);
      }

      setMode(forceMeditation ? APP_STATE.EYES_CLOSED_MEDITATION : APP_STATE.EYES_OPEN_CLOCK);
      animate();
    };

    start();

    const unlock = async () => {
      try {
        await audio.unlock();
        if (!audioUnlockedRef.current) {
          audioUnlockedRef.current = true;
          breathStartedAt.current = performance.now() - BREATH_MS * 0.36;
          breathPeakArmed.current = true;
          if (forceSoundTestRef.current) {
            audio.minuteHand(1);
          }
        }
      } catch (error) {
        console.error("Audio unlock failed", error);
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
      systemsRef.current?.eye?.dispose();
      systemsRef.current?.clap?.dispose();
      systemsRef.current?.audio?.dispose();
    };
  }, []);

  const seasonStyle = (name) => {
    const url = assets[name];
    return url ? { backgroundImage: `url("${url}")` } : undefined;
  };

  const light = frame.lightIntensity;
  const pulse = frame.pulse;
  const whiteout = frame.whiteout;
  const meditation = frame.appState === APP_STATE.EYES_CLOSED_MEDITATION ? 1 : 0;
  const crossfade = frame.sky.crossfade;

  const cssVars = {
    "--light": light.toFixed(3),
    "--pulse": pulse.toFixed(3),
    "--whiteout": whiteout.toFixed(3),
    "--dome-strong-opacity": alpha(light * 0.22 + pulse * 0.42 + whiteout * 0.28),
    "--concrete-light-a": alpha(light * 0.66),
    "--concrete-pulse-a": alpha(pulse * 0.72 + whiteout * 0.2),
    "--skylight-core-a": alpha(meditation ? 0.06 : light * 1.28),
    "--skylight-mid-a": alpha(meditation ? 0.08 : light * 0.96),
    "--skylight-edge-a": alpha(meditation ? 0.22 : 0.012 + light * 0.4),
    "--skylight-shadow-a": alpha(meditation ? 0.18 : light * 1.1),
    "--skylight-glow-size": `${(light * 23 + pulse * 6).toFixed(3)}vmin`,
    "--season-current-opacity": alpha(meditation * (1 - crossfade)),
    "--season-next-opacity": alpha(meditation * crossfade),
    "--skylight-glow-a1": alpha(meditation ? 0.02 : light * 1.26),
    "--skylight-glow-a2": alpha(meditation ? 0.02 : light * 0.9),
    "--skylight-glow-opacity": alpha(meditation ? 0.08 : light * 1.16),
    "--light-column-a1": alpha(light * 1.32 + pulse * 0.22),
    "--light-column-a2": alpha(light * 0.98 + pulse * 0.16),
    "--light-column-pulse-a": alpha(pulse * 0.45),
    "--light-column-blur": `${(1.8 + light * 7.2 + pulse * 2).toFixed(3)}vmin`,
    "--light-column-opacity": alpha(light * 1.26 + pulse * 0.24),
    "--light-wash-a1": alpha(light * 1.08 + pulse * 0.16),
    "--light-wash-a2": alpha(light * 0.72 + pulse * 0.12),
    "--whiteout-a1": alpha(whiteout * 0.82),
    "--whiteout-a2": alpha(whiteout * 0.72),
    "--whiteout-a3": alpha(whiteout * 0.56),
    "--dome-image": assets.domeMain ? `url("${assets.domeMain}")` : "none",
    "--dome-strong-image": assets.domeStrong ? `url("${assets.domeStrong}")` : "none",
    "--dome-whiteout-image": assets.domeWhiteout ? `url("${assets.domeWhiteout}")` : "none"
  };

  return (
    <main className="installation" style={cssVars} aria-hidden="true">
      <div className="dome-image dome-image-main" />
      <div className="concrete-dome" />
      <div className="skylight">
        <div className={`season season-${frame.sky.current}`} style={seasonStyle(frame.sky.current)} />
        <div
          className={`season season-${frame.sky.next} season-next`}
          style={seasonStyle(frame.sky.next)}
        />
        <div className="skylight-glow" />
      </div>
      <div className="oculus-rim" />
      <div className="dome-shadow" />
      <div className="light-column" />
      <div className="light-wash" />
      <div className="dome-image dome-image-strong" />
      <div className="whiteout" />
      <div className="grain" />
    </main>
  );
}
