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

// Two-person adaptations of the linked recipes, with independently worded instructions.
export const latestSourcedRecipes: CatalogRecipe[] = [
  {
    key: "source-sheet-pan-gnocchi", version: 1, title: "Sheet-pan gnocchi with broccolini and feta",
    summary: "Roasted gnocchi, broccolini, and tomatoes finished with feta.", role: "dinner", baseServings: 2,
    activeMinutes: 15, totalMinutes: 40,
    sourceUrl: "https://www.loveandlemons.com/sheet-pan-gnocchi/",
    sourceAttribution: "Adapted for two from Jeanine Donofrio's Sheet Pan Gnocchi (Love and Lemons). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Italian-inspired", "gnocchi", "sheet-pan roast", "plate"),
    components: [dish("Sheet-pan gnocchi", [g("gnocchi", 250), g("broccolini", 180),
      g("cherry-tomatoes", 220), each("red-onion", 0.25), g("garlic", 6),
      ml("olive-oil", 20), g("thyme", 1), g("zaatar", 1), g("chili-flakes", 0.5),
      g("feta", 90), g("parsley", 8), g("salt", 2), g("pepper", 1)])],
    steps: [
      { text: "Heat the oven to 450°F / 230°C. Cut broccolini into bite-size pieces and thinly slice the onion and garlic." },
      { text: "Toss gnocchi, broccolini, tomatoes, onion, and garlic with oil, thyme, za'atar, chili flakes, salt, and pepper. Spread across a sheet pan." },
      { text: "Roast for 10 minutes and stir. Scatter feta over the pan, then roast 15–20 minutes more until the gnocchi is tender and vegetables are browned. Finish with parsley." },
    ],
  },
  {
    key: "source-bay-lemon-pork-chops", version: 1, title: "Pork chops with bay and lemon",
    summary: "Pan-seared pork chops with caramelized lemon and garlic over rice.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 40,
    sourceUrl: "https://www.themediterraneandish.com/pork-chops/",
    sourceAttribution: "Adapted for two from Domenica Marchetti's Pork Chops with Bay Leaf and Lemon Slices (The Mediterranean Dish). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Mediterranean-inspired", "pork", "pan-sear", "plate"),
    components: [dish("Bay and lemon pork chops", [g("pork-chops", 450), g("rice", 140),
      ml("olive-oil", 15), g("garlic", 8), each("bay-leaf", 2), each("lemon", 0.5),
      ml("broth", 40), g("salt", 3), g("pepper", 1)])],
    steps: [
      { text: "Cook the rice. Warm olive oil with sliced garlic and bay leaves in a heavy skillet; lift them out, then brown thin lemon slices in the same oil." },
      { text: "Season the pork and sear on both sides until golden. Add broth, return garlic, bay, and lemon, and cook gently until the pork reaches 145°F / 63°C." },
      { text: "Rest the chops for at least 3 minutes. Spoon pan juices over the pork and serve with rice." },
    ],
  },
  {
    key: "source-sweet-potato-black-bean-skillet", version: 1, title: "Sweet potato and black bean skillet",
    summary: "A vegetable-packed skillet with sweet potato, black beans, and kale.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 30,
    sourceUrl: "https://www.budgetbytes.com/sweet-potato-black-bean-skillet/",
    sourceAttribution: "Adapted for two from Marsha McDougal's Sweet Potato Black Bean Skillet (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Southwestern-inspired", "black beans", "sear", "skillet"),
    components: [dish("Sweet potato and black bean skillet", [g("sweet-potatoes", 350),
      g("black-beans", 200), each("bell-pepper", 0.5), each("onion", 0.5),
      g("diced-tomatoes", 200), g("kale", 70), g("chili-powder", 2),
      g("cumin", 1), g("paprika", 1), g("garlic", 5), g("cilantro", 8),
      ml("olive-oil", 15), g("salt", 2), g("pepper", 1)])],
    steps: [
      { text: "Cut sweet potato into small cubes. Sear in olive oil for about 8 minutes, stirring occasionally so some edges brown." },
      { text: "Add diced pepper, onion, garlic, chili powder, cumin, paprika, salt, and pepper. Cook until the onion starts to soften." },
      { text: "Fold in drained black beans, tomatoes, and chopped kale. Cook until the sweet potato is tender and everything is hot. Scatter cilantro on top." },
    ],
  },
  {
    key: "source-cabbage-okonomiyaki", version: 1, title: "Cabbage and scallion okonomiyaki",
    summary: "Crisp-edged cabbage and egg pancakes with a savory topping.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 30,
    sourceUrl: "https://www.loveandlemons.com/okonomiyaki/",
    sourceAttribution: "Adapted for two from Jeanine Donofrio's Okonomiyaki (Love and Lemons). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Japanese-inspired", "eggs", "pan-fry", "savory pancake"),
    components: [dish("Cabbage okonomiyaki", [g("cabbage", 300), each("scallions", 5),
      g("panko", 80), each("eggs", 3), ml("olive-oil", 15), g("salt", 2),
      g("mayonnaise", 35), ml("soy", 15), g("sesame-seeds", 8)])],
    steps: [
      { text: "Finely shred cabbage and slice scallions. Mix them with panko and salt, then fold in beaten eggs; the mixture will be loose." },
      { text: "Spoon small mounds into a lightly oiled skillet and press gently. Cook in batches until browned and the eggs are fully set, about 3–4 minutes per side." },
      { text: "Serve hot with a thin drizzle of mayonnaise and soy sauce and a sprinkle of sesame seeds." },
    ],
  },
];
