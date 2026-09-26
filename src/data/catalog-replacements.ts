import type { CatalogIngredient, CatalogRecipe } from "./catalog";
import { moreReplacementSpecs } from "./catalog-replacements-more";

export type SourceSpec = {
  key: string;
  title: string;
  summary: string;
  url: string;
  credit: string;
  totalMinutes: number;
  activeMinutes: number;
  parts: Array<Array<[ingredientKey: string, amount: number]>>;
  steps: string[];
  preparations?: string[];
  yields?: number[];
};

// Quantities are two-person adaptations, with separate reserved components where a linked lunch needs them.
// Directions are newly written summaries of the linked publisher methods, not copied source text.
const specs: SourceSpec[] = [
  {
    key: "soy-ginger-chicken-cabbage", title: "Ginger-soy chicken with cabbage rice",
    summary: "Skillet chicken in a ginger-soy glaze, with cabbage and rice.",
    url: "https://www.budgetbytes.com/sticky-ginger-soy-glazed-chicken/",
    credit: "Beth Moncel's Sticky Ginger Soy Glazed Chicken (Budget Bytes)", totalMinutes: 60, activeMinutes: 25,
    parts: [
      [["chicken-thighs", 800], ["olive-oil", 15], ["salt", 3]],
      [["rice", 160], ["cabbage", 250], ["ginger", 15], ["garlic", 8], ["soy", 30], ["brown-sugar", 20], ["olive-oil", 10], ["scallions", 2]],
    ],
    preparations: ["Cook the lunch chicken separately without marinade; glaze only the dinner portion.", "Cook rice and cabbage while the dinner chicken marinates."], yields: [600, 2],
    steps: [
      "Set aside the chicken intended for lunch before mixing the marinade. Mix soy sauce, brown sugar, grated ginger, minced garlic, and a little oil; coat only the dinner chicken and refrigerate for 30 minutes. Start the rice meanwhile.",
      "Sear both portions of chicken separately until browned and 165°F / 74°C at the thickest point. Refrigerate the plain lunch portion promptly.",
      "Bring the remaining marinade to a full boil in the skillet and reduce until glossy. Toss the dinner chicken through it. Quickly sauté shredded cabbage and serve everything over rice with scallions.",
    ],
  },
  {
    key: "lemon-lentil-feta-cakes", title: "Lentil and feta patties",
    summary: "Tender lentil patties with feta, herbs, and lemon yogurt.",
    url: "https://www.food.com/recipe/lentil-and-feta-patty-537344",
    credit: "Lentil and Feta Patty (Food.com)", totalMinutes: 50, activeMinutes: 25,
    parts: [
      [["lentils", 300]],
      [["eggs", 1], ["feta", 90], ["flour", 25], ["scallions", 2], ["bell-pepper", 0.5], ["oregano", 2], ["garlic", 5], ["olive-oil", 20], ["yogurt", 100], ["lemon", 1]],
    ],
    preparations: ["Cook lentils until tender and reserve the plain lunch share before mixing patties.", "Mix and pan-fry patties; serve with lemon yogurt."], yields: [550, 2],
    steps: [
      "Simmer rinsed lentils in water until tender, then drain thoroughly. Set aside the plain lentils needed for lunch.",
      "Soften diced pepper, scallions, and garlic in a little oil. Combine with the dinner lentils, egg, flour, crumbled feta, and oregano; shape into small patties.",
      "Pan-fry in the remaining oil until browned and the centers reach 160°F / 71°C. Stir lemon juice into yogurt and serve alongside.",
    ],
  },
  {
    key: "paprika-salmon-potatoes", title: "Blackened salmon with smashed potatoes",
    summary: "Paprika-spiced salmon beside creamy potatoes and lima beans.",
    url: "https://www.foodnetwork.com/recipes/food-network-kitchen/blackened-salmon-with-lima-bean-smashed-potatoes-3363805",
    credit: "Blackened Salmon with Lima Bean Smashed Potatoes (Food Network Kitchen)", totalMinutes: 40, activeMinutes: 25,
    parts: [
      [["salmon", 650], ["olive-oil", 15], ["salt", 3]],
      [["potatoes", 450], ["lima-beans", 90], ["butter", 20], ["yogurt", 60], ["paprika", 8], ["thyme", 2], ["cayenne", 1], ["scallions", 2], ["lime", 1]],
    ],
    preparations: ["Cook salmon plainly and reserve the lunch share before seasoning dinner portions.", "Mash potatoes with lima beans and yogurt; season the dinner salmon."], yields: [550, 2],
    steps: [
      "Boil cut potatoes in salted water. Add thawed lima beans near the end and cook until both are tender; drain and mash with yogurt, butter, and scallions.",
      "Cook the salmon in an oiled skillet until it reaches 145°F / 63°C. Set aside the plain portion for lunch.",
      "Mix paprika, thyme, and a little cayenne. Sprinkle over the dinner salmon and briefly return it to the pan to bloom the spices. Serve with the potato mash and lime.",
    ],
  },
  {
    key: "herbed-chickpea-pilaf", title: "Spinach and chickpea rice pilaf",
    summary: "One-pot rice with chickpeas, spinach, lemon, and feta.",
    url: "https://www.budgetbytes.com/spinach-and-chickpea-rice-pilaf/",
    credit: "Beth Moncel's Spinach and Chickpea Rice Pilaf (Budget Bytes)", totalMinutes: 40, activeMinutes: 15,
    parts: [
      [["chickpeas", 500]],
      [["rice", 160], ["broth", 420], ["spinach", 115], ["feta", 20], ["onion", 0.5], ["garlic", 6], ["lemon", 0.5], ["olive-oil", 15], ["paprika", 2], ["oregano", 1], ["cumin", 1]],
    ],
    preparations: ["Drain the chickpeas and keep the lunch portion plain before adding dinner beans to rice.", "Cook the rice, aromatics, spinach, and chickpeas together."], yields: [500, 2],
    steps: [
      "Drain chickpeas and measure out the plain portion reserved for lunch. Squeeze excess water from thawed spinach if using frozen spinach.",
      "Soften onion and garlic in olive oil. Add paprika, oregano, cumin, and dry rice; stir until fragrant.",
      "Add the dinner chickpeas, spinach, broth, and lemon juice. Cover and simmer until rice is tender, then rest off the heat for 5 minutes. Fluff and finish with lemon zest and feta.",
    ],
  },
  {
    key: "garlic-shrimp-tomato-pasta", title: "Spicy shrimp and tomato pasta",
    summary: "Shrimp, garlic, and tomato sauce tossed with pasta.",
    url: "https://www.budgetbytes.com/spicy-shrimp-tomato-pasta/",
    credit: "Beth Moncel's Spicy Shrimp Tomato Pasta (Budget Bytes)", totalMinutes: 30, activeMinutes: 20,
    parts: [
      [["shrimp", 230], ["pasta", 230], ["diced-tomatoes", 400], ["garlic", 10], ["butter", 15], ["olive-oil", 15], ["chili-flakes", 1], ["parsley", 10], ["salt", 2], ["pepper", 1]],
    ],
    steps: [
      "Boil the pasta until just tender. While it cooks, warm butter and olive oil in a skillet.",
      "Cook minced garlic and shrimp until the shrimp turn opaque; lift them out so they stay tender.",
      "Simmer diced tomatoes with chili flakes, salt, and pepper for several minutes. Toss in pasta and shrimp, then finish with parsley.",
    ],
  },
  {
    key: "beef-cumin-pita-patties", title: "Kofta-spiced beef pita pockets",
    summary: "Warm pita with spiced ground beef, cucumber, and tomato.",
    url: "https://www.themediterraneandish.com/ground-beef-pita-sandwich/",
    credit: "Suzy Karadsheh's Kofta-Seasoned Ground Beef Pita Sandwich (The Mediterranean Dish)", totalMinutes: 30, activeMinutes: 25,
    parts: [
      [["ground-beef", 350], ["onion", 0.5], ["garlic", 6], ["allspice", 2], ["paprika", 1], ["cayenne", 0.5], ["parsley", 15], ["olive-oil", 10], ["pitas", 2], ["fresh-tomatoes", 150], ["cucumber", 0.5], ["red-onion", 0.25], ["yogurt", 100]],
    ],
    steps: [
      "Soften chopped onion and garlic in olive oil. Add ground beef and cook until fully browned, breaking it up as it cooks.",
      "Season the beef with allspice, paprika, cayenne, salt, and parsley. Slice cucumber, tomato, and red onion; stir a little salt into the yogurt.",
      "Fill warmed pita pockets with the beef and vegetables, then spoon yogurt over the top.",
    ],
  },
  {
    key: "gochujang-tofu-cabbage-cups", title: "Gochujang tofu lettuce cups",
    summary: "Golden tofu with crunchy slaw in lettuce leaves.",
    url: "https://www.homechef.com/meals/korean-style-tofu-lettuce-cups",
    credit: "Rachel Post's Korean-Style Tofu Lettuce Cups (Home Chef)", totalMinutes: 40, activeMinutes: 30,
    parts: [
      [["tofu", 340], ["butter-lettuce", 1], ["cabbage", 115], ["carrots", 60], ["scallions", 2], ["gochujang", 20], ["sweet-chili-sauce", 55], ["rice-vinegar", 25], ["soy", 8], ["ginger", 8], ["olive-oil", 15], ["salt", 1]],
    ],
    steps: [
      "Press excess water from cubed tofu and separate the lettuce leaves. Toss shredded cabbage and carrot with rice vinegar, grated ginger, and a little sweet chili sauce.",
      "Brown tofu in a hot oiled skillet. In the same pan, soften scallion whites and simmer gochujang with soy sauce, remaining sweet chili sauce, and a splash of water.",
      "Coat the tofu in the sauce. Spoon into lettuce cups with the slaw and scallion greens.",
    ],
  },
  {
    key: "mushroom-spinach-frittata", title: "Spinach, mushroom, and feta frittata",
    summary: "A vegetable-filled baked frittata for dinner.",
    url: "https://www.food.com/recipe/spinach-mushroom-and-feta-frittata-125630",
    credit: "Spinach, Mushroom, and Feta Frittata (Food.com)", totalMinutes: 45, activeMinutes: 20,
    parts: [
      [["eggs", 4], ["mushrooms", 120], ["spinach", 100], ["feta", 55], ["scallions", 3], ["zucchini", 0.5], ["bell-pepper", 0.5], ["milk", 20], ["butter", 10], ["parsley", 10], ["salt", 2], ["pepper", 1]],
    ],
    steps: [
      "Heat the oven to 350°F / 175°C. Wilt spinach and squeeze out extra moisture.",
      "Soften mushrooms, pepper, scallions, and zucchini in butter in an oven-safe skillet. Stir in the spinach.",
      "Whisk eggs with milk, parsley, salt, and pepper. Pour over vegetables, scatter feta on top, and bake until set in the center, about 20–25 minutes; egg dishes should reach 160°F / 71°C.",
    ],
  },
  ...moreReplacementSpecs,
];

export function replaceLegacyRecipes(legacy: CatalogRecipe[], ingredients: CatalogIngredient[]): CatalogRecipe[] {
  const byKey = new Map(ingredients.map((ingredient) => [ingredient.key, ingredient]));
  const specsByKey = new Map(specs.map((spec) => [spec.key, spec]));
  if (specsByKey.size !== specs.length || legacy.length !== specs.length) throw new Error("Source replacements must cover every original recipe exactly once.");
  return legacy.map((recipe) => {
    const spec = specsByKey.get(recipe.key);
    if (!spec || spec.parts.length !== recipe.components.length) throw new Error(`Missing or incomplete source replacement: ${recipe.key}`);
    return {
      ...recipe, version: 2, title: spec.title, summary: spec.summary, totalMinutes: spec.totalMinutes,
      activeMinutes: spec.activeMinutes, sourceUrl: spec.url,
      sourceAttribution: `Plate Ahead adaptation of ${spec.credit}.`,
      components: recipe.components.map((component, index) => ({
        ...component, name: !component.reservable && recipe.components.length === 1 ? spec.title : component.name,
        yield: spec.yields?.[index] ? { ...component.yield, amount: spec.yields[index] } : component.yield,
        preparation: spec.preparations?.[index] ?? "Prepare as described in the steps.",
        ingredients: spec.parts[index].map(([key, amount]) => {
          const ingredient = byKey.get(key);
          if (!ingredient) throw new Error(`Unknown source ingredient: ${recipe.key}/${key}`);
          return { key, amount, unit: ingredient.defaultUnit };
        }),
      })),
      steps: spec.steps.map((text) => ({ text })),
    };
  });
}
