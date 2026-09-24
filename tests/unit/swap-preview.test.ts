import { describe, expect, it } from "vitest";
import { previewSwapGroceries } from "../../src/domain/planning/swap-preview";
import type { GroceryComponent } from "../../src/domain/meals/groceries";

function component(slotId: string, mealKind: "dinner" | "lunch", ingredientId: string,
  quantityMilli: number, plannedYieldMilli = 2_000): GroceryComponent {
  return { slotId, localDate: mealKind === "dinner" ? "2026-09-28" : "2026-09-29",
    mealKind, recipeTitle: slotId, baseYield: { milli: 2_000, unit: "portion" },
    plannedYield: { milli: plannedYieldMilli, unit: "portion" },
    ingredients: [{ ingredientId, name: ingredientId, category: "Food",
      quantity: { milli: quantityMilli, unit: "g" }, optional: false }] };
}

describe("swap grocery preview", () => {
  it("replaces source dinner and linked lunch while leaving the rest of the week intact", () => {
    const current = [component("old-dinner", "dinner", "chicken", 400_000, 3_000),
      component("old-lunch", "lunch", "tortillas", 4_000),
      component("other-dinner", "dinner", "chicken", 200_000)];
    const replacement = [component("old-dinner", "dinner", "tofu", 400_000, 3_000),
      component("old-lunch", "lunch", "pitas", 2_000)];
    const changes = previewSwapGroceries({ current,
      replacedSlotIds: ["old-dinner", "old-lunch"], replacement });
    expect(changes.map((change) => [change.key, change.before.milli, change.after.milli])).toEqual([
      ["chicken:mass", 800_000, 200_000],
      ["pitas:mass", 0, 2_000],
      ["tofu:mass", 0, 600_000],
      ["tortillas:mass", 4_000, 0],
    ]);
  });

  it("does not report ingredients whose full-week need stays the same", () => {
    const current = [component("old-dinner", "dinner", "onion", 100_000)];
    const replacement = [component("old-dinner", "dinner", "onion", 100_000)];
    expect(previewSwapGroceries({ current, replacedSlotIds: ["old-dinner"], replacement })).toEqual([]);
  });
});
