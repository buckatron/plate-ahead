import { describe, expect, it } from "vitest";
import { validateMealFeedback } from "../../src/domain/feedback/meal-feedback";

describe("meal feedback", () => {
  it("accepts an effort-only answer without implying dislike", () => {
    expect(() => validateMealFeedback({ reaction: null, effort: "too_much", leftovers: null,
      hasLeftovers: false })).not.toThrow();
  });

  it("keeps leftover experience tied to actual saved food", () => {
    expect(() => validateMealFeedback({ reaction: "good", effort: null, leftovers: "not_appealing",
      hasLeftovers: false })).toThrow(/No reusable leftovers/);
    expect(() => validateMealFeedback({ reaction: "good", effort: null, leftovers: "not_appealing",
      hasLeftovers: true })).not.toThrow();
  });

  it("does not create an empty feedback record", () => {
    expect(() => validateMealFeedback({ reaction: null, effort: null, leftovers: null,
      hasLeftovers: true })).toThrow(/Choose at least one/);
  });
});
