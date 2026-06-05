export function createClockEngine({ interval = 1000, onTick }) {
  let timer = null;
  let active = false;

  const tick = () => {
    if (!active) return;
    onTick?.(performance.now());
  };

  return {
    start() {
      if (active) return;
      active = true;
      tick();
      timer = window.setInterval(tick, interval);
    },
    stop() {
      active = false;
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    },
    dispose() {
      this.stop();
    }
  };
}
