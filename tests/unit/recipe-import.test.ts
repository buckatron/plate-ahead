import { describe, expect, it } from "vitest";
import { extractRecipeJsonLd } from "../../src/domain/meals/recipe-jsonld";
import { publicImportAddress } from "../../src/domain/meals/public-import-address";

describe("recipe link extraction", () => {
  it("finds multiple recipes inside an @graph and preserves ordered sections", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@graph": [
      { "@type": "WebPage", name: "Article" },
      { "@type": ["CreativeWork", "Recipe"], name: "Bean wraps", recipeYield: "2 servings", totalTime: "PT25M",
        recipeIngredient: ["200 g beans", "salt to taste"], recipeInstructions: [
          { "@type": "HowToSection", name: "Prepare", itemListElement: [
            { "@type": "HowToStep", text: "Warm the beans." }, { "@type": "HowToStep", text: "Fill the wraps." },
          ] },
        ] },
      { "@type": "Recipe", name: "Quick salad", recipeYield: "1 bowl", recipeIngredient: ["1 cucumber"],
        recipeInstructions: "Cut cucumber.\nToss." },
    ] })}</script>`;
    const recipes = extractRecipeJsonLd(html, "https://recipes.example/test");
    expect(recipes).toHaveLength(2);
    expect(recipes[0]).toMatchObject({ title: "Bean wraps", servings: 2, totalMinutes: 25,
      ingredientLines: ["200 g beans", "salt to taste"], steps: ["Prepare", "Warm the beans.", "Fill the wraps."] });
    expect(recipes[1]).toMatchObject({ title: "Quick salad", servings: 0, originalYield: "1 bowl" });
  });

  it("ignores invalid markup instead of making up missing recipe fields", () => {
    expect(extractRecipeJsonLd('<script type="application/ld+json">{broken</script>', "https://recipes.example/")).toEqual([]);
  });

  it("retains structured ingredient amounts for review", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "Soup",
      recipeIngredient: [{ "@type": "PropertyValue", value: 2, unitText: "cups", name: "broth" }],
      recipeInstructions: "Warm broth." })}</script>`;
    expect(extractRecipeJsonLd(html, "https://recipes.example/soup")[0].ingredientLines).toEqual(["2 cups broth"]);
  });
});

describe("recipe import address boundary", () => {
  it("rejects loopback, private, link-local and mapped addresses", () => {
    for (const address of ["127.0.0.1", "10.4.3.2", "192.168.1.1", "169.254.1.1", "::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(publicImportAddress(address), address).toBe(false);
    }
    expect(publicImportAddress("8.8.8.8")).toBe(true);
    expect(publicImportAddress("2606:4700:4700::1111")).toBe(true);
  });
});
