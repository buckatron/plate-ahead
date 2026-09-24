import "server-only";

import { rankSwapOptions } from "@/domain/planning/swap-options";
import type { DinnerCandidate } from "@/domain/planning/generate-week";
import { householdSettingsSchema } from "@/schemas/household";
import { prisma } from "@/services/prisma";

export async function getSwapShortlist(householdId: string, planId: string, slotId: string) {
  const plan = await prisma.mealPlan.findFirst({ where: { id: planId, householdId }, include: {
    slots: { include: { recipe: { include: { tags: true, components: { include: {
      ingredients: { include: { ingredient: true } }, sourceTransformations: { include: { inputs: true } },
    } } } }, incomingAllocations: { include: { sourceComponent: true } } } },
  } });
  if (!plan) return null;
  const slot = plan.slots.find((item) => item.id === slotId && item.mealKind === "dinner" && item.slotType === "cook" && item.recipe);
  if (!slot?.recipe) return null;
  const settings = householdSettingsSchema.parse(JSON.parse(plan.settingsJson) as unknown);
  const allRecipes = await prisma.recipe.findMany({ where: { reviewStatus: "reviewed" }, include: {
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
  const linkedLunch = plan.slots.find((item) => item.mealKind === "lunch" && item.incomingAllocations.some((allocation) =>
    allocation.sourceComponent.slotId === slotId));
  return { plan: { id: plan.id, state: plan.state, revision: plan.revision },
    slot: { id: slot.id, localDate: slot.localDate, title: slot.recipe.title, locked: slot.locked },
    linkedLunch: linkedLunch?.recipe?.title ?? null,
    options: rankSwapOptions({ current, otherDinners, candidates: dinners.map(candidateFromRecipe), settings,
      hasLinkedLunch: Boolean(linkedLunch), otherLunchKeys: plan.slots.filter((item) =>
        item.mealKind === "lunch" && item.id !== linkedLunch?.id && item.recipe).map((item) => item.recipe!.recipeKey) }) };
}
