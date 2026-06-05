export function createClapDetection({ audioContext, onClap }) {
  let stream = null;
  let analyser = null;
  let source = null;
  let timeData = null;
  let frequencyData = null;
  let raf = 0;
  let noiseFloor = 0.018;
  let highFloor = 0.01;
  let lastClap = 0;
  let lastPeak = 0;
  let lastRms = 0;
  let candidate = null;
  const clapTimestamps = [];

  const getFeatures = () => {
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(frequencyData);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const centered = (timeData[i] - 128) / 128;
      const abs = Math.abs(centered);
      sum += centered * centered;
      if (abs > peak) peak = abs;
    }

    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    for (let i = 0; i < frequencyData.length; i += 1) {
      const value = frequencyData[i] / 255;
      if (i < frequencyData.length * 0.18) {
        lowEnergy += value;
      } else if (i < frequencyData.length * 0.48) {
        midEnergy += value;
      } else {
        highEnergy += value;
      }
    }

    const totalEnergy = lowEnergy + midEnergy + highEnergy || 1;
    const highRatio = highEnergy / totalEnergy;
    const midRatio = midEnergy / totalEnergy;

    return {
      rms: Math.sqrt(sum / timeData.length),
      peak,
      highEnergy: highEnergy / frequencyData.length,
      highRatio,
      midRatio
    };
  };

  const calculateRate = (now) => {
    while (clapTimestamps.length && now - clapTimestamps[0] > 2200) {
      clapTimestamps.shift();
    }
    if (clapTimestamps.length < 2) return 0.18;
    const intervals = [];
    for (let i = 1; i < clapTimestamps.length; i += 1) {
      intervals.push(clapTimestamps[i] - clapTimestamps[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.max(0, Math.min(1, (850 - avg) / 560));
  };

  const frame = () => {
    const now = performance.now();
    const features = getFeatures();
    const { rms, peak, highEnergy, highRatio, midRatio } = features;
    noiseFloor = noiseFloor * 0.992 + rms * 0.008;
    highFloor = highFloor * 0.992 + highEnergy * 0.008;

    const threshold = Math.max(0.18, noiseFloor * 8.5);
    const highThreshold = Math.max(0.018, highFloor * 5.4);
    const fastRise = peak - lastPeak > 0.14 && rms - lastRms > 0.045;
    const hasClapSpectrum = highEnergy > highThreshold && highRatio > 0.42 && midRatio > 0.18;
    const cool = now - lastClap > 260;

    if (!candidate && cool && fastRise && peak > threshold && rms > noiseFloor * 5.2 && hasClapSpectrum) {
      candidate = {
        startedAt: now,
        peak,
        rms,
        highRatio,
        highEnergy
      };
    }

    if (candidate && now - candidate.startedAt > 90) {
      const fastDecay = rms < candidate.rms * 0.58 || peak < candidate.peak * 0.62;
      const stillSharp = highRatio > 0.32;
      if (fastDecay && stillSharp) {
        lastClap = now;
        clapTimestamps.push(now);
        const rate = calculateRate(now);
        onClap?.({ time: now, rate, peak: candidate.peak, rms: candidate.rms });
      }
      candidate = null;
    }

    if (candidate && now - candidate.startedAt > 190) {
      candidate = null;
    }

    lastPeak = peak;
    lastRms = rms;
    raf = requestAnimationFrame(frame);
  };

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.04;
      timeData = new Uint8Array(analyser.fftSize);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      frame();
    },
    dispose() {
      cancelAnimationFrame(raf);
      if (source) source.disconnect();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  };
}
