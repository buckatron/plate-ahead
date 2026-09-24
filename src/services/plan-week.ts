import "server-only";

import { randomUUID } from "node:crypto";
import { addDays, generateWeek, nextPlanningMonday, PlanningError, type DinnerCandidate } from "@/domain/planning/generate-week";
import { validatePlanDraft, type PlanSlotDraft } from "@/domain/planning/plan";
import type { ComponentUse } from "@/domain/meals/allocations";
import { scaleQuantity, unitSchema } from "@/domain/meals/quantity";
import { findHousehold } from "@/repositories/households";
import { prisma } from "@/services/prisma";

export async function createGeneratedWeek(householdId: string, now = new Date()): Promise<string> {
  const household = await findHousehold(householdId);
  if (!household) throw new PlanningError("Set up your kitchen before generating a week.");
  const weekStart = nextPlanningMonday(now, household.timezone);
  const previous = await prisma.mealPlan.findFirst({
    where: { householdId, weekStart }, orderBy: { generationIndex: "desc" },
    include: { slots: { include: { recipe: true } } },
  });
  const generationIndex = (previous?.generationIndex ?? -1) + 1;
  const allRecipes = await prisma.recipe.findMany({
    where: { reviewStatus: "reviewed" },
    include: { tags: true, components: { include: { ingredients: { include: { ingredient: true } }, sourceTransformations: { include: { inputs: true } } } } },
    orderBy: [{ recipeKey: "asc" }, { version: "desc" }],
  });
  const currentRecipes = [...new Map([...allRecipes].reverse().map((recipe) => [recipe.recipeKey, recipe])).values()];
  const lunchByKey = new Map(currentRecipes.filter((recipe) => recipe.role === "lunch").map((recipe) => [recipe.recipeKey, recipe]));
  const householdItems = await prisma.householdIngredient.findMany({ where: { householdId } });
  const itemByIngredient = new Map(householdItems.map((item) => [item.ingredientId, item]));
  const dinnerRecipes = currentRecipes.filter((recipe) => recipe.role === "dinner");
  const candidateById = new Map(dinnerRecipes.map((recipe) => [recipe.id, recipe]));
  const candidates: DinnerCandidate[] = dinnerRecipes.map((recipe) => ({
    id: recipe.id, key: recipe.recipeKey, title: recipe.title, totalMinutes: recipe.totalMinutes,
    tags: Object.fromEntries([...new Set(recipe.tags.map((tag) => tag.dimension))].map((dimension) => [dimension, recipe.tags.filter((tag) => tag.dimension === dimension).map((tag) => tag.value)])),
    ingredients: [...new Map(recipe.components.flatMap((component) => component.ingredients).map((item) => [item.ingredientId, {
      id: item.ingredientId, name: item.ingredient.name,
      isStaple: itemByIngredient.get(item.ingredientId)?.isStaple ?? item.ingredient.groceryCategory === "Pantry",
      useFirst: itemByIngredient.get(item.ingredientId)?.useFirst ?? false,
    }])).values()],
    lunchOptions: recipe.components.flatMap((component) => component.sourceTransformations).flatMap((transformation) => {
      const lunch = lunchByKey.get(transformation.targetRecipeKey);
      if (!lunch || transformation.inputs.length !== 1 || !lunch.components.some((component) => component.id === transformation.inputs[0].targetComponentId)) return [];
      const source = recipe.components.find((component) => component.id === transformation.sourceComponentId);
      if (!source?.reservable || source.yieldUnit !== transformation.inputs[0].unit) return [];
      return [{ transformationId: transformation.id, lunchRecipeId: lunch.id, lunchKey: lunch.recipeKey, lunchTitle: lunch.title }];
    }),
  }));
  const week = generateWeek({ weekStart, settings: household.settings, candidates,
    recentKeys: previous?.slots.flatMap((slot) => slot.mealKind === "dinner" && slot.recipe ? [slot.recipe.recipeKey] : []) ?? [],
    generationIndex });
  const planId = randomUUID();
  const slots: Array<PlanSlotDraft & { reason?: string }> = [];
  const components: ComponentUse[] = [];
  const plannedComponents: Array<{ id: string; slotId: string; recipeComponentId: string; preparationMilli: number; plannedYieldMilli: number; mealUseMilli: number; unit: string }> = [];
  const allocations: Array<{ id: string; sourceComponentId: string; destinationSlotId: string; transformationId: string; reservedMilli: number; unit: string }> = [];

  for (const dinner of week.dinners) {
    const recipe = candidateById.get(dinner.recipe.id)!;
    const dinnerSlotId = randomUUID();
    slots.push({ id: dinnerSlotId, planId, householdId, localDate: dinner.date, mealKind: "dinner", slotType: "cook", recipeId: recipe.id, servings: household.settings.servings, reason: dinner.reason });
    let lunchSlotId: string | undefined;
    let transformation: typeof recipe.components[number]["sourceTransformations"][number] | undefined;
    const lunchRecipe = dinner.lunch ? lunchByKey.get(dinner.lunch.lunchKey) : undefined;
    if (dinner.lunch) {
      lunchSlotId = randomUUID();
      transformation = recipe.components.flatMap((component) => component.sourceTransformations).find((item) => item.id === dinner.lunch!.transformationId);
      if (!transformation || !lunchRecipe) throw new PlanningError("A lunch transformation changed while building the plan. Please try again.");
      slots.push({ id: lunchSlotId, planId, householdId, localDate: addDays(dinner.date, 1), mealKind: "lunch", slotType: "transformed_lunch", recipeId: lunchRecipe.id, servings: household.settings.servings });
    }

    for (const component of recipe.components) {
      const unit = unitSchema.parse(component.yieldUnit);
      const dinnerUse = scaleQuantity({ milli: component.baseYieldMilli, unit }, household.settings.servings, recipe.baseServings);
      const input = transformation?.sourceComponentId === component.id ? transformation.inputs[0] : undefined;
      const reservedMilli = input && lunchRecipe ? scaleQuantity({ milli: input.requiredMilli, unit: unitSchema.parse(input.unit) }, household.settings.servings, lunchRecipe.baseServings).milli : 0;
      const plannedYieldMilli = dinnerUse.milli + reservedMilli;
      const plannedId = randomUUID();
      plannedComponents.push({ id: plannedId, slotId: dinnerSlotId, recipeComponentId: component.id,
        preparationMilli: Math.ceil(plannedYieldMilli * 1000 / component.baseYieldMilli), plannedYieldMilli, mealUseMilli: dinnerUse.milli, unit });
      components.push({ slotId: dinnerSlotId, sourceDate: dinner.date, reservable: component.reservable,
        yield: { milli: plannedYieldMilli, unit }, dinnerUse,
        allocations: reservedMilli && lunchSlotId ? [{ sourceSlotId: dinnerSlotId, destinationSlotId: lunchSlotId,
          destinationKind: "lunch", destinationDate: addDays(dinner.date, 1), quantity: { milli: reservedMilli, unit } }] : [] });
      if (reservedMilli && lunchSlotId && transformation) allocations.push({ id: randomUUID(), sourceComponentId: plannedId,
        destinationSlotId: lunchSlotId, transformationId: transformation.id, reservedMilli, unit });
    }
    if (lunchSlotId && lunchRecipe) {
      for (const component of lunchRecipe.components) {
        const unit = unitSchema.parse(component.yieldUnit);
        const mealUseMilli = scaleQuantity({ milli: component.baseYieldMilli, unit }, household.settings.servings, lunchRecipe.baseServings).milli;
        plannedComponents.push({ id: randomUUID(), slotId: lunchSlotId, recipeComponentId: component.id,
          preparationMilli: Math.ceil(mealUseMilli * 1000 / component.baseYieldMilli), plannedYieldMilli: mealUseMilli, mealUseMilli, unit });
      }
    }
  }
  for (const date of week.flexibleDates) slots.push({ id: randomUUID(), planId, householdId, localDate: date, mealKind: "dinner", slotType: "flexible", recipeId: null, servings: null });
  slots.push({ id: randomUUID(), planId, householdId, localDate: week.eatOutDate, mealKind: "dinner", slotType: "eat_out", recipeId: null, servings: null });
  validatePlanDraft({ householdId, planId, slots, components });

  await prisma.$transaction(async (tx) => {
    await tx.mealPlan.create({ data: { id: planId, householdId, weekStart, settingsJson: JSON.stringify(household.settings), generationIndex } });
    await tx.planSlot.createMany({ data: slots.map((slot) => ({ id: slot.id, planId: slot.planId,
      localDate: slot.localDate, mealKind: slot.mealKind, slotType: slot.slotType, recipeId: slot.recipeId,
      servings: slot.servings, reason: slot.reason })) });
    await tx.plannedComponent.createMany({ data: plannedComponents });
    await tx.componentAllocation.createMany({ data: allocations });
  });
  return planId;
}
