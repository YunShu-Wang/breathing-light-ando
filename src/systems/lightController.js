export function createLightController() {
  let intensity = 0.02;
  let pulse = 0;
  let whiteout = 0;
  let whiteoutTarget = 0;
  let targetBase = 0.02;
  const pulseDecay = 0.78;

  return {
    tick(deltaMs, mode) {
      const dt = Math.min(deltaMs / 16.67, 4);
      pulse *= Math.pow(pulseDecay, dt);
      if (mode !== "WHITEOUT_BREATH") {
        whiteoutTarget = 0;
      }
      whiteout += (whiteoutTarget - whiteout) * Math.min(0.035 * dt, 1);

      const meditationTarget = mode === "EYES_CLOSED_MEDITATION" ? 0.003 : targetBase;
      intensity += (meditationTarget - intensity) * Math.min(0.09 * dt, 1);
      return {
        intensity: Math.min(1, intensity + pulse * 0.96 + whiteout * 0.58),
        pulse,
        whiteout
      };
    },
    setBreath(level) {
      targetBase = 0.012 + level * 0.74;
    },
    clapPulse(rate) {
      const strength = 0.34 + rate * 0.5;
      targetBase = 0.012 + rate * 0.12;
      pulse = Math.min(1, pulse + strength);
      whiteoutTarget = Math.max(whiteoutTarget, Math.max(0, rate - 0.5) * 0.9);
    },
    fadeToClock() {
      targetBase = 0.02;
      whiteoutTarget = 0;
    },
    enterMeditation() {
      targetBase = 0.003;
      whiteoutTarget = 0;
      pulse *= 0.08;
    },
    whiteoutBreath() {
      whiteoutTarget = 0.92;
      targetBase = 0.08;
    }
  };
}
