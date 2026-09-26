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

// Two-person adaptations, with original publisher links and independently worded directions.
export const expandedSourcedRecipes: CatalogRecipe[] = [
  {
    key: "source-sausage-pepper-pasta", version: 1, title: "Sausage and pepper pasta",
    summary: "Italian sausage, bell pepper, tomato sauce, and feta with pasta.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 30,
    sourceUrl: "https://www.budgetbytes.com/pasta-with-sausage-and-peppers/",
    sourceAttribution: "Adapted for two from Beth Moncel's Pasta with Sausage and Peppers (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Italian-inspired", "sausage", "sear", "pasta"),
    components: [dish("Sausage and pepper pasta", [g("italian-sausage", 230), each("bell-pepper", 1),
      each("onion", 0.5), g("marinara", 340), g("pasta", 220), g("feta", 30),
      g("dried-basil", 1), g("oregano", 1), g("chili-flakes", 1), g("parsley", 8), ml("olive-oil", 15)])],
    steps: [
      { text: "Brown the sausage in an oiled skillet; slice it and return it to the pan to cook through." },
      { text: "Soften sliced pepper and onion beside the sausage. Add marinara, basil, oregano, and chili flakes and simmer while the pasta cooks." },
      { text: "Boil pasta until tender, drain, and toss it through the sauce. Finish with feta and parsley." },
    ],
  },
  {
    key: "source-chicken-shawarma-pitas", version: 1, title: "Sheet-pan chicken shawarma pitas",
    summary: "Spiced roast chicken, cucumber, tomato, and yogurt in warm pita.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 45,
    sourceUrl: "https://www.themediterraneandish.com/chicken-shawarma-recipe/",
    sourceAttribution: "Adapted for two from Suzy Karadsheh's Chicken Shawarma (The Mediterranean Dish). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Middle Eastern-inspired", "chicken", "roast", "pita"),
    components: [dish("Chicken shawarma pitas", [g("chicken-thighs", 400), each("onion", 0.5),
      each("lemon", 1), g("cumin", 3), g("turmeric", 3), g("ground-coriander", 3),
      g("paprika", 3), g("cayenne", 0.5), g("garlic", 8), ml("olive-oil", 25),
      each("pitas", 2), g("yogurt", 100), each("cucumber", 0.5), g("fresh-tomatoes", 150),
      g("salt", 2)])],
    steps: [
      { text: "Heat the oven to 425°F / 220°C. Cut chicken into bite-size pieces and toss with sliced onion, lemon juice, olive oil, garlic, cumin, turmeric, coriander, paprika, cayenne, and salt." },
      { text: "Spread on a sheet pan and roast until browned and the chicken reaches 165°F / 74°C, about 25–30 minutes." },
      { text: "Chop cucumber and tomato. Fill warmed pitas with chicken and vegetables, then add a spoonful of yogurt." },
    ],
  },
  {
    key: "source-lentil-marinara-spaghetti", version: 1, title: "Spaghetti with lentils and marinara",
    summary: "A hearty vegetarian pasta with simmered lentils and tomato sauce.", role: "dinner", baseServings: 2,
    activeMinutes: 15, totalMinutes: 45,
    sourceUrl: "https://cookieandkate.com/hearty-spaghetti-with-lentils-marinara/",
    sourceAttribution: "Adapted for two from Kathryne Taylor's Hearty Spaghetti with Lentils & Marinara (Cookie and Kate). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Italian-inspired", "lentils", "simmer", "pasta"),
    components: [dish("Lentil marinara spaghetti", [g("lentils", 100), each("bay-leaf", 1),
      g("garlic", 5), ml("broth", 480), g("marinara", 400), g("pasta", 220),
      g("parmesan", 25), g("basil", 10), g("salt", 2)])],
    steps: [
      { text: "Rinse lentils and simmer them with broth, a whole garlic clove, and a bay leaf until tender, about 25–35 minutes. Drain and discard the garlic and leaf." },
      { text: "Boil the spaghetti while the lentils cook. Warm marinara with the drained lentils." },
      { text: "Spoon lentil sauce over pasta and finish with Parmesan and torn basil." },
    ],
  },
  {
    key: "source-shrimp-tomato-orzo", version: 1, title: "Shrimp and orzo in garlic tomato sauce",
    summary: "Shrimp and spinach over orzo with lemon and tomatoes.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 35,
    sourceUrl: "https://www.themediterraneandish.com/garlic-tomato-shrimp-recipe-with-orzo/",
    sourceAttribution: "Adapted for two from Suzy Karadsheh's Shrimp and Orzo in a Garlic Tomato Sauce (The Mediterranean Dish). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Mediterranean-inspired", "shrimp", "simmer", "pasta"),
    components: [dish("Garlic tomato shrimp and orzo", [g("shrimp", 350), g("orzo", 180),
      g("diced-tomatoes", 220), g("spinach", 80), each("onion", 0.5), g("garlic", 15),
      each("lemon", 0.5), ml("broth", 60), g("butter", 8), ml("olive-oil", 15),
      g("thyme", 1), g("cayenne", 0.5), g("salt", 2)])],
    steps: [
      { text: "Boil orzo until just tender. In a second pan, soften onion and garlic in oil and butter." },
      { text: "Add broth, diced tomatoes, lemon juice, thyme, and cayenne; simmer until the sauce thickens, about 15 minutes." },
      { text: "Poach shrimp in the sauce until opaque and cooked through, then wilt in spinach. Spoon over the drained orzo." },
    ],
  },
  {
    key: "source-potato-leek-soup", version: 1, title: "Potato leek soup",
    summary: "A smooth leek and potato soup with thyme and a little cream.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 45,
    sourceUrl: "https://www.loveandlemons.com/potato-leek-soup/",
    sourceAttribution: "Adapted for two from Jeanine Donofrio's Potato Leek Soup (Love and Lemons). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("French-inspired", "potatoes", "simmer", "soup"),
    components: [dish("Potato leek soup", [g("leeks", 350), g("potatoes", 450),
      g("butter", 20), g("garlic", 7), ml("broth", 700), g("thyme", 1),
      ml("heavy-cream", 80), each("lemon", 0.5), g("chives", 8), g("salt", 2), g("pepper", 1)])],
    steps: [
      { text: "Slice and thoroughly rinse the leek whites and light green parts. Cut potatoes into small chunks." },
      { text: "Soften leeks in butter without browning. Add potato, garlic, broth, and thyme; simmer until the potato is very tender, about 20 minutes." },
      { text: "Blend until smooth. Stir in cream and a little lemon juice, then season and top with chives." },
    ],
  },
  {
    key: "source-turkey-three-bean-chili", version: 1, title: "Turkey and three-bean chili",
    summary: "Ground turkey, beans, corn, and poblano in a tomato chili.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 50,
    sourceUrl: "https://www.budgetbytes.com/turkey-chili/",
    sourceAttribution: "Adapted for two from Beth Moncel's Turkey Chili (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("American-inspired", "turkey", "simmer", "chili"),
    components: [dish("Turkey and three-bean chili", [g("ground-turkey", 250), each("onion", 0.5),
      each("poblano", 0.5), g("garlic", 8), g("black-beans", 100), g("kidney-beans", 100),
      g("pinto-beans", 100), g("corn", 80), g("fire-roasted-tomatoes", 250),
      g("tomato-paste", 50), g("chili-powder", 7), g("cumin", 3), g("oregano", 1),
      ml("olive-oil", 15), g("salt", 2), g("pepper", 1)])],
    steps: [
      { text: "Brown ground turkey in olive oil until fully cooked. Add chopped onion, poblano, and garlic and cook until softened." },
      { text: "Stir in drained beans, corn, tomatoes, tomato paste, chili powder, cumin, oregano, and about 200 mL water." },
      { text: "Cover and simmer gently for 30 minutes, stirring now and then. Season before serving." },
    ],
  },
  {
    key: "source-sesame-soba-noodles", version: 1, title: "Sesame soba noodles",
    summary: "Cool soba with edamame, snap peas, avocado, and sesame dressing.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 25,
    sourceUrl: "https://www.loveandlemons.com/sesame-soba-noodles/",
    sourceAttribution: "Adapted for two from Jeanine Donofrio's Sesame Soba Noodles (Love and Lemons). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Japanese-inspired", "edamame", "boil", "noodle bowl"),
    components: [dish("Sesame soba noodles", [g("soba", 180), g("edamame", 100),
      g("snap-peas", 160), g("radishes", 80), each("avocado", 1), g("mint", 8),
      each("lemon", 0.5), ml("rice-vinegar", 35), ml("soy", 25), ml("sesame-oil", 5),
      g("ginger", 8), g("garlic", 5), g("honey", 5), g("sesame-seeds", 8)])],
    steps: [
      { text: "Whisk rice vinegar, soy sauce, sesame oil, ginger, garlic, and honey into a dressing." },
      { text: "Cook soba according to its package. Drain and rinse under cold water until loose and cool; briefly blanch snap peas and edamame." },
      { text: "Toss noodles with dressing. Add peas, sliced radish, avocado, lemon juice, mint, and sesame seeds." },
    ],
  },
  {
    key: "source-cauliflower-lentil-tacos", version: 1, title: "Roasted cauliflower and lentil tacos",
    summary: "Warm cauliflower and spiced lentils with creamy chipotle sauce.", role: "dinner", baseServings: 2,
    activeMinutes: 25, totalMinutes: 60,
    sourceUrl: "https://cookieandkate.com/roasted-cauliflower-and-lentil-tacos/",
    sourceAttribution: "Adapted for two from Kathryne Taylor's Roasted Cauliflower and Lentil Tacos (Cookie and Kate). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Mexican-inspired", "lentils", "roast", "tacos"),
    components: [dish("Cauliflower and lentil tacos", [g("cauliflower", 500),
      g("lentils", 140), each("onion", 0.5), g("garlic", 7), g("tomato-paste", 30),
      g("cumin", 2), g("chili-powder", 2), ml("broth", 400), ml("olive-oil", 35),
      g("mayonnaise", 70), each("lime", 1), g("chipotle-adobo", 20),
      each("corn-tortillas", 8), g("cilantro", 15), g("salt", 2), g("pepper", 1)])],
    steps: [
      { text: "Heat the oven to 425°F / 220°C. Toss cauliflower florets with oil, salt, and pepper and roast until golden, about 30–35 minutes." },
      { text: "Meanwhile soften onion and garlic in a saucepan. Cook tomato paste, cumin, and chili powder for a minute, then add rinsed lentils and broth. Simmer until tender, about 25–35 minutes; drain any extra liquid." },
      { text: "Mix mayonnaise with lime juice and minced chipotle. Warm the tortillas and fill with cauliflower, lentils, chipotle sauce, and cilantro." },
    ],
  },
];
