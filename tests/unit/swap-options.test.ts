import { describe, expect, it } from "vitest";
import { rankSwapOptions } from "../../src/domain/planning/swap-options";
import type { DinnerCandidate } from "../../src/domain/planning/generate-week";
import { DEFAULT_SETTINGS } from "../../src/schemas/household";

function dinner(key: string, main: string, options: DinnerCandidate["lunchOptions"] = [], totalMinutes = 40): DinnerCandidate {
  return { id: key, key, title: key, totalMinutes, tags: { main: [main], format: [key], cuisine: [key] },
    ingredients: [{ id: "onion", name: "Onion", isStaple: false, useFirst: false }], lunchOptions: options };
}

const lunch = (key: string) => ({ transformationId: key, lunchRecipeId: key, lunchKey: key, lunchTitle: key });

describe("swap shortlist", () => {
  it("returns at most three distinct, eligible dinners and favors a repaired lunch", () => {
    const current = dinner("current", "chicken");
    const another = dinner("already-planned", "tofu");
    const options = rankSwapOptions({ current, otherDinners: [another],
      candidates: [current, another, dinner("too-slow", "beans", [], 80), dinner("salmon", "fish", [lunch("salmon-lunch")]),
        dinner("beef", "beef"), dinner("pork", "pork"), dinner("shrimp", "shrimp")],
      settings: DEFAULT_SETTINGS, hasLinkedLunch: true });
    expect(options).toHaveLength(3);
    expect(options[0].recipe.key).toBe("salmon");
    expect(options.map((option) => option.recipe.key)).not.toContain("current");
    expect(options.map((option) => option.recipe.key)).not.toContain("already-planned");
    expect(options.map((option) => option.recipe.key)).not.toContain("too-slow");
    expect(options[0].lunch?.lunchKey).toBe("salmon-lunch");
  });

  it("does not reuse another lunch and respects exclusions", () => {
    const current = dinner("current", "chicken");
    const options = rankSwapOptions({ current, otherDinners: [], candidates: [
      dinner("salmon", "fish", [lunch("used-lunch")]), dinner("beef", "beef", [lunch("new-lunch")])],
      settings: { ...DEFAULT_SETTINGS, exclusions: ["beef"] }, hasLinkedLunch: true, otherLunchKeys: ["used-lunch"] });
    expect(options).toHaveLength(1);
    expect(options[0].recipe.key).toBe("salmon");
    expect(options[0].lunch).toBeNull();
  });
});
