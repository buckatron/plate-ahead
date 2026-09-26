import type { Unit } from "@/domain/meals/quantity";
import { extraRecipes, extraTransformations } from "./catalog-extra";
import { sourcedRecipes } from "./catalog-sourced";
import { additionalSourcedRecipes } from "./catalog-sourced-more";
import { replaceLegacyRecipes } from "./catalog-replacements";

export type CatalogAmount = { amount: number; unit: Unit };
export type CatalogIngredient = { key: string; name: string; category: string; defaultUnit: Unit };
export type CatalogComponent = {
  key: string;
  name: string;
  yield: CatalogAmount;
  reservable: boolean;
  preparation: string;
  storageGuidance?: string;
  storageSourceUrl?: string;
  ingredients: Array<{ key: string } & CatalogAmount>;
};
export type CatalogRecipe = {
  key: string;
  version: number;
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceAttribution?: string;
  role: "dinner" | "lunch";
  baseServings: number;
  activeMinutes: number;
  totalMinutes: number;
  tags: Array<{ dimension: "cuisine" | "main" | "technique" | "flavor" | "texture" | "format"; value: string }>;
  components: CatalogComponent[];
  steps: Array<{ text: string; componentKey?: string }>;
};
export type CatalogTransformation = {
  key: string;
  sourceRecipeKey: string;
  sourceComponentKey: string;
  targetRecipeKey: string;
  targetComponentKey: string;
  required: CatalogAmount;
  description: string;
  compatibleState: string;
  storageGuidance: string;
  storageSourceUrl: string;
};

const storageSource = "https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts";
const leftoverStorage = "Refrigerate promptly in a shallow container. Use refrigerated cooked leftovers within 3 to 4 days.";

export const ingredients: CatalogIngredient[] = [
  { key: "chicken-thighs", name: "Boneless chicken thighs", category: "Meat & seafood", defaultUnit: "g" },
  { key: "tofu", name: "Firm tofu", category: "Protein", defaultUnit: "g" },
  { key: "salmon", name: "Salmon fillets", category: "Meat & seafood", defaultUnit: "g" },
  { key: "ground-beef", name: "Ground beef", category: "Meat & seafood", defaultUnit: "g" },
  { key: "ground-pork", name: "Ground pork", category: "Meat & seafood", defaultUnit: "g" },
  { key: "shrimp", name: "Raw peeled shrimp", category: "Meat & seafood", defaultUnit: "g" },
  { key: "chickpeas", name: "Canned chickpeas, drained", category: "Canned goods", defaultUnit: "g" },
  { key: "white-beans", name: "Canned white beans, drained", category: "Canned goods", defaultUnit: "g" },
  { key: "black-beans", name: "Canned black beans, drained", category: "Canned goods", defaultUnit: "g" },
  { key: "lentils", name: "Dry lentils", category: "Dry goods", defaultUnit: "g" },
  { key: "rice", name: "Dry rice", category: "Dry goods", defaultUnit: "g" },
  { key: "pasta", name: "Dry pasta", category: "Dry goods", defaultUnit: "g" },
  { key: "udon", name: "Udon noodles", category: "Dry goods", defaultUnit: "g" },
  { key: "tortillas", name: "Medium flour tortillas", category: "Bread", defaultUnit: "each" },
  { key: "pitas", name: "Pita breads", category: "Bread", defaultUnit: "each" },
  { key: "potatoes", name: "Potatoes", category: "Produce", defaultUnit: "g" },
  { key: "sweet-potatoes", name: "Sweet potatoes", category: "Produce", defaultUnit: "g" },
  { key: "cabbage", name: "Cabbage", category: "Produce", defaultUnit: "g" },
  { key: "bell-pepper", name: "Bell pepper", category: "Produce", defaultUnit: "each" },
  { key: "basil", name: "Fresh basil", category: "Produce", defaultUnit: "g" },
  { key: "spinach", name: "Baby spinach", category: "Produce", defaultUnit: "g" },
  { key: "broccoli", name: "Broccoli", category: "Produce", defaultUnit: "g" },
  { key: "mushrooms", name: "Mushrooms", category: "Produce", defaultUnit: "g" },
  { key: "cucumber", name: "Cucumber", category: "Produce", defaultUnit: "each" },
  { key: "zucchini", name: "Zucchini", category: "Produce", defaultUnit: "each" },
  { key: "red-onion", name: "Red onion", category: "Produce", defaultUnit: "each" },
  { key: "onion", name: "Yellow onion", category: "Produce", defaultUnit: "each" },
  { key: "scallions", name: "Scallions", category: "Produce", defaultUnit: "each" },
  { key: "garlic", name: "Garlic", category: "Produce", defaultUnit: "g" },
  { key: "ginger", name: "Fresh ginger", category: "Produce", defaultUnit: "g" },
  { key: "parsley", name: "Flat-leaf parsley", category: "Produce", defaultUnit: "g" },
  { key: "lemon", name: "Lemon", category: "Produce", defaultUnit: "each" },
  { key: "lime", name: "Lime", category: "Produce", defaultUnit: "each" },
  { key: "yogurt", name: "Plain Greek yogurt", category: "Dairy", defaultUnit: "g" },
  { key: "feta", name: "Feta", category: "Dairy", defaultUnit: "g" },
  { key: "cheddar", name: "Cheddar", category: "Dairy", defaultUnit: "g" },
  { key: "eggs", name: "Eggs", category: "Dairy", defaultUnit: "each" },
  { key: "tomatoes", name: "Canned crushed tomatoes", category: "Canned goods", defaultUnit: "g" },
  { key: "coconut-milk", name: "Coconut milk", category: "Canned goods", defaultUnit: "ml" },
  { key: "broth", name: "Vegetable broth", category: "Canned goods", defaultUnit: "ml" },
  { key: "olive-oil", name: "Olive oil", category: "Pantry", defaultUnit: "ml" },
  { key: "sesame-oil", name: "Sesame oil", category: "Pantry", defaultUnit: "ml" },
  { key: "soy", name: "Soy sauce", category: "Pantry", defaultUnit: "ml" },
  { key: "rice-vinegar", name: "Rice vinegar", category: "Pantry", defaultUnit: "ml" },
  { key: "peanut-butter", name: "Peanut butter", category: "Pantry", defaultUnit: "g" },
  { key: "honey", name: "Honey", category: "Pantry", defaultUnit: "g" },
  { key: "miso", name: "Miso paste", category: "Pantry", defaultUnit: "g" },
  { key: "fish-sauce", name: "Fish sauce", category: "Pantry", defaultUnit: "ml" },
  { key: "gochujang", name: "Gochujang", category: "Pantry", defaultUnit: "g" },
  { key: "curry-paste", name: "Red curry paste", category: "Pantry", defaultUnit: "g" },
  { key: "paprika", name: "Smoked paprika", category: "Pantry", defaultUnit: "g" },
  { key: "cumin", name: "Ground cumin", category: "Pantry", defaultUnit: "g" },
  { key: "salt", name: "Salt", category: "Pantry", defaultUnit: "g" },
  { key: "pepper", name: "Black pepper", category: "Pantry", defaultUnit: "g" },
  { key: "chicken-breast", name: "Boneless chicken breast", category: "Meat & seafood", defaultUnit: "g" },
  { key: "cherry-tomatoes", name: "Cherry tomatoes", category: "Produce", defaultUnit: "g" },
  { key: "oregano", name: "Dried oregano", category: "Pantry", defaultUnit: "g" },
  { key: "kalamata-olives", name: "Kalamata olives", category: "Canned goods", defaultUnit: "g" },
  { key: "carrots", name: "Carrots", category: "Produce", defaultUnit: "g" },
  { key: "sriracha", name: "Sriracha", category: "Pantry", defaultUnit: "ml" },
  { key: "brown-sugar", name: "Brown sugar", category: "Pantry", defaultUnit: "g" },
  { key: "peanuts", name: "Roasted peanuts", category: "Pantry", defaultUnit: "g" },
  { key: "butter", name: "Butter", category: "Dairy", defaultUnit: "g" },
  { key: "parmesan", name: "Parmesan", category: "Dairy", defaultUnit: "g" },
  { key: "milk", name: "Milk", category: "Dairy", defaultUnit: "ml" },
  { key: "cream-cheese", name: "Cream cheese", category: "Dairy", defaultUnit: "g" },
  { key: "basil-pesto", name: "Basil pesto", category: "Pantry", defaultUnit: "g" },
  { key: "kale", name: "Kale", category: "Produce", defaultUnit: "g" },
  { key: "chipotle-adobo", name: "Chipotle peppers in adobo", category: "Canned goods", defaultUnit: "g" },
  { key: "balsamic-vinegar", name: "Balsamic vinegar", category: "Pantry", defaultUnit: "ml" },
  { key: "panko", name: "Panko breadcrumbs", category: "Dry goods", defaultUnit: "g" },
  { key: "burger-buns", name: "Burger buns", category: "Bread", defaultUnit: "each" },
  { key: "mayonnaise", name: "Mayonnaise", category: "Pantry", defaultUnit: "g" },
  { key: "dijon", name: "Dijon mustard", category: "Pantry", defaultUnit: "g" },
  { key: "red-wine-vinegar", name: "Red wine vinegar", category: "Pantry", defaultUnit: "ml" },
  { key: "thyme", name: "Dried thyme", category: "Pantry", defaultUnit: "g" },
  { key: "cayenne", name: "Cayenne pepper", category: "Pantry", defaultUnit: "g" },
  { key: "corn-tortillas", name: "Small corn tortillas", category: "Bread", defaultUnit: "each" },
  { key: "flour", name: "All-purpose flour", category: "Dry goods", defaultUnit: "g" },
  { key: "lima-beans", name: "Lima beans", category: "Frozen", defaultUnit: "g" },
  { key: "diced-tomatoes", name: "Canned diced tomatoes", category: "Canned goods", defaultUnit: "g" },
  { key: "chili-flakes", name: "Red pepper flakes", category: "Pantry", defaultUnit: "g" },
  { key: "allspice", name: "Ground allspice", category: "Pantry", defaultUnit: "g" },
  { key: "fresh-tomatoes", name: "Fresh tomatoes", category: "Produce", defaultUnit: "g" },
  { key: "butter-lettuce", name: "Butter lettuce", category: "Produce", defaultUnit: "each" },
  { key: "sweet-chili-sauce", name: "Sweet chili sauce", category: "Pantry", defaultUnit: "ml" },
  { key: "breadcrumbs", name: "Breadcrumbs", category: "Dry goods", defaultUnit: "g" },
  { key: "cornstarch", name: "Cornstarch", category: "Pantry", defaultUnit: "g" },
  { key: "curry-powder", name: "Curry powder", category: "Pantry", defaultUnit: "g" },
  { key: "dashi", name: "Dashi stock", category: "Canned goods", defaultUnit: "ml" },
  { key: "mirin", name: "Mirin", category: "Pantry", defaultUnit: "ml" },
  { key: "dill", name: "Fresh dill", category: "Produce", defaultUnit: "g" },
  { key: "peas", name: "Frozen peas", category: "Frozen", defaultUnit: "g" },
  { key: "turmeric", name: "Ground turmeric", category: "Pantry", defaultUnit: "g" },
  { key: "garam-masala", name: "Garam masala", category: "Pantry", defaultUnit: "g" },
  { key: "chili-powder", name: "Chili powder", category: "Pantry", defaultUnit: "g" },
  { key: "cilantro", name: "Fresh cilantro", category: "Produce", defaultUnit: "g" },
  { key: "sesame-seeds", name: "Sesame seeds", category: "Pantry", defaultUnit: "g" },
  { key: "beef-strips", name: "Beef stir-fry strips", category: "Meat & seafood", defaultUnit: "g" },
  { key: "roasted-peppers", name: "Jarred roasted peppers", category: "Canned goods", defaultUnit: "g" },
  { key: "oyster-sauce", name: "Oyster sauce", category: "Pantry", defaultUnit: "ml" },
  { key: "salsa-verde", name: "Salsa verde", category: "Pantry", defaultUnit: "g" },
  { key: "green-chiles", name: "Canned green chiles", category: "Canned goods", defaultUnit: "g" },
  { key: "bbq-sauce", name: "Barbecue sauce", category: "Pantry", defaultUnit: "g" },
  { key: "mint", name: "Fresh mint", category: "Produce", defaultUnit: "g" },
  { key: "heavy-cream", name: "Heavy cream", category: "Dairy", defaultUnit: "ml" },
  { key: "corn", name: "Corn kernels", category: "Frozen", defaultUnit: "g" },
  { key: "jalapeno", name: "Jalapeño", category: "Produce", defaultUnit: "each" },
  { key: "ground-coriander", name: "Ground coriander", category: "Pantry", defaultUnit: "g" },
  { key: "cod", name: "Cod fillets", category: "Meat & seafood", defaultUnit: "g" },
];

const legacyRecipes: CatalogRecipe[] = [
  ...extraRecipes,
  {
    key: "citrus-roast-chicken", version: 1, title: "Citrus roast chicken & herby yogurt",
    summary: "Crisp potatoes, warm chicken, cool lemon-parsley yogurt.", role: "dinner", baseServings: 2, activeMinutes: 20, totalMinutes: 50,
    tags: [{ dimension: "cuisine", value: "Mediterranean" }, { dimension: "main", value: "chicken" }, { dimension: "technique", value: "roast" }, { dimension: "flavor", value: "bright" }, { dimension: "format", value: "plate" }],
    components: [
      { key: "chicken", name: "Plain roast chicken", yield: { amount: 300, unit: "g" }, reservable: true,
        preparation: "Roast chicken plainly; set aside any lunch portion before adding the lemon yogurt.", storageGuidance: leftoverStorage, storageSourceUrl: storageSource,
        ingredients: [{ key: "chicken-thighs", amount: 400, unit: "g" }, { key: "olive-oil", amount: 10, unit: "ml" }, { key: "salt", amount: 3, unit: "g" }] },
      { key: "potatoes", name: "Crisp potatoes", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Roast until golden and tender.",
        ingredients: [{ key: "potatoes", amount: 500, unit: "g" }, { key: "olive-oil", amount: 10, unit: "ml" }, { key: "paprika", amount: 3, unit: "g" }] },
      { key: "yogurt", name: "Herby yogurt", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Stir together just before serving.",
        ingredients: [{ key: "yogurt", amount: 150, unit: "g" }, { key: "parsley", amount: 15, unit: "g" }, { key: "lemon", amount: 1, unit: "each" }, { key: "garlic", amount: 5, unit: "g" }] },
    ],
    steps: [
      { text: "Heat the oven to 425°F / 220°C. Cut potatoes into small wedges, toss with their oil and paprika, and spread on a baking tray.", componentKey: "potatoes" },
      { text: "Rub chicken with its oil and salt. Roast on a separate tray until a food thermometer reads 165°F / 74°C in the thickest part; allow about 25–35 minutes, checking early.", componentKey: "chicken" },
      { text: "Stir yogurt with chopped parsley, lemon juice, and grated garlic. Set aside any chicken meant for lunch before adding sauce.", componentKey: "yogurt" },
      { text: "Serve the chicken with crisp potatoes and the herby yogurt." },
    ],
  },
  {
    key: "coconut-ginger-tofu", version: 1, title: "Coconut ginger tofu curry",
    summary: "Golden tofu, spinach, and a fragrant coconut sauce over rice.", role: "dinner", baseServings: 2, activeMinutes: 25, totalMinutes: 40,
    tags: [{ dimension: "cuisine", value: "Southeast Asian-inspired" }, { dimension: "main", value: "tofu" }, { dimension: "technique", value: "simmer" }, { dimension: "flavor", value: "warming" }, { dimension: "format", value: "curry" }],
    components: [
      { key: "tofu", name: "Golden tofu", yield: { amount: 300, unit: "g" }, reservable: true,
        preparation: "Brown the tofu before it meets the curry. Reserve any lunch portion while it is plain.", storageGuidance: leftoverStorage, storageSourceUrl: storageSource,
        ingredients: [{ key: "tofu", amount: 400, unit: "g" }, { key: "olive-oil", amount: 10, unit: "ml" }] },
      { key: "curry", name: "Coconut spinach sauce", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Simmer until the onions soften.",
        ingredients: [{ key: "coconut-milk", amount: 400, unit: "ml" }, { key: "curry-paste", amount: 35, unit: "g" }, { key: "spinach", amount: 120, unit: "g" }, { key: "ginger", amount: 15, unit: "g" }, { key: "onion", amount: 1, unit: "each" }] },
      { key: "rice", name: "Steamed rice", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Cook according to the package.",
        ingredients: [{ key: "rice", amount: 180, unit: "g" }] },
    ],
    steps: [
      { text: "Start the rice according to the package directions.", componentKey: "rice" },
      { text: "Pat tofu dry, cube it, and brown it in oil in a wide skillet. Set aside any plain tofu intended for lunch.", componentKey: "tofu" },
      { text: "In the same skillet, soften sliced onion and grated ginger. Stir in curry paste, then coconut milk. Simmer 10 minutes; fold in spinach until wilted.", componentKey: "curry" },
      { text: "Return the dinner tofu to the sauce and serve over rice." },
    ],
  },
  {
    key: "tomato-white-bean-pasta", version: 1, title: "Tomato white bean pasta",
    summary: "A silky tomato sauce with greens and satisfying white beans.", role: "dinner", baseServings: 2, activeMinutes: 20, totalMinutes: 35,
    tags: [{ dimension: "cuisine", value: "Italian-inspired" }, { dimension: "main", value: "white beans" }, { dimension: "technique", value: "simmer" }, { dimension: "flavor", value: "savory" }, { dimension: "format", value: "pasta" }],
    components: [
      { key: "beans", name: "Plain white beans", yield: { amount: 300, unit: "g" }, reservable: true,
        preparation: "Drain and rinse. Keep any lunch portion separate before adding the beans to the tomato sauce.", storageGuidance: leftoverStorage, storageSourceUrl: storageSource,
        ingredients: [{ key: "white-beans", amount: 300, unit: "g" }] },
      { key: "pasta", name: "Tomato spinach pasta", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Toss the pasta and sauce just before serving.",
        ingredients: [{ key: "pasta", amount: 200, unit: "g" }, { key: "tomatoes", amount: 400, unit: "g" }, { key: "spinach", amount: 100, unit: "g" }, { key: "garlic", amount: 10, unit: "g" }, { key: "olive-oil", amount: 15, unit: "ml" }, { key: "feta", amount: 60, unit: "g" }] },
    ],
    steps: [
      { text: "Bring salted water to a boil and cook pasta according to the package. Save a mug of cooking water.", componentKey: "pasta" },
      { text: "Drain and rinse the beans. Measure out any portion intended for the lunch pitas before mixing dinner beans into sauce.", componentKey: "beans" },
      { text: "Warm garlic in olive oil, add tomatoes, and simmer 12 minutes. Add spinach until wilted; fold in dinner beans.", componentKey: "pasta" },
      { text: "Toss pasta with sauce and a splash of cooking water. Crumble feta over the top." },
    ],
  },
  {
    key: "smoky-chickpea-tacos", version: 1, title: "Smoky chickpea tacos",
    summary: "Crisp spiced chickpeas, lime yogurt, and crunchy greens.", role: "dinner", baseServings: 2, activeMinutes: 25, totalMinutes: 35,
    tags: [{ dimension: "cuisine", value: "Mexican-inspired" }, { dimension: "main", value: "chickpeas" }, { dimension: "technique", value: "sear" }, { dimension: "flavor", value: "smoky" }, { dimension: "format", value: "tacos" }],
    components: [{ key: "tacos", name: "Chickpea tacos", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Serve the spiced chickpeas in warm tortillas with cool toppings.",
      ingredients: [{ key: "chickpeas", amount: 400, unit: "g" }, { key: "tortillas", amount: 6, unit: "each" }, { key: "red-onion", amount: 1, unit: "each" }, { key: "yogurt", amount: 120, unit: "g" }, { key: "spinach", amount: 80, unit: "g" }, { key: "lime", amount: 1, unit: "each" }, { key: "paprika", amount: 5, unit: "g" }, { key: "cumin", amount: 3, unit: "g" }, { key: "olive-oil", amount: 10, unit: "ml" }] }],
    steps: [
      { text: "Pat chickpeas dry. Sear in olive oil with paprika and cumin until their edges are crisp, about 10 minutes." },
      { text: "Thinly slice red onion and spinach. Stir yogurt with lime juice." },
      { text: "Warm tortillas in a dry skillet. Fill with chickpeas and greens; finish with onion and lime yogurt." },
    ],
  },
  {
    key: "miso-mushroom-udon", version: 1, title: "Miso mushroom udon",
    summary: "Springy noodles in savory broth with mushrooms and greens.", role: "dinner", baseServings: 2, activeMinutes: 20, totalMinutes: 30,
    tags: [{ dimension: "cuisine", value: "Japanese-inspired" }, { dimension: "main", value: "mushrooms" }, { dimension: "technique", value: "simmer" }, { dimension: "flavor", value: "umami" }, { dimension: "format", value: "noodles" }],
    components: [{ key: "udon", name: "Miso mushroom udon", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Serve the noodles as soon as they are cooked.",
      ingredients: [{ key: "mushrooms", amount: 300, unit: "g" }, { key: "udon", amount: 400, unit: "g" }, { key: "miso", amount: 40, unit: "g" }, { key: "broth", amount: 600, unit: "ml" }, { key: "spinach", amount: 100, unit: "g" }, { key: "scallions", amount: 3, unit: "each" }, { key: "sesame-oil", amount: 10, unit: "ml" }, { key: "soy", amount: 20, unit: "ml" }] }],
    steps: [
      { text: "Slice mushrooms and scallions. Sear mushrooms in sesame oil until browned." },
      { text: "Add broth and soy sauce; simmer 5 minutes. Whisk miso with some warm broth in a bowl, then stir it back into the pot." },
      { text: "Add udon and cook according to the package. Stir in spinach until wilted. Serve with scallions." },
    ],
  },
  {
    key: "salmon-rice-bowls", version: 1, title: "Sesame salmon rice bowls",
    summary: "Roasted salmon, rice, crisp cucumber, and tangy sesame dressing.", role: "dinner", baseServings: 2, activeMinutes: 20, totalMinutes: 40,
    tags: [{ dimension: "cuisine", value: "Japanese-inspired" }, { dimension: "main", value: "salmon" }, { dimension: "technique", value: "roast" }, { dimension: "flavor", value: "tangy" }, { dimension: "format", value: "bowl" }],
    components: [{ key: "bowls", name: "Salmon rice bowls", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Assemble bowls once the salmon and rice are cooked.",
      ingredients: [{ key: "salmon", amount: 400, unit: "g" }, { key: "rice", amount: 180, unit: "g" }, { key: "cucumber", amount: 1, unit: "each" }, { key: "soy", amount: 20, unit: "ml" }, { key: "rice-vinegar", amount: 20, unit: "ml" }, { key: "sesame-oil", amount: 5, unit: "ml" }, { key: "scallions", amount: 2, unit: "each" }] }],
    steps: [
      { text: "Cook rice according to the package. Heat the oven to 400°F / 205°C." },
      { text: "Roast salmon until a thermometer reads 145°F / 63°C in the thickest part; begin checking after 12 minutes." },
      { text: "Slice cucumber and scallions. Whisk soy sauce, rice vinegar, and sesame oil. Serve the salmon over rice with vegetables and dressing." },
    ],
  },
  {
    key: "beef-broccoli-skillet", version: 1, title: "Ginger beef & broccoli skillet",
    summary: "Savory ground beef and crisp broccoli over rice.", role: "dinner", baseServings: 2, activeMinutes: 25, totalMinutes: 40,
    tags: [{ dimension: "cuisine", value: "East Asian-inspired" }, { dimension: "main", value: "beef" }, { dimension: "technique", value: "stir-fry" }, { dimension: "flavor", value: "savory" }, { dimension: "format", value: "bowl" }],
    components: [{ key: "skillet", name: "Beef and broccoli skillet", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Cook the beef fully before adding the sauce.",
      ingredients: [{ key: "ground-beef", amount: 400, unit: "g" }, { key: "broccoli", amount: 350, unit: "g" }, { key: "rice", amount: 180, unit: "g" }, { key: "ginger", amount: 15, unit: "g" }, { key: "garlic", amount: 10, unit: "g" }, { key: "soy", amount: 30, unit: "ml" }, { key: "honey", amount: 30, unit: "g" }, { key: "sesame-oil", amount: 10, unit: "ml" }, { key: "scallions", amount: 2, unit: "each" }] }],
    steps: [
      { text: "Cook rice according to the package. Cut broccoli into small florets and slice scallions." },
      { text: "Brown ground beef in a wide skillet until it reaches 160°F / 71°C. Drain excess fat if needed." },
      { text: "Add broccoli, ginger, garlic, and sesame oil; cook until broccoli is tender-crisp. Stir in soy sauce and honey." },
      { text: "Serve over rice and scatter scallions on top." },
    ],
  },
  {
    key: "tomato-lentil-bake", version: 1, title: "Tomato lentil bake with feta",
    summary: "Tender lentils and zucchini under salty feta and fresh parsley.", role: "dinner", baseServings: 2, activeMinutes: 20, totalMinutes: 55,
    tags: [{ dimension: "cuisine", value: "Mediterranean-inspired" }, { dimension: "main", value: "lentils" }, { dimension: "technique", value: "bake" }, { dimension: "flavor", value: "warm spice" }, { dimension: "format", value: "bake" }],
    components: [{ key: "bake", name: "Tomato lentil bake", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Simmer lentils until tender before briefly baking with feta.",
      ingredients: [{ key: "lentils", amount: 180, unit: "g" }, { key: "tomatoes", amount: 400, unit: "g" }, { key: "broth", amount: 500, unit: "ml" }, { key: "zucchini", amount: 1, unit: "each" }, { key: "red-onion", amount: 1, unit: "each" }, { key: "feta", amount: 120, unit: "g" }, { key: "lemon", amount: 1, unit: "each" }, { key: "olive-oil", amount: 15, unit: "ml" }, { key: "cumin", amount: 4, unit: "g" }, { key: "parsley", amount: 15, unit: "g" }] }],
    steps: [
      { text: "Heat the oven to 425°F / 220°C. Dice zucchini and red onion; sauté in olive oil with cumin until softened." },
      { text: "Add lentils, tomatoes, and broth. Simmer until lentils are tender, about 25–35 minutes; add water if the pan gets dry." },
      { text: "Transfer to an ovenproof dish if needed. Crumble feta over the top and bake 8 minutes. Finish with lemon and parsley." },
    ],
  },
  {
    key: "chickpea-shakshuka", version: 1, title: "Chickpea shakshuka with feta",
    summary: "Tomato-braised peppers and chickpeas with eggs and warm pita.", role: "dinner", baseServings: 2, activeMinutes: 25, totalMinutes: 40,
    tags: [{ dimension: "cuisine", value: "North African-inspired" }, { dimension: "main", value: "eggs" }, { dimension: "technique", value: "braise" }, { dimension: "flavor", value: "warm spice" }, { dimension: "format", value: "skillet" }],
    components: [{ key: "skillet", name: "Chickpea shakshuka", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Simmer the vegetables, then cook the eggs in the sauce.",
      ingredients: [{ key: "eggs", amount: 4, unit: "each" }, { key: "chickpeas", amount: 200, unit: "g" }, { key: "tomatoes", amount: 400, unit: "g" }, { key: "bell-pepper", amount: 1, unit: "each" }, { key: "onion", amount: 1, unit: "each" }, { key: "feta", amount: 60, unit: "g" }, { key: "pitas", amount: 2, unit: "each" }, { key: "olive-oil", amount: 15, unit: "ml" }, { key: "paprika", amount: 4, unit: "g" }, { key: "cumin", amount: 3, unit: "g" }] }],
    steps: [
      { text: "Dice the onion and pepper. Soften in olive oil with paprika and cumin in a wide, lidded skillet." },
      { text: "Add crushed tomatoes and drained chickpeas. Simmer 12 minutes until thickened." },
      { text: "Make four wells and add the eggs. Cover and cook until the yolks and whites are firm; heat egg dishes to 160°F / 71°C if checking with a thermometer." },
      { text: "Crumble feta over the skillet and serve with warmed pita." },
    ],
  },
  {
    key: "thai-basil-pork", version: 1, title: "Basil pork & pepper rice bowls",
    summary: "Quick savory ground pork, sweet pepper, and fresh basil over rice.", role: "dinner", baseServings: 2, activeMinutes: 25, totalMinutes: 40,
    tags: [{ dimension: "cuisine", value: "Thai-inspired" }, { dimension: "main", value: "pork" }, { dimension: "technique", value: "stir-fry" }, { dimension: "flavor", value: "herby-savory" }, { dimension: "format", value: "bowl" }],
    components: [{ key: "bowls", name: "Basil pork rice bowls", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Stir-fry the pork and vegetables while rice cooks.",
      ingredients: [{ key: "ground-pork", amount: 400, unit: "g" }, { key: "rice", amount: 180, unit: "g" }, { key: "bell-pepper", amount: 1, unit: "each" }, { key: "onion", amount: 1, unit: "each" }, { key: "basil", amount: 30, unit: "g" }, { key: "garlic", amount: 10, unit: "g" }, { key: "soy", amount: 30, unit: "ml" }, { key: "fish-sauce", amount: 15, unit: "ml" }, { key: "lime", amount: 1, unit: "each" }, { key: "olive-oil", amount: 10, unit: "ml" }] }],
    steps: [
      { text: "Cook rice according to the package. Slice pepper and onion; chop the garlic." },
      { text: "Brown ground pork in olive oil, breaking it up, until it reaches 160°F / 71°C. Add pepper, onion, and garlic; stir-fry until tender." },
      { text: "Stir in soy sauce and fish sauce. Take off the heat and fold in basil. Serve over rice with lime." },
    ],
  },
  {
    key: "gochujang-shrimp-udon", version: 1, title: "Gochujang shrimp & cabbage udon",
    summary: "Glossy spicy noodles with quick-cooked shrimp and sweet cabbage.", role: "dinner", baseServings: 2, activeMinutes: 25, totalMinutes: 35,
    tags: [{ dimension: "cuisine", value: "Korean-inspired" }, { dimension: "main", value: "shrimp" }, { dimension: "technique", value: "stir-fry" }, { dimension: "flavor", value: "spicy-sweet" }, { dimension: "format", value: "noodles" }],
    components: [{ key: "noodles", name: "Shrimp udon", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Cook shrimp just until opaque; toss noodles with vegetables and sauce.",
      ingredients: [{ key: "shrimp", amount: 400, unit: "g" }, { key: "cabbage", amount: 300, unit: "g" }, { key: "udon", amount: 400, unit: "g" }, { key: "gochujang", amount: 30, unit: "g" }, { key: "soy", amount: 20, unit: "ml" }, { key: "rice-vinegar", amount: 20, unit: "ml" }, { key: "sesame-oil", amount: 10, unit: "ml" }, { key: "garlic", amount: 10, unit: "g" }, { key: "scallions", amount: 2, unit: "each" }] }],
    steps: [
      { text: "Cook udon according to the package. Shred cabbage, chop garlic, and slice scallions." },
      { text: "Whisk gochujang, soy sauce, rice vinegar, and a splash of noodle water." },
      { text: "Sear shrimp in sesame oil until pearly or white and opaque; remove from the pan. Stir-fry cabbage and garlic until tender-crisp." },
      { text: "Toss noodles with cabbage and sauce. Return shrimp to the pan just to heat through; finish with scallions." },
    ],
  },
  {
    key: "sweet-potato-enchiladas", version: 1, title: "Sweet potato & black bean enchiladas",
    summary: "Roasted sweet potato, black beans, tomato sauce, and lime yogurt.", role: "dinner", baseServings: 2, activeMinutes: 30, totalMinutes: 55,
    tags: [{ dimension: "cuisine", value: "Mexican-inspired" }, { dimension: "main", value: "black beans" }, { dimension: "technique", value: "bake" }, { dimension: "flavor", value: "smoky" }, { dimension: "format", value: "enchiladas" }],
    components: [
      { key: "sweet-potato", name: "Plain roasted sweet potato", yield: { amount: 400, unit: "g" }, reservable: true,
        preparation: "Roast sweet potato simply. Reserve a plain portion before mixing the dinner filling.", storageGuidance: leftoverStorage, storageSourceUrl: storageSource,
        ingredients: [{ key: "sweet-potatoes", amount: 500, unit: "g" }, { key: "olive-oil", amount: 10, unit: "ml" }] },
      { key: "enchiladas", name: "Black bean enchiladas", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Fill tortillas with dinner sweet potato and beans; bake until hot throughout.",
        ingredients: [{ key: "black-beans", amount: 300, unit: "g" }, { key: "tortillas", amount: 4, unit: "each" }, { key: "tomatoes", amount: 400, unit: "g" }, { key: "cheddar", amount: 120, unit: "g" }, { key: "onion", amount: 1, unit: "each" }, { key: "paprika", amount: 4, unit: "g" }, { key: "cumin", amount: 3, unit: "g" }] },
      { key: "yogurt", name: "Lime yogurt", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Stir together while the enchiladas bake.",
        ingredients: [{ key: "yogurt", amount: 100, unit: "g" }, { key: "lime", amount: 1, unit: "each" }] },
    ],
    steps: [
      { text: "Heat oven to 425°F / 220°C. Cube sweet potato, toss with olive oil, and roast about 25 minutes until tender. Reserve any plain sweet potato intended for lunch.", componentKey: "sweet-potato" },
      { text: "Soften diced onion in a skillet with smoked paprika and cumin. Add crushed tomatoes; simmer 8 minutes. Drain the black beans.", componentKey: "enchiladas" },
      { text: "Fill tortillas with dinner sweet potato, black beans, and a spoon of sauce. Roll into a baking dish, cover with remaining sauce and cheddar, and bake until the center reaches 165°F / 74°C." },
      { text: "Mix yogurt with lime juice. Spoon over the enchiladas when serving.", componentKey: "yogurt" },
    ],
  },
  {
    key: "chicken-bean-quesadillas", version: 1, title: "Smoky chicken & black bean quesadillas",
    summary: "A crisp, cheesy lunch from the extra plain roast chicken.", role: "lunch", baseServings: 2, activeMinutes: 20, totalMinutes: 20,
    tags: [{ dimension: "cuisine", value: "Mexican-inspired" }, { dimension: "main", value: "chicken" }, { dimension: "technique", value: "sear" }, { dimension: "flavor", value: "smoky" }, { dimension: "format", value: "quesadilla" }],
    components: [{ key: "assembly", name: "Quesadilla additions", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Combine the reheated chicken with new ingredients.",
      ingredients: [{ key: "tortillas", amount: 4, unit: "each" }, { key: "black-beans", amount: 200, unit: "g" }, { key: "cheddar", amount: 100, unit: "g" }, { key: "red-onion", amount: 1, unit: "each" }, { key: "lime", amount: 1, unit: "each" }, { key: "paprika", amount: 3, unit: "g" }] }],
    steps: [
      { text: "Shred the reserved cooked chicken. Reheat it thoroughly to 165°F / 74°C, then toss with smoked paprika." },
      { text: "Divide chicken, rinsed black beans, cheddar, and sliced red onion between tortillas. Fold in half." },
      { text: "Cook in a dry skillet until golden on both sides and cheese melts. Serve with lime wedges." },
    ],
  },
  {
    key: "peanut-tofu-wraps", version: 1, title: "Crunchy peanut tofu wraps",
    summary: "Plain curry-night tofu becomes a crisp, tangy wrap.", role: "lunch", baseServings: 2, activeMinutes: 20, totalMinutes: 20,
    tags: [{ dimension: "cuisine", value: "Southeast Asian-inspired" }, { dimension: "main", value: "tofu" }, { dimension: "technique", value: "sear" }, { dimension: "flavor", value: "peanut-lime" }, { dimension: "format", value: "wrap" }],
    components: [{ key: "assembly", name: "Wrap additions", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Re-crisp the tofu before filling the wraps.",
      ingredients: [{ key: "tortillas", amount: 4, unit: "each" }, { key: "cucumber", amount: 1, unit: "each" }, { key: "peanut-butter", amount: 60, unit: "g" }, { key: "soy", amount: 15, unit: "ml" }, { key: "lime", amount: 1, unit: "each" }, { key: "red-onion", amount: 1, unit: "each" }] }],
    steps: [
      { text: "Sear reserved tofu in a dry skillet until hot and crisp at the edges." },
      { text: "Whisk peanut butter with soy sauce, lime juice, and enough water to make a spoonable sauce." },
      { text: "Fill tortillas with tofu, sliced cucumber and red onion, and peanut sauce." },
    ],
  },
  {
    key: "white-bean-cucumber-pitas", version: 1, title: "Crispy white bean & cucumber pitas",
    summary: "Warm crisp beans and cool cucumber replace last night's pasta.", role: "lunch", baseServings: 2, activeMinutes: 20, totalMinutes: 20,
    tags: [{ dimension: "cuisine", value: "Mediterranean-inspired" }, { dimension: "main", value: "white beans" }, { dimension: "technique", value: "sear" }, { dimension: "flavor", value: "lemon-herb" }, { dimension: "format", value: "pita" }],
    components: [{ key: "assembly", name: "Pita additions", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Crisp reserved plain beans before filling the pitas.",
      ingredients: [{ key: "pitas", amount: 2, unit: "each" }, { key: "cucumber", amount: 1, unit: "each" }, { key: "yogurt", amount: 100, unit: "g" }, { key: "lemon", amount: 1, unit: "each" }, { key: "parsley", amount: 15, unit: "g" }, { key: "olive-oil", amount: 10, unit: "ml" }] }],
    steps: [
      { text: "Pat reserved white beans dry and crisp them in olive oil in a skillet." },
      { text: "Dice cucumber and parsley; mix yogurt with lemon juice." },
      { text: "Fill warm pitas with beans, cucumber, herbs, and lemon yogurt." },
    ],
  },
  {
    key: "sweet-potato-egg-hash", version: 1, title: "Sweet potato & egg skillet hash",
    summary: "Yesterday's plain sweet potato becomes a crisp skillet lunch with greens and eggs.", role: "lunch", baseServings: 2, activeMinutes: 20, totalMinutes: 25,
    tags: [{ dimension: "cuisine", value: "American-inspired" }, { dimension: "main", value: "eggs" }, { dimension: "technique", value: "sear" }, { dimension: "flavor", value: "savory" }, { dimension: "format", value: "hash" }],
    components: [{ key: "assembly", name: "Hash additions", yield: { amount: 2, unit: "portion" }, reservable: false, preparation: "Re-crisp reserved sweet potato, then cook the eggs and greens in the same skillet.",
      ingredients: [{ key: "eggs", amount: 4, unit: "each" }, { key: "spinach", amount: 100, unit: "g" }, { key: "scallions", amount: 2, unit: "each" }, { key: "olive-oil", amount: 10, unit: "ml" }, { key: "paprika", amount: 2, unit: "g" }, { key: "yogurt", amount: 80, unit: "g" }] }],
    steps: [
      { text: "Heat olive oil in a skillet. Add reserved cooked sweet potato and smoked paprika; cook until the edges crisp." },
      { text: "Add spinach until wilted. Make four spaces, add the eggs, and cook until yolks and whites are firm; heat egg dishes to 160°F / 71°C if checking with a thermometer." },
      { text: "Finish with sliced scallions and a spoon of cool yogurt." },
    ],
  },
];

export const recipes: CatalogRecipe[] = [...sourcedRecipes, ...additionalSourcedRecipes, ...replaceLegacyRecipes(legacyRecipes, ingredients)];

export const transformations: CatalogTransformation[] = [
  ...extraTransformations,
  { key: "chicken-to-quesadillas", sourceRecipeKey: "citrus-roast-chicken", sourceComponentKey: "chicken", targetRecipeKey: "chicken-bean-quesadillas", targetComponentKey: "assembly", required: { amount: 200, unit: "g" },
    description: "Reserve cooked chicken before adding yogurt, then make crisp barbecue quesadillas for lunch.", compatibleState: "Cooked chicken without yogurt", storageGuidance: leftoverStorage, storageSourceUrl: storageSource },
  { key: "tofu-to-wraps", sourceRecipeKey: "coconut-ginger-tofu", sourceComponentKey: "tofu", targetRecipeKey: "peanut-tofu-wraps", targetComponentKey: "assembly", required: { amount: 200, unit: "g" },
    description: "Reserve golden tofu before it goes into curry, then add crunch and peanut-lime sauce for lunch.", compatibleState: "Cooked tofu before curry sauce", storageGuidance: leftoverStorage, storageSourceUrl: storageSource },
  { key: "beans-to-pitas", sourceRecipeKey: "tomato-white-bean-pasta", sourceComponentKey: "beans", targetRecipeKey: "white-bean-cucumber-pitas", targetComponentKey: "assembly", required: { amount: 200, unit: "g" },
    description: "Save plain beans before saucing the pasta, then mash them for cool cucumber pitas.", compatibleState: "Drained, unsauced white beans", storageGuidance: leftoverStorage, storageSourceUrl: storageSource },
  { key: "sweet-potato-to-hash", sourceRecipeKey: "sweet-potato-enchiladas", sourceComponentKey: "sweet-potato", targetRecipeKey: "sweet-potato-egg-hash", targetComponentKey: "assembly", required: { amount: 200, unit: "g" },
    description: "Save plain sweet potato before filling enchiladas, then crisp it with eggs and greens for lunch.", compatibleState: "Cooked, plain sweet potato", storageGuidance: leftoverStorage, storageSourceUrl: storageSource },
];
