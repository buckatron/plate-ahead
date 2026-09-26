import type { CatalogRecipe, CatalogComponent } from "./catalog";

type Item = CatalogComponent["ingredients"][number];
const g = (key: string, amount: number): Item => ({ key, amount, unit: "g" });
const ml = (key: string, amount: number): Item => ({ key, amount, unit: "ml" });
const each = (key: string, amount: number): Item => ({ key, amount, unit: "each" });
const dish = (name: string, ingredients: Item[]): CatalogComponent => ({
  key: "dish", name, yield: { amount: 2, unit: "portion" }, reservable: false,
  preparation: "Prepare and serve as described in the steps.", ingredients,
});
const tags = (cuisine: string, main: string, technique: string, format: string): CatalogRecipe["tags"] => [
  { dimension: "cuisine", value: cuisine }, { dimension: "main", value: main },
  { dimension: "technique", value: technique }, { dimension: "format", value: format },
];

// Two-person adaptations of the linked publishers' recipes; directions are independently worded.
// These Plate Ahead versions have not been kitchen-tested.
export const additionalSourcedRecipes: CatalogRecipe[] = [
  {
    key: "source-creamy-pesto-chicken", version: 1, title: "Creamy pesto chicken",
    summary: "Pan-seared chicken in a pesto, tomato, and cream sauce.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 35,
    sourceUrl: "https://www.budgetbytes.com/creamy-pesto-chicken/",
    sourceAttribution: "Adapted for two from Beth Moncel's Creamy Pesto Chicken (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Italian-inspired", "chicken", "pan-sear", "skillet"),
    components: [dish("Creamy pesto chicken", [g("chicken-breast", 320), g("cherry-tomatoes", 220),
      g("garlic", 6), ml("heavy-cream", 60), g("basil-pesto", 30), ml("olive-oil", 15),
      g("salt", 1), g("pepper", 1)])],
    steps: [
      { text: "Slice the chicken breasts into thinner cutlets and season them with salt and pepper." },
      { text: "Sear the chicken in half the oil until browned and 165°F / 74°C in the center; move it to a plate." },
      { text: "Soften halved tomatoes and minced garlic in the remaining oil. Stir in cream and pesto and simmer briefly." },
      { text: "Return the chicken to the skillet and coat it in the sauce. Heat through and serve." },
    ],
  },
  {
    key: "source-extra-vegetable-fried-rice", version: 1, title: "Extra-vegetable fried rice",
    summary: "Eggs, carrots, peas, greens, and rice in a quick skillet dinner.", role: "dinner", baseServings: 2,
    activeMinutes: 25, totalMinutes: 55,
    sourceUrl: "https://cookieandkate.com/vegetable-fried-rice-recipe/",
    sourceAttribution: "Adapted for two from Kathryne Taylor's Extra Vegetable Fried Rice (Cookie and Kate). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("East Asian-inspired", "eggs", "stir-fry", "rice bowl"),
    components: [dish("Vegetable fried rice", [g("rice", 150), each("eggs", 2), each("onion", 0.5),
      g("carrots", 120), g("peas", 150), g("spinach", 50), each("scallions", 2), g("ginger", 12),
      g("garlic", 6), ml("soy", 15), ml("sesame-oil", 5), ml("olive-oil", 25), g("salt", 1)])],
    steps: [
      { text: "Cook the rice, spread it on a tray, and cool it promptly while chopping the vegetables. Previously cooked, chilled rice also works." },
      { text: "Scramble the eggs in a hot skillet until fully set, then transfer them to a bowl. Cook onion, carrot, and peas in a little oil until tender; add ginger and garlic." },
      { text: "Move the vegetables aside, add the remaining oil and cooled rice, and let the rice toast before stirring." },
      { text: "Fold in spinach, soy sauce, sesame oil, cooked eggs, and scallions; cook until everything is hot throughout." },
    ],
  },
  {
    key: "source-black-bean-stuffed-peppers", version: 1, title: "Black bean and rice stuffed peppers",
    summary: "Roasted peppers filled with lime-spiced rice, beans, corn, and cheese.", role: "dinner", baseServings: 2,
    activeMinutes: 25, totalMinutes: 50,
    sourceUrl: "https://www.loveandlemons.com/stuffed-peppers-recipe/",
    sourceAttribution: "Adapted for two from Jeanine Donofrio's Stuffed Peppers (Love and Lemons). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Mexican-inspired", "black beans", "roast", "stuffed pepper"),
    components: [dish("Stuffed peppers", [each("bell-pepper", 2), g("rice", 120), g("black-beans", 190),
      g("corn", 120), g("cheddar", 90), each("jalapeno", 1), each("scallions", 2), g("garlic", 6),
      each("lime", 1), g("cumin", 3), g("ground-coriander", 2), g("cilantro", 15),
      ml("olive-oil", 15), g("salt", 2)])],
    steps: [
      { text: "Cook the rice. Heat the oven to 450°F / 230°C. Halve and seed the peppers, drizzle with a little oil, and roast cut-side up for 10 minutes." },
      { text: "Mix rice with drained beans, corn, minced jalapeño, scallions, garlic, lime zest and juice, cumin, coriander, cilantro, and the remaining oil." },
      { text: "Spoon filling into pepper halves and top with cheddar. Return to the oven until the filling is hot and cheese melts, about 10–15 minutes." },
    ],
  },
  {
    key: "source-lemon-garlic-cod", version: 1, title: "Lemon-garlic baked cod",
    summary: "Spice-coated cod in a lemon, garlic, and parsley sauce.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 35,
    sourceUrl: "https://www.themediterraneandish.com/baked-cod-recipe-lemon-garlic/",
    sourceAttribution: "Adapted for two from Suzy Karadsheh's Baked Cod with Lemon and Garlic (The Mediterranean Dish). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Mediterranean-inspired", "fish", "sear and bake", "plate"),
    components: [dish("Lemon-garlic cod", [g("cod", 350), each("lemon", 1), g("garlic", 12),
      g("flour", 25), g("ground-coriander", 2), g("paprika", 2), g("cumin", 2),
      ml("olive-oil", 30), g("butter", 12), g("parsley", 12), g("salt", 2), g("pepper", 1)])],
    steps: [
      { text: "Heat the oven to 400°F / 200°C. Mix lemon juice with olive oil and melted butter; separately combine flour, coriander, paprika, cumin, salt, and pepper." },
      { text: "Pat the cod dry. Dip it in lemon mixture, then lightly coat it in the seasoned flour. Briefly sear both sides in an oven-safe skillet." },
      { text: "Stir minced garlic into the remaining lemon mixture and spoon it over the fish. Bake until the cod flakes and reaches 145°F / 63°C, about 10–12 minutes. Finish with parsley." },
    ],
  },
];
