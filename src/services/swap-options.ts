import "server-only";

import { rankSwapOptions } from "@/domain/planning/swap-options";
import { previewSwapGroceries } from "@/domain/planning/swap-preview";
import type { DinnerCandidate } from "@/domain/planning/generate-week";
import type { GroceryComponent } from "@/domain/meals/groceries";
import { scaleQuantity, unitSchema } from "@/domain/meals/quantity";
import { householdSettingsSchema } from "@/schemas/household";
import { prisma } from "@/services/prisma";
import { getCookingSignals } from "@/services/cooking-history";
import { recipeVisibility } from "@/repositories/recipe-visibility";

export async function getSwapShortlist(householdId: string, planId: string, slotId: string) {
  const plan = await prisma.mealPlan.findFirst({ where: { id: planId, householdId }, include: {
    slots: { include: { recipe: { include: { tags: true, components: { include: {
      ingredients: { include: { ingredient: true } }, sourceTransformations: { include: { inputs: true } },
    } } } }, components: { include: { recipeComponent: { include: {
      ingredients: { include: { ingredient: true } },
    } } } }, incomingAllocations: { include: { sourceComponent: true } } } },
  } });
  if (!plan) return null;
  const slot = plan.slots.find((item) => item.id === slotId && item.mealKind === "dinner" &&
    item.slotType === "cook" && item.status === "planned" && item.recipe);
  if (!slot?.recipe) return null;
  const signals = await getCookingSignals(householdId, new Date(`${slot.localDate}T12:00:00Z`));
  const settings = householdSettingsSchema.parse(JSON.parse(plan.settingsJson) as unknown);
  const allRecipes = await prisma.recipe.findMany({ where: await recipeVisibility(householdId), include: {
    tags: true, components: { include: { ingredients: { include: { ingredient: true } }, sourceTransformations: { include: { inputs: true } } } },
  }, orderBy: [{ recipeKey: "asc" }, { version: "desc" }] });
  const currentRecipes = [...new Map([...allRecipes].reverse().map((recipe) => [recipe.recipeKey, recipe])).values()];
  const lunches = new Map(currentRecipes.filter((recipe) => recipe.role === "lunch").map((recipe) => [recipe.recipeKey, recipe]));
  const householdItems = await prisma.householdIngredient.findMany({ where: { householdId } });
  const itemByIngredient = new Map(householdItems.map((item) => [item.ingredientId, item]));
  const dinners = currentRecipes.filter((recipe) => recipe.role === "dinner");
  const candidateFromRecipe = (recipe: typeof dinners[number]): DinnerCandidate => ({
    id: recipe.id, key: recipe.recipeKey, title: recipe.title, totalMinutes: recipe.totalMinutes,
    tags: Object.fromEntries([...new Set(recipe.tags.map((tag) => tag.dimension))].map((dimension) =>
      [dimension, recipe.tags.filter((tag) => tag.dimension === dimension).map((tag) => tag.value)])),
    ingredients: [...new Map(recipe.components.flatMap((component) => component.ingredients).map((item) => [item.ingredientId, {
      id: item.ingredientId, name: item.ingredient.name,
      isStaple: itemByIngredient.get(item.ingredientId)?.isStaple ?? item.ingredient.groceryCategory === "Pantry",
      useFirst: itemByIngredient.get(item.ingredientId)?.useFirst ?? false,
    }])).values()],
    lunchOptions: recipe.components.flatMap((component) => component.sourceTransformations).flatMap((transformation) => {
      const lunch = lunches.get(transformation.targetRecipeKey);
      if (!lunch || transformation.inputs.length !== 1 ||
        !lunch.components.some((component) => component.id === transformation.inputs[0].targetComponentId)) return [];
      const source = recipe.components.find((component) => component.id === transformation.sourceComponentId);
      if (!source?.reservable || source.yieldUnit !== transformation.inputs[0].unit) return [];
      return [{ transformationId: transformation.id, lunchRecipeId: lunch.id,
        lunchKey: lunch.recipeKey, lunchTitle: lunch.title }];
    }),
  });
  const current = candidateFromRecipe(slot.recipe);
  const otherDinners = plan.slots.filter((item) => item.id !== slotId && item.mealKind === "dinner" && item.slotType === "cook" && item.recipe)
    .map((item) => candidateFromRecipe(item.recipe!));
  const linkedLunch = plan.slots.find((item) => item.mealKind === "lunch" && item.status === "planned" && item.incomingAllocations.some((allocation) =>
    allocation.sourceComponent.slotId === slotId));
  const existingComponents: GroceryComponent[] = plan.slots.flatMap((plannedSlot) => {
    const plannedRecipe = plannedSlot.recipe;
    if (plannedSlot.status !== "planned" || !plannedRecipe) return [];
    return plannedSlot.components.map((planned) => {
      const source = planned.recipeComponent;
      if (source.recipeId !== plannedSlot.recipeId) throw new Error("A planned component does not match its recipe.");
      return { slotId: plannedSlot.id, localDate: plannedSlot.localDate,
        mealKind: plannedSlot.mealKind === "lunch" ? "lunch" as const : "dinner" as const,
        recipeTitle: plannedRecipe.title,
        baseYield: { milli: source.baseYieldMilli, unit: unitSchema.parse(source.yieldUnit) },
        plannedYield: { milli: planned.plannedYieldMilli, unit: unitSchema.parse(planned.unit) },
        ingredients: source.ingredients.map((item) => ({ ingredientId: item.ingredientId,
          name: item.ingredient.name, category: item.ingredient.groceryCategory,
          quantity: item.quantityMilli === null ? null : { milli: item.quantityMilli, unit: unitSchema.parse(item.unit) }, optional: item.optional })),
      };
    });
  });
  const proposedComponents = (recipe: typeof currentRecipes[number], proposedSlotId: string,
    localDate: string, mealKind: "dinner" | "lunch", servings: number, extraByComponent: Map<string, number> = new Map()): GroceryComponent[] =>
    recipe.components.map((component) => {
      const unit = unitSchema.parse(component.yieldUnit);
      const mealYield = scaleQuantity({ milli: component.baseYieldMilli, unit }, servings, recipe.baseServings);
      return { slotId: proposedSlotId, localDate, mealKind, recipeTitle: recipe.title,
        baseYield: { milli: component.baseYieldMilli, unit },
        plannedYield: { milli: mealYield.milli + (extraByComponent.get(component.id) ?? 0), unit },
        ingredients: component.ingredients.map((item) => ({ ingredientId: item.ingredientId,
          name: item.ingredient.name, category: item.ingredient.groceryCategory,
          quantity: item.quantityMilli === null ? null : { milli: item.quantityMilli, unit: unitSchema.parse(item.unit) }, optional: item.optional })),
      };
    });
  const options = rankSwapOptions({ current, otherDinners, candidates: dinners.map(candidateFromRecipe), settings,
    signals,
    hasLinkedLunch: Boolean(linkedLunch), otherLunchKeys: plan.slots.filter((item) =>
      item.mealKind === "lunch" && item.id !== linkedLunch?.id && item.recipe).map((item) => item.recipe!.recipeKey) });
  const previews = options.map((option) => {
    const recipe = dinners.find((item) => item.id === option.recipe.id)!;
    const replacement: GroceryComponent[] = [];
    const extras = new Map<string, number>();
    let lunchMinutes: number | null = null;
    if (linkedLunch && option.lunch) {
      const transformation = recipe.components.flatMap((component) => component.sourceTransformations)
        .find((item) => item.id === option.lunch!.transformationId);
      const lunchRecipe = lunches.get(option.lunch.lunchKey);
      const input = transformation?.inputs[0];
      if (!transformation || !lunchRecipe || !input || linkedLunch.servings === null) {
        throw new Error("A swap lunch pairing is incomplete.");
      }
      extras.set(transformation.sourceComponentId,
        scaleQuantity({ milli: input.requiredMilli, unit: unitSchema.parse(input.unit) },
          linkedLunch.servings, lunchRecipe.baseServings).milli);
      replacement.push(...proposedComponents(lunchRecipe, linkedLunch.id, linkedLunch.localDate,
        "lunch", linkedLunch.servings));
      lunchMinutes = lunchRecipe.totalMinutes;
    }
    replacement.push(...proposedComponents(recipe, slot.id, slot.localDate, "dinner", slot.servings!, extras));
    return { ...option, dinnerMinutes: recipe.totalMinutes, lunchMinutes,
      groceryChanges: previewSwapGroceries({ current: existingComponents,
        replacedSlotIds: [slot.id, ...(linkedLunch ? [linkedLunch.id] : [])], replacement }) };
  });
  return { plan: { id: plan.id, state: plan.state, revision: plan.revision },
    slot: { id: slot.id, localDate: slot.localDate, title: slot.recipe.title,
      totalMinutes: slot.recipe.totalMinutes, locked: slot.locked },
    linkedLunch: linkedLunch?.recipe ? { title: linkedLunch.recipe.title,
      totalMinutes: linkedLunch.recipe.totalMinutes, locked: linkedLunch.locked } : null,
    options: previews };
}
