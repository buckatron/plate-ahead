import { scaleQuantity, toBaseQuantity, unitSchema, type Quantity, type Unit } from "./quantity";

export interface GroceryComponent {
  slotId: string;
  localDate: string;
  mealKind: "dinner" | "lunch";
  recipeTitle: string;
  baseYield: Quantity;
  plannedYield: Quantity;
  ingredients: Array<{
    ingredientId: string;
    name: string;
    category: string;
    quantity: Quantity | null;
    optional: boolean;
  }>;
}

export interface GroceryContribution {
  slotId: string;
  localDate: string;
  mealKind: "dinner" | "lunch";
  recipeTitle: string;
  quantity: Quantity;
}

export interface GroceryNeed {
  key: string;
  ingredientId: string;
  name: string;
  category: string;
  quantity: Quantity;
  contributions: GroceryContribution[];
}

const baseUnit: Record<string, Unit> = { mass: "g", volume: "ml", count: "each", portion: "portion" };

export function aggregateGroceryNeeds(components: GroceryComponent[]): GroceryNeed[] {
  const needs = new Map<string, GroceryNeed>();

  for (const component of components) {
    const baseYield = toBaseQuantity(component.baseYield);
    const plannedYield = toBaseQuantity(component.plannedYield);
    if (baseYield.group !== plannedYield.group || baseYield.milli <= 0 || plannedYield.milli <= 0) {
      throw new Error("A planned component has an invalid yield.");
    }

    for (const ingredient of component.ingredients) {
      if (ingredient.optional) continue;
      if (ingredient.quantity === null) continue;
      const scaled = scaleQuantity(ingredient.quantity, plannedYield.milli, baseYield.milli);
      const normalized = toBaseQuantity(scaled);
      const unit = unitSchema.parse(baseUnit[normalized.group]);
      const key = `${ingredient.ingredientId}:${normalized.group}`;
      let need = needs.get(key);
      if (!need) {
        need = { key, ingredientId: ingredient.ingredientId, name: ingredient.name,
          category: ingredient.category, quantity: { milli: 0, unit }, contributions: [] };
        needs.set(key, need);
      }
      const nextMilli = need.quantity.milli + normalized.milli;
      if (!Number.isSafeInteger(nextMilli)) throw new Error("Grocery quantity exceeds supported precision.");
      need.quantity.milli = nextMilli;
      const existingContribution = need.contributions.find((item) => item.slotId === component.slotId);
      if (existingContribution) {
        const nextContributionMilli = existingContribution.quantity.milli + normalized.milli;
        if (!Number.isSafeInteger(nextContributionMilli)) throw new Error("Grocery contribution exceeds supported precision.");
        existingContribution.quantity.milli = nextContributionMilli;
      } else {
        need.contributions.push({ slotId: component.slotId, localDate: component.localDate,
          mealKind: component.mealKind, recipeTitle: component.recipeTitle,
          quantity: { milli: normalized.milli, unit } });
      }
    }
  }

  return [...needs.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function unmeasuredGroceryNeeds(components: GroceryComponent[]) {
  const rows = new Map<string, { ingredientId: string; name: string; category: string; meals: string[] }>();
  for (const component of components) for (const ingredient of component.ingredients) {
    if (ingredient.optional || ingredient.quantity !== null) continue;
    const row = rows.get(ingredient.ingredientId) ?? { ingredientId: ingredient.ingredientId,
      name: ingredient.name, category: ingredient.category, meals: [] };
    if (!row.meals.includes(component.recipeTitle)) row.meals.push(component.recipeTitle);
    rows.set(ingredient.ingredientId, row);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
