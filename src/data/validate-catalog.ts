import { assertCompatible, type Quantity } from "../domain/meals/quantity";
import { ingredients, recipes, transformations, type CatalogAmount } from "./catalog";

export function asMilli(amount: CatalogAmount): Quantity {
  const milli = Math.round(amount.amount * 1000);
  if (!Number.isSafeInteger(milli) || milli <= 0 || Math.abs(milli / 1000 - amount.amount) > 0.000001) {
    throw new Error(`Invalid catalog quantity: ${amount.amount} ${amount.unit}.`);
  }
  return { milli, unit: amount.unit };
}

export function validateCatalog(): void {
  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.key, ingredient]));
  if (ingredientMap.size !== ingredients.length) throw new Error("Duplicate ingredient key.");
  const recipeMap = new Map(recipes.map((recipe) => [recipe.key, recipe]));
  if (recipeMap.size !== recipes.length) throw new Error("Duplicate recipe key.");
  const transformationKeys = new Set<string>();

  for (const ingredient of ingredients) {
    if (!ingredient.name.trim() || !ingredient.category.trim()) throw new Error(`Incomplete ingredient: ${ingredient.key}`);
  }

  for (const recipe of recipes) {
    if (!recipe.title.trim() || !recipe.summary.trim() || recipe.baseServings <= 0 || recipe.activeMinutes <= 0 || recipe.totalMinutes < recipe.activeMinutes) {
      throw new Error(`Incomplete recipe metadata: ${recipe.key}`);
    }
    if (recipe.sourceUrl && (!recipe.sourceAttribution || !/^https:\/\//.test(recipe.sourceUrl))) throw new Error(`Invalid source attribution: ${recipe.key}`);
    if (recipe.role === "dinner" && recipe.totalMinutes > 60) throw new Error(`Dinner exceeds the default time limit: ${recipe.key}`);
    if (recipe.components.length === 0 || recipe.steps.length === 0 || recipe.tags.length < 3) throw new Error(`Incomplete recipe: ${recipe.key}`);
    const components = new Map(recipe.components.map((component) => [component.key, component]));
    if (components.size !== recipe.components.length) throw new Error(`Duplicate component in ${recipe.key}`);

    for (const component of recipe.components) {
      asMilli(component.yield);
      if (!component.name.trim() || !component.preparation.trim() || component.ingredients.length === 0) throw new Error(`Incomplete component: ${recipe.key}/${component.key}`);
      if (component.reservable && (!component.storageGuidance || !component.storageSourceUrl)) throw new Error(`Missing storage guidance for ${recipe.key}/${component.key}`);
      const usedIngredients = new Set<string>();
      for (const item of component.ingredients) {
        const ingredient = ingredientMap.get(item.key);
        if (!ingredient) throw new Error(`Unknown ingredient: ${recipe.key}/${item.key}`);
        if (usedIngredients.has(item.key)) throw new Error(`Duplicate ingredient in ${recipe.key}/${component.key}: ${item.key}`);
        usedIngredients.add(item.key);
        assertCompatible(asMilli(item), { milli: 1000, unit: ingredient.defaultUnit });
      }
    }

    for (const step of recipe.steps) {
      if (!step.text.trim() || (step.componentKey && !components.has(step.componentKey))) throw new Error(`Invalid step in ${recipe.key}`);
    }
  }

  for (const transformation of transformations) {
    if (transformationKeys.has(transformation.key)) throw new Error(`Duplicate transformation: ${transformation.key}`);
    transformationKeys.add(transformation.key);
    const source = recipeMap.get(transformation.sourceRecipeKey);
    const target = recipeMap.get(transformation.targetRecipeKey);
    if (!source || source.role !== "dinner" || !target || target.role !== "lunch") throw new Error(`Invalid recipe pairing: ${transformation.key}`);
    const sourceComponent = source.components.find((component) => component.key === transformation.sourceComponentKey);
    const targetComponent = target.components.find((component) => component.key === transformation.targetComponentKey);
    if (!sourceComponent?.reservable || !targetComponent) throw new Error(`Invalid components for ${transformation.key}`);
    assertCompatible(asMilli(sourceComponent.yield), asMilli(transformation.required));
    if (sourceComponent.yield.unit !== transformation.required.unit) throw new Error(`Transformation must use the source component unit: ${transformation.key}`);
    if (!transformation.description.trim() || !transformation.compatibleState.trim() || !transformation.storageGuidance || !transformation.storageSourceUrl) {
      throw new Error(`Incomplete transformation: ${transformation.key}`);
    }
  }
}
