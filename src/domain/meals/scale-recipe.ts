import { assertCompatible, scaleQuantity, unitSchema, type Quantity } from "./quantity";

export interface ScalableRecipe {
  baseServings: number;
  components: Array<{
    id: string;
    name: string;
    baseYieldMilli: number;
    yieldUnit: string;
    ingredients: Array<{ id?: string; quantityMilli: number | null; unit: string; ingredient: { name: string } }>;
  }>;
}

export function scaleRecipe(recipe: ScalableRecipe, servings: number, extraByComponent: Record<string, Quantity> = {}) {
  if (!Number.isInteger(servings) || servings < 1 || servings > 12) throw new Error("Servings must be between 1 and 12.");
  if (!Number.isInteger(recipe.baseServings) || recipe.baseServings < 1) throw new Error("Invalid base servings.");

  return recipe.components.map((component) => {
    const unit = unitSchema.parse(component.yieldUnit);
    const baseYield = { milli: component.baseYieldMilli, unit };
    if (baseYield.milli <= 0) throw new Error(`Invalid yield for ${component.name}.`);
    const dinnerYield = scaleQuantity(baseYield, servings, recipe.baseServings);
    const extra = extraByComponent[component.id];
    if (extra) {
      assertCompatible(baseYield, extra);
      if (extra.unit !== unit) throw new Error("The reservation must use the component's yield unit.");
    }
    const totalYieldMilli = dinnerYield.milli + (extra?.milli ?? 0);

    return {
      ...component,
      dinnerYieldMilli: dinnerYield.milli,
      extraYieldMilli: extra?.milli ?? 0,
      totalYieldMilli,
      ingredients: component.ingredients.map((item) => ({
        ...item,
        scaled: item.quantityMilli === null ? null : scaleQuantity({ milli: item.quantityMilli, unit: unitSchema.parse(item.unit) }, totalYieldMilli, baseYield.milli),
      })),
    };
  });
}

export function formatQuantity(quantity: Quantity): string {
  const amount = quantity.milli / 1000;
  const rounded = quantity.unit === "each" || quantity.unit === "portion"
    ? Math.ceil(amount * 4) / 4
    : Math.ceil(amount);
  return `${rounded} ${quantity.unit}`;
}

// Recipe ingredient names already supply the count noun (for example, "eggs").
export function formatIngredientAmount(quantity: Quantity): string {
  return quantity.unit === "each" ? String(Math.ceil(quantity.milli / 250) / 4) : formatQuantity(quantity);
}
