import { describe, expect, it } from "vitest";
import { feedbackDuration } from "./feedback";

describe("feedbackDuration", () => {
  it("keeps send weaker and shorter than receive and role at 1×", () => {
    const opts = { reducedMotion: false, playing: true };
    expect(feedbackDuration("send", 1, opts)).toBeLessThan(feedbackDuration("receive", 1, opts));
    expect(feedbackDuration("receive", 1, opts)).toBeLessThan(feedbackDuration("role", 1, opts));
  });

  it("shortens transients at 4× so they do not stack", () => {
    const playing = { reducedMotion: false, playing: true };
    expect(feedbackDuration("receive", 4, playing)).toBeLessThan(feedbackDuration("receive", 1, playing));
    expect(feedbackDuration("role", 4, playing)).toBeLessThan(180);
  });

  it("skips send animation in instant playback", () => {
    expect(feedbackDuration("send", 32, { reducedMotion: false, playing: true })).toBe(0);
    expect(feedbackDuration("role", 32, { reducedMotion: false, playing: true })).toBeLessThan(120);
  });

  it("uses full-length emphasis when paused after a step", () => {
    expect(feedbackDuration("timer", 4, { reducedMotion: false, playing: false })).toBeGreaterThan(
      feedbackDuration("timer", 4, { reducedMotion: false, playing: true }),
    );
    expect(feedbackDuration("receive", 1, { reducedMotion: false, playing: false })).toBeGreaterThan(
      feedbackDuration("receive", 1, { reducedMotion: false, playing: true }),
    );
  });

  it("drops send motion and keeps semantic highlights for reduced motion", () => {
    const reduced = { reducedMotion: true, playing: true };
    expect(feedbackDuration("send", 1, reduced)).toBe(0);
    expect(feedbackDuration("field", 1, reduced)).toBeGreaterThan(0);
    expect(feedbackDuration("role", 1, reduced)).toBeGreaterThan(0);
  });
});
