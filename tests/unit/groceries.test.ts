import { describe, expect, it } from "vitest";
import { aggregateGroceryNeeds, type GroceryComponent } from "../../src/domain/meals/groceries";
import { findUnallocatedPurchases, parseOnHandAmount, reviewGroceryNeed } from "../../src/domain/meals/grocery-review";

const components: GroceryComponent[] = [
  {
    slotId: "dinner-1", localDate: "2026-09-28", mealKind: "dinner", recipeTitle: "Roast chicken",
    baseYield: { milli: 300_000, unit: "g" }, plannedYield: { milli: 500_000, unit: "g" },
    ingredients: [{ ingredientId: "chicken", name: "Chicken", category: "Meat", quantity: { milli: 400_000, unit: "g" }, optional: false }],
  },
  {
    slotId: "lunch-1", localDate: "2026-09-29", mealKind: "lunch", recipeTitle: "Chicken wraps",
    baseYield: { milli: 2_000, unit: "portion" }, plannedYield: { milli: 2_000, unit: "portion" },
    ingredients: [
      { ingredientId: "tortillas", name: "Tortillas", category: "Bread", quantity: { milli: 4_000, unit: "each" }, optional: false },
      { ingredientId: "hot-sauce", name: "Hot sauce", category: "Pantry", quantity: { milli: 20_000, unit: "ml" }, optional: true },
    ],
  },
  {
    slotId: "dinner-2", localDate: "2026-09-30", mealKind: "dinner", recipeTitle: "Chicken skillet",
    baseYield: { milli: 2_000, unit: "portion" }, plannedYield: { milli: 2_000, unit: "portion" },
    ingredients: [{ ingredientId: "chicken", name: "Chicken", category: "Meat", quantity: { milli: 200, unit: "kg" }, optional: false }],
  },
];

describe("grocery needs", () => {
  it("counts reserved dinner food once, adds lunch ingredients, and merges compatible units", () => {
    const needs = aggregateGroceryNeeds(components);
    const chicken = needs.find((line) => line.ingredientId === "chicken");
    expect(chicken?.quantity).toEqual({ milli: 866_667, unit: "g" });
    expect(chicken?.contributions.map((part) => part.quantity.milli)).toEqual([666_667, 200_000]);
    expect(needs.find((line) => line.ingredientId === "tortillas")?.quantity).toEqual({ milli: 4_000, unit: "each" });
    expect(needs.some((line) => line.ingredientId === "hot-sauce")).toBe(false);
  });

  it("keeps count and mass separate when there is no ingredient conversion", () => {
    const count: GroceryComponent = { ...components[1], slotId: "lunch-2", ingredients: [
      { ingredientId: "lemon", name: "Lemon", category: "Produce", quantity: { milli: 1_000, unit: "each" }, optional: false },
      { ingredientId: "lemon", name: "Lemon", category: "Produce", quantity: { milli: 100_000, unit: "g" }, optional: false },
    ] };
    expect(aggregateGroceryNeeds([count]).map((line) => line.quantity)).toEqual([
      { milli: 1_000, unit: "each" }, { milli: 100_000, unit: "g" },
    ]);
  });

  it("subtracts confirmed pantry coverage once from the whole week's need", () => {
    const chicken = aggregateGroceryNeeds(components).find((line) => line.ingredientId === "chicken")!;
    expect(reviewGroceryNeed(chicken).toBuy.milli).toBe(866_667);
    expect(reviewGroceryNeed(chicken, { onHandMilli: 300_000, checked: true })).toMatchObject({
      onHandMilli: 300_000, checked: true, toBuy: { milli: 566_667, unit: "g" },
    });
    expect(reviewGroceryNeed(chicken, { onHandMilli: 900_000, checked: false }).toBuy.milli).toBe(0);
  });

  it("keeps unknown on-hand distinct from confirmed zero and rejects invalid precision", () => {
    expect(parseOnHandAmount(" ")).toBeNull();
    expect(parseOnHandAmount("0")).toBe(0);
    expect(parseOnHandAmount("1.125")).toBe(1125);
    expect(() => parseOnHandAmount("1.1234")).toThrow(/three decimal/);
    expect(() => parseOnHandAmount("-1")).toThrow(/non-negative/);
  });

  it("shows previously bought lines that no current meal needs, without losing matching checks", () => {
    const needs = aggregateGroceryNeeds(components);
    const lines = [
      { ingredientId: "chicken", unitGroup: "mass", name: "Chicken", category: "Meat", checked: true },
      { ingredientId: "tofu", unitGroup: "mass", name: "Tofu", category: "Protein", checked: true },
      { ingredientId: "lime", unitGroup: "count", name: "Lime", category: "Produce", checked: false },
    ];
    expect(findUnallocatedPurchases(needs, lines)).toEqual([
      { ingredientId: "tofu", unitGroup: "mass", name: "Tofu", category: "Protein" },
    ]);
  });
});
