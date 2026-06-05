export function createAudioEngine() {
  let context = null;
  let master = null;
  let tickGain = null;
  let enabled = false;

  const ensure = () => {
    if (context) return context;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("Web Audio API is not available in this browser.");
    }
    context = new AudioContextCtor();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    tickGain = context.createGain();
    tickGain.gain.value = 0.9;
    tickGain.connect(master);
    return context;
  };

  const envelopeParam = (param, start, peak, end, attack = 0.006, release = 0.045) => {
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(start, now);
    param.linearRampToValueAtTime(peak, now + attack);
    param.exponentialRampToValueAtTime(end, now + attack + release);
  };

  return {
    async unlock() {
      const ctx = ensure();
      if (ctx.state !== "running") {
        await ctx.resume();
      }
      enabled = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.86, ctx.currentTime + 0.45);
    },
    isUnlocked() {
      return enabled && context?.state === "running";
    },
    getContext() {
      return ensure();
    },
    setActive(active) {
      const ctx = ensure();
      const target = active ? 0.86 : 0.02;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(target, ctx.currentTime + (active ? 1.4 : 0.9));
    },
    tick(strength = 0.45) {
      if (!enabled || !context) return;
      const click = context.createOscillator();
      const body = context.createOscillator();
      const clickEnv = context.createGain();
      const bodyEnv = context.createGain();

      click.type = "triangle";
      click.frequency.setValueAtTime(1700, context.currentTime);
      click.frequency.exponentialRampToValueAtTime(760, context.currentTime + 0.035);

      body.type = "sine";
      body.frequency.setValueAtTime(190, context.currentTime);
      body.frequency.exponentialRampToValueAtTime(120, context.currentTime + 0.07);

      clickEnv.gain.value = 0.0001;
      bodyEnv.gain.value = 0.0001;
      envelopeParam(clickEnv.gain, 0.0001, 0.08 * strength, 0.0001, 0.004, 0.035);
      envelopeParam(bodyEnv.gain, 0.0001, 0.045 * strength, 0.0001, 0.008, 0.08);

      click.connect(clickEnv).connect(tickGain);
      body.connect(bodyEnv).connect(tickGain);
      click.start();
      body.start();
      click.stop(context.currentTime + 0.09);
      body.stop(context.currentTime + 0.12);
    },
    minuteHand(strength = 0.9) {
      if (!enabled || !context) return;
      const now = context.currentTime;
      const tap = context.createOscillator();
      const wood = context.createOscillator();
      const tapEnv = context.createGain();
      const woodEnv = context.createGain();
      const filter = context.createBiquadFilter();

      tap.type = "triangle";
      tap.frequency.setValueAtTime(740, now);
      tap.frequency.exponentialRampToValueAtTime(430, now + 0.06);

      wood.type = "triangle";
      wood.frequency.setValueAtTime(185, now);
      wood.frequency.exponentialRampToValueAtTime(108, now + 0.18);

      filter.type = "lowpass";
      filter.frequency.value = 1450;
      filter.Q.value = 0.8;

      tapEnv.gain.value = 0.0001;
      woodEnv.gain.value = 0.0001;
      envelopeParam(tapEnv.gain, 0.0001, 0.11 * strength, 0.0001, 0.01, 0.13);
      envelopeParam(woodEnv.gain, 0.0001, 0.12 * strength, 0.0001, 0.018, 0.32);

      tap.connect(tapEnv).connect(filter);
      wood.connect(woodEnv).connect(filter);
      filter.connect(tickGain);
      tap.start(now);
      wood.start(now);
      tap.stop(now + 0.18);
      wood.stop(now + 0.34);
    },
    dispose() {
      if (context) {
        context.close();
      }
      context = null;
      enabled = false;
    }
  };
}
