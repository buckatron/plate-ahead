import { describe, expect, it } from "vitest";
import { blankDraft, manualDraftFromUrl, parseIngredientLine, recipeIssues } from "../../src/domain/meals/personal-recipe";

describe("personal recipe ingredients", () => {
  it("parses common household amounts with fixed precision", () => {
    expect(parseIngredientLine("2 eggs")).toMatchObject({ name: "eggs", quantityMilli: 2000, unit: "each" });
    expect(parseIngredientLine("1 1/2 cups flour")).toMatchObject({ name: "flour", quantityMilli: 360000, unit: "ml" });
    expect(parseIngredientLine("½ tsp cumin")).toMatchObject({ name: "cumin", quantityMilli: 2500, unit: "ml" });
    expect(parseIngredientLine("150 g rice, rinsed")).toMatchObject({ name: "rice", quantityMilli: 150000, unit: "g", preparation: "rinsed" });
  });

  it("requires review for amounts that cannot be shopped safely", () => {
    expect(parseIngredientLine("1-2 onions")).toHaveProperty("error");
    expect(parseIngredientLine("3 to 4 cups vegetable broth")).toMatchObject({ kind: "error", error: "Choose one amount from this range." });
    expect(parseIngredientLine("1½–2 cups broth")).toHaveProperty("error");
    expect(parseIngredientLine("2 tablespoons butter or olive oil")).toMatchObject({ kind: "error", error: "Choose one ingredient from this alternative." });
    expect(parseIngredientLine("2 tablespoons lemon juice, plus more to taste")).toHaveProperty("error");
    expect(parseIngredientLine("2 (400 g) cans tomatoes")).toHaveProperty("error");
    expect(parseIngredientLine("salt to taste")).toMatchObject({ kind: "unmeasured", name: "salt" });
    expect(parseIngredientLine("1 bunch parsley")).toHaveProperty("error");
  });

  it("keeps incomplete drafts and explains publication blockers", () => {
    expect(recipeIssues(blankDraft)).toContain("Confirm how many people the recipe serves.");
    expect(recipeIssues({ ...blankDraft, title: "Eggs", servings: 2, totalMinutes: 10,
      ingredientLines: ["2 eggs"], steps: ["Cook the eggs."] })).toEqual([]);
  });

  it("keeps a blocked site's source link in a manual draft without claiming an import", () => {
    expect(manualDraftFromUrl("https://www.example.com/recipe?view=full#steps")).toMatchObject({
      sourceUrl: "https://www.example.com/recipe?view=full", sourceAttribution: "example.com", origin: "manual",
      ingredientLines: [], steps: [],
    });
    expect(manualDraftFromUrl("https://user:password@example.com/recipe")).toBeNull();
    expect(manualDraftFromUrl("file:///recipe.html")).toBeNull();
  });
});
