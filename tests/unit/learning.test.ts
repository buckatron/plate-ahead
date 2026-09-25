import { describe, expect, it } from "vitest";
import { learningSignals, type CookingHistoryEntry } from "../../src/domain/feedback/learning";

const cookedAt = new Date("2026-09-01T18:00:00Z");
const feedbackAt = new Date("2026-09-20T18:00:00Z");

function event(feedback: CookingHistoryEntry["feedback"]): CookingHistoryEntry {
  return { recipeKey: "favorite", cookedAt, feedback };
}

describe("confirmed cooking signals", () => {
  it("lets a favorite rest for four weeks and then remembers that it was loved", () => {
    const history = [event({ reaction: "break", priorEnjoyment: "loved", effort: null,
      leftovers: null, updatedAt: feedbackAt })];
    expect(learningSignals(history, new Date("2026-10-01T12:00:00Z")).get("favorite")?.unavailable).toBe("break");
    const later = learningSignals(history, new Date("2026-10-30T12:00:00Z")).get("favorite");
    expect(later?.unavailable).toBeNull();
    expect(later?.reaction).toBe("loved");
    expect(later?.points).toBeGreaterThan(0);
  });

  it("keeps a not-again response out until newer feedback changes it", () => {
    const disliked = event({ reaction: "not_again", priorEnjoyment: null, effort: null,
      leftovers: null, updatedAt: feedbackAt });
    expect(learningSignals([disliked], new Date("2026-12-01T12:00:00Z")).get("favorite")?.unavailable).toBe("not_again");
    const changed = { ...disliked, feedback: { ...disliked.feedback!, reaction: "good" as const,
      updatedAt: new Date("2026-10-01T12:00:00Z") } };
    expect(learningSignals([disliked, changed], new Date("2026-12-01T12:00:00Z")).get("favorite")?.unavailable).toBeNull();
  });

  it("treats effort and leftover experience separately from dinner enjoyment", () => {
    const signal = learningSignals([event({ reaction: "good", priorEnjoyment: null,
      effort: "too_much", leftovers: "not_appealing", updatedAt: feedbackAt })],
    new Date("2026-12-01T12:00:00Z")).get("favorite");
    expect(signal?.reaction).toBe("good");
    expect(signal?.avoidLunch).toBe(true);
    expect(signal?.points).toBe(-1);
  });
});
