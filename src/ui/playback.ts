import type { PlaybackSpeed, Snapshot } from "../simulation/types";

export function numericSpeed(speed: PlaybackSpeed): number {
  return speed === "auto" ? 1 : speed;
}

export function playbackRate(snapshot: Snapshot): number {
  if (snapshot.speed !== "auto") return snapshot.speed;

  const inFlight = snapshot.inFlight;
  if (inFlight.length > 0) {
    const remaining = Math.min(
      ...inFlight.map((m) => Math.max(1, m.deliverAt - snapshot.currentTime)),
    );
    const desiredWall = remaining < 120 ? 520 : remaining < 400 ? 680 : 900;
    return clamp(remaining / desiredWall, 0.18, 1.6);
  }

  const next = snapshot.nextEvent;
  if (!next) return 6;
  const until = next.timestamp - snapshot.currentTime;
  if (until <= 160) return 0.45;
  if (until <= 420) return 1.1;
  return 7;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
