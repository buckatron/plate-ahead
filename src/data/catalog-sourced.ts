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

// These are two-serving adaptations of linked publisher recipes, not copies of their prose.
// They have not been kitchen-tested in Plate Ahead. Open the source for the publisher's full recipe.
export const sourcedRecipes: CatalogRecipe[] = [
  {
    key: "source-greek-sheet-pan-chicken", version: 1, title: "Greek sheet-pan chicken & vegetables",
    summary: "Lemon-oregano chicken with peppers, tomatoes, olives, and feta.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 50,
    sourceUrl: "https://www.budgetbytes.com/sheet-pan-greek-chicken-and-vegetables/",
    sourceAttribution: "Adapted for two from Beth Moncel's Sheet Pan Greek Chicken and Vegetables (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Greek-inspired", "chicken", "sheet-pan roast", "plate"),
    components: [dish("Chicken and vegetables", [g("chicken-breast", 340), g("cherry-tomatoes", 225), each("bell-pepper", 1), each("red-onion", 0.5), each("lemon", 0.5), g("garlic", 8), g("oregano", 2), ml("olive-oil", 30), g("salt", 2), g("pepper", 1), g("kalamata-olives", 40), g("feta", 30), g("parsley", 8)])],
    steps: [
      { text: "Heat the oven to 400°F / 205°C. Mix the oil with lemon zest and juice, minced garlic, oregano, salt, and pepper." },
      { text: "Cut the pepper and onion into large pieces. Coat them and the tomatoes with half the lemon mixture; roast on a sheet pan for 10 minutes." },
      { text: "Flatten thick parts of the chicken breast so it cooks evenly. Coat the chicken with the remaining mixture, move the vegetables aside, and add chicken to the pan." },
      { text: "Roast about 20–25 minutes more, until the chicken reaches 165°F / 74°C. Scatter chopped olives, feta, and parsley over the pan before serving." },
    ],
  },
  {
    key: "source-beef-cabbage-stir-fry", version: 1, title: "Beef and cabbage stir-fry",
    summary: "Quick ginger-beef skillet with plenty of cabbage and carrots.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 30,
    sourceUrl: "https://www.budgetbytes.com/beef-cabbage-stir-fry/",
    sourceAttribution: "Adapted for two from Beth Moncel's Beef and Cabbage Stir Fry (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("East Asian-inspired", "beef", "stir-fry", "skillet"),
    components: [dish("Beef and cabbage", [g("ground-beef", 225), g("cabbage", 350), g("carrots", 120), each("scallions", 2), g("garlic", 6), g("ginger", 12), ml("olive-oil", 8), ml("soy", 15), ml("sesame-oil", 8), ml("sriracha", 8), g("brown-sugar", 6), g("salt", 1), g("pepper", 1)])],
    steps: [
      { text: "Stir together soy sauce, sesame oil, sriracha, and brown sugar. Shred the cabbage and carrots; slice the scallions." },
      { text: "Brown the beef in a hot, oiled skillet with minced garlic and grated ginger until fully cooked." },
      { text: "Add the cabbage and carrots and cook until slightly softened. Pour in the sauce, toss well, and finish with scallions." },
    ],
  },
  {
    key: "source-quick-tofu-stir-fry", version: 1, title: "Crumbled tofu & cabbage stir-fry",
    summary: "Crisp-edged tofu, cabbage, and peanuts in a ginger-soy glaze.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 25,
    sourceUrl: "https://www.budgetbytes.com/quick-tofu-stir-fry/",
    sourceAttribution: "Adapted for two from Beth Moncel's Quick Tofu Stir Fry (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("East Asian-inspired", "tofu", "stir-fry", "skillet"),
    components: [dish("Tofu and cabbage", [g("tofu", 400), g("cabbage", 225), g("carrots", 60), g("peanuts", 20), each("scallions", 1), ml("soy", 22), g("brown-sugar", 15), ml("sesame-oil", 3), g("garlic", 5), g("ginger", 5), ml("olive-oil", 15)])],
    steps: [
      { text: "Combine the soy sauce, sugar, sesame oil, minced garlic, grated ginger, and 15 mL water. Shred the cabbage and carrots." },
      { text: "Drain and crumble tofu. Cook it in a hot oiled skillet until its liquid evaporates and the edges take on color." },
      { text: "Pour the sauce over the tofu and cook briefly until glossy. Fold in the vegetables and chopped peanuts; cook just until the cabbage softens. Top with scallions." },
    ],
  },
  {
    key: "source-lemon-pasta", version: 1, title: "Lemon, garlic & Parmesan pasta",
    summary: "A quick pasta with a butter-and-lemon sauce and fresh herbs.", role: "dinner", baseServings: 2,
    activeMinutes: 15, totalMinutes: 20,
    sourceUrl: "https://www.loveandlemons.com/lemon-pasta/",
    sourceAttribution: "Adapted from Jeanine Donofrio's Lemon Pasta (Love and Lemons). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Italian-inspired", "pasta", "boil", "pasta"),
    components: [dish("Lemon pasta", [g("pasta", 225), g("butter", 55), each("lemon", 1), g("garlic", 6), g("parmesan", 45), g("parsley", 10), g("salt", 3), g("pepper", 1)])],
    steps: [
      { text: "Cook the pasta in salted water until al dente. Save a mug of its cooking water before draining." },
      { text: "Melt butter over low heat in a wide pan. Add lemon zest and minced garlic; warm gently without browning the garlic." },
      { text: "Toss the pasta in the pan with about 120 mL cooking water. Add Parmesan in two additions, then lemon juice, tossing until a light sauce coats the pasta. Loosen with more pasta water if needed." },
      { text: "Season to taste and finish with chopped parsley and extra lemon zest." },
    ],
  },
  {
    key: "source-thai-vegetable-red-curry", version: 1, title: "Vegetable red curry with rice",
    summary: "Peppers, carrots, and kale in coconut curry sauce.", role: "dinner", baseServings: 2,
    activeMinutes: 20, totalMinutes: 45,
    sourceUrl: "https://cookieandkate.com/thai-red-curry-recipe/",
    sourceAttribution: "Adapted for two from Kathryne Taylor's Thai Red Curry with Vegetables (Cookie and Kate). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Thai-inspired", "vegetables", "simmer", "curry"),
    components: [dish("Vegetable curry and rice", [g("rice", 150), ml("olive-oil", 8), each("onion", 0.5), g("ginger", 8), g("garlic", 6), each("bell-pepper", 1), g("carrots", 90), g("curry-paste", 15), ml("coconut-milk", 200), g("kale", 50), g("brown-sugar", 3), ml("soy", 8), ml("rice-vinegar", 5), g("basil", 5), g("salt", 2)])],
    steps: [
      { text: "Start the rice according to its package directions. Slice the pepper, onion, carrots, and kale." },
      { text: "Soften onion in oil, then stir in grated ginger and minced garlic. Add the pepper and carrots and cook a few minutes before stirring in the curry paste." },
      { text: "Add coconut milk, 60 mL water, kale, and sugar. Simmer gently until the vegetables are tender." },
      { text: "Take off the heat and season with soy sauce and vinegar. Serve over rice with torn basil." },
    ],
  },
  {
    key: "source-one-pot-pesto-chicken-pasta", version: 1, title: "One-pot pesto chicken pasta",
    summary: "Chicken and pasta in a creamy basil-pesto sauce.", role: "dinner", baseServings: 2,
    activeMinutes: 15, totalMinutes: 30,
    sourceUrl: "https://www.budgetbytes.com/one-pot-creamy-pesto-chicken-pasta/",
    sourceAttribution: "Adapted for two from Beth Moncel's One Pot Creamy Pesto Chicken Pasta (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Italian-inspired", "chicken", "one-pot", "pasta"),
    components: [dish("Pesto chicken pasta", [g("chicken-breast", 225), g("pasta", 115), g("butter", 15), g("garlic", 6), ml("broth", 175), ml("milk", 120), g("cream-cheese", 45), g("basil-pesto", 40), g("parmesan", 15), g("spinach", 45), g("pepper", 1)])],
    steps: [
      { text: "Cut chicken into small pieces. Brown it in melted butter in a deep skillet, then stir in minced garlic." },
      { text: "Add dry pasta and broth. Cover and simmer, stirring often, until the pasta is tender and most liquid has been absorbed. Confirm chicken reaches 165°F / 74°C." },
      { text: "Stir in milk, cream cheese, and pesto until smooth. Add Parmesan and spinach; heat until the spinach wilts, then season with pepper." },
    ],
  },
  {
    key: "source-chipotle-black-bean-burgers", version: 1, title: "Chipotle black bean burgers",
    summary: "Smoky bean patties on buns with crunchy onion.", role: "dinner", baseServings: 2,
    activeMinutes: 25, totalMinutes: 35,
    sourceUrl: "https://www.loveandlemons.com/black-bean-burger-recipe/",
    sourceAttribution: "Adapted for two from Jeanine Donofrio's Black Bean Burger (Love and Lemons). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("American-inspired", "black beans", "pan-sear", "burger"),
    components: [dish("Black bean burgers", [g("black-beans", 250), each("onion", 0.25), g("garlic", 5), g("chipotle-adobo", 20), ml("soy", 5), ml("balsamic-vinegar", 5), g("cumin", 2), g("salt", 2), g("pepper", 1), each("eggs", 1), g("panko", 45), ml("olive-oil", 10), each("burger-buns", 2), each("red-onion", 0.25)])],
    steps: [
      { text: "Drain the beans well. Grate the yellow onion and discard excess liquid; mince the garlic and chipotle." },
      { text: "Mash beans with onion, garlic, chipotle, soy sauce, vinegar, cumin, salt, and pepper. Fold in the egg and breadcrumbs; shape into two large patties. Chill briefly if too soft to handle." },
      { text: "Oil a hot skillet and sear patties until browned and firm, about 5 minutes per side. Serve on buns with thinly sliced red onion." },
    ],
  },
  {
    key: "source-blackened-shrimp-tacos", version: 1, title: "Blackened shrimp tacos",
    summary: "Spiced shrimp with cabbage slaw and lime sauce.", role: "dinner", baseServings: 2,
    activeMinutes: 30, totalMinutes: 40,
    sourceUrl: "https://www.budgetbytes.com/blackened-shrimp-tacos/",
    sourceAttribution: "Adapted for two from Beth Moncel's Blackened Shrimp Tacos (Budget Bytes). Plate Ahead adaptation not kitchen-tested.",
    tags: tags("Cajun-inspired", "shrimp", "pan-sear", "tacos"),
    components: [dish("Shrimp tacos and slaw", [g("shrimp", 225), each("corn-tortillas", 6), g("cabbage", 225), g("carrots", 60), each("scallions", 3), g("mayonnaise", 100), g("dijon", 5), ml("red-wine-vinegar", 5), g("honey", 8), each("lime", 1), g("paprika", 7), g("thyme", 1), g("oregano", 1), g("cumin", 1), g("cayenne", 0.5), g("butter", 15), g("garlic", 5), g("salt", 2), g("pepper", 1)])],
    steps: [
      { text: "Shred cabbage and carrot. Mix half the mayonnaise with Dijon, vinegar, honey, salt, and pepper; toss with the slaw and sliced scallions." },
      { text: "Mix the remaining mayonnaise with lime juice and a pinch of paprika for a quick sauce. Warm the tortillas in a dry skillet." },
      { text: "Coat shrimp with paprika, thyme, oregano, cumin, cayenne, salt, and pepper. Melt butter in a skillet, briefly cook minced garlic, then add shrimp and cook until opaque and firm, about 3–5 minutes." },
      { text: "Fill the tortillas with slaw and shrimp, drizzle with lime sauce, and serve with remaining lime wedges." },
    ],
  },
];
