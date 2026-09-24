import { describe, expect, it } from "vitest";
import { recipes, transformations } from "../../src/data/catalog";
import { asMilli, validateCatalog } from "../../src/data/validate-catalog";
import { scaleRecipe } from "../../src/domain/meals/scale-recipe";

describe("recipe catalog", () => {
  it("contains complete, compatible recipes and transformations", () => {
    expect(() => validateCatalog()).not.toThrow();
    expect(recipes.filter((recipe) => recipe.role === "dinner")).toHaveLength(12);
    expect(transformations).toHaveLength(4);
  });

  it("supports two separate six-dinner selections with two new lunches in each", () => {
    const weeks = [
      ["citrus-roast-chicken", "coconut-ginger-tofu", "smoky-chickpea-tacos", "miso-mushroom-udon", "salmon-rice-bowls", "tomato-lentil-bake"],
      ["tomato-white-bean-pasta", "beef-broccoli-skillet", "chickpea-shakshuka", "thai-basil-pork", "gochujang-shrimp-udon", "sweet-potato-enchiladas"],
    ];
    const dinnerKeys = new Set(recipes.filter((recipe) => recipe.role === "dinner").map((recipe) => recipe.key));
    const transformable = new Set(transformations.map((item) => item.sourceRecipeKey));
    const selected = weeks.flat();

    expect(new Set(selected).size).toBe(12);
    for (const week of weeks) {
      expect(week).toHaveLength(6);
      expect(week.every((key) => dinnerKeys.has(key))).toBe(true);
      expect(week.filter((key) => transformable.has(key))).toHaveLength(2);
      expect(new Set(week.map((key) => recipes.find((recipe) => recipe.key === key)!.tags.find((tag) => tag.dimension === "main")!.value)).size).toBeGreaterThanOrEqual(5);
    }
  });

  it("prepares extra chicken for lunch without doubling dinner sides", () => {
    const source = recipes.find((recipe) => recipe.key === "citrus-roast-chicken")!;
    const transformation = transformations.find((item) => item.sourceRecipeKey === source.key)!;
    const scalable = {
      baseServings: source.baseServings,
      components: source.components.map((component) => ({
        id: component.key,
        name: component.name,
        baseYieldMilli: asMilli(component.yield).milli,
        yieldUnit: component.yield.unit,
        ingredients: component.ingredients.map((item) => ({
          quantityMilli: asMilli(item).milli,
          unit: item.unit,
          ingredient: { name: item.key },
        })),
      })),
    };

    const scaled = scaleRecipe(scalable, 2, { chicken: asMilli(transformation.required) });
    const chicken = scaled.find((component) => component.id === "chicken")!;
    const potatoes = scaled.find((component) => component.id === "potatoes")!;
    const yogurt = scaled.find((component) => component.id === "yogurt")!;

    expect(chicken.extraYieldMilli).toBe(200_000);
    expect(chicken.ingredients.find((item) => item.ingredient.name === "chicken-thighs")?.scaled.milli).toBe(666_667);
    expect(potatoes.ingredients.find((item) => item.ingredient.name === "potatoes")?.scaled.milli).toBe(500_000);
    expect(yogurt.ingredients.find((item) => item.ingredient.name === "yogurt")?.scaled.milli).toBe(150_000);
  });
});
