const SEASON_MS = 18000;
const CROSSFADE_MS = 10000;

export function createImageStateController() {
  const seasons = ["spring", "summer", "autumn", "winter"];
  const startedAt = performance.now();

  return {
    getState(now = performance.now()) {
      const cycle = SEASON_MS + CROSSFADE_MS;
      const elapsed = now - startedAt;
      const step = Math.floor(elapsed / cycle) % seasons.length;
      const local = elapsed % cycle;
      const next = (step + 1) % seasons.length;
      const crossfade = local > SEASON_MS ? (local - SEASON_MS) / CROSSFADE_MS : 0;

      return {
        current: seasons[step],
        next: seasons[next],
        crossfade
      };
    }
  };
}
