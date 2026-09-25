import { describe, expect, it } from "vitest";
import { blankDraft, parseIngredientLine, recipeIssues } from "../../src/domain/meals/personal-recipe";

describe("personal recipe ingredients", () => {
  it("parses common household amounts with fixed precision", () => {
    expect(parseIngredientLine("2 eggs")).toMatchObject({ name: "eggs", quantityMilli: 2000, unit: "each" });
    expect(parseIngredientLine("1 1/2 cups flour")).toMatchObject({ name: "flour", quantityMilli: 360000, unit: "ml" });
    expect(parseIngredientLine("½ tsp cumin")).toMatchObject({ name: "cumin", quantityMilli: 2500, unit: "ml" });
    expect(parseIngredientLine("150 g rice, rinsed")).toMatchObject({ name: "rice", quantityMilli: 150000, unit: "g", preparation: "rinsed" });
  });

  it("requires review for amounts that cannot be shopped safely", () => {
    expect(parseIngredientLine("1-2 onions")).toHaveProperty("error");
    expect(parseIngredientLine("2 (400 g) cans tomatoes")).toHaveProperty("error");
    expect(parseIngredientLine("salt to taste")).toMatchObject({ kind: "unmeasured", name: "salt" });
    expect(parseIngredientLine("1 bunch parsley")).toHaveProperty("error");
  });

  it("keeps incomplete drafts and explains publication blockers", () => {
    expect(recipeIssues(blankDraft)).toContain("Confirm how many people the recipe serves.");
    expect(recipeIssues({ ...blankDraft, title: "Eggs", servings: 2, totalMinutes: 10,
      ingredientLines: ["2 eggs"], steps: ["Cook the eggs."] })).toEqual([]);
  });
});
