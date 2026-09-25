import "server-only";

import { randomUUID } from "node:crypto";
import { addDays, generateWeek, nextPlanningMonday, PlanningError, type DinnerCandidate } from "@/domain/planning/generate-week";
import { validatePlanDraft, type PlanSlotDraft } from "@/domain/planning/plan";
import type { ComponentUse } from "@/domain/meals/allocations";
import { scaleQuantity, unitSchema } from "@/domain/meals/quantity";
import { findHousehold } from "@/repositories/households";
import { prisma } from "@/services/prisma";
import { getCookingSignals } from "@/services/cooking-history";

export async function createGeneratedWeek(householdId: string, now = new Date(), source?: {
  planId: string; expectedRevision: number;
}): Promise<string> {
  const household = await findHousehold(householdId);
  if (!household) throw new PlanningError("Set up your kitchen before generating a week.");
  const weekStart = nextPlanningMonday(now, household.timezone);
  const signals = await getCookingSignals(householdId, new Date(`${weekStart}T12:00:00Z`));
  const previous = await prisma.mealPlan.findFirst({
    where: { householdId, weekStart }, orderBy: { generationIndex: "desc" },
    include: { slots: { include: { recipe: true } } },
  });
  const sourcePlan = source ? await prisma.mealPlan.findFirst({
    where: { id: source.planId, householdId, weekStart, state: { in: ["draft", "active"] } },
    include: { slots: { include: { incomingAllocations: { include: { sourceComponent: true } } } } },
  }) : null;
  if (source && (!sourcePlan || sourcePlan.revision !== source.expectedRevision)) {
    throw new PlanningError("This plan changed. Refresh it before generating another draft.");
  }
  const generationIndex = (previous?.generationIndex ?? -1) + 1;
  const allRecipes = await prisma.recipe.findMany({
    where: { reviewStatus: "reviewed" },
    include: { tags: true, components: { include: { ingredients: { include: { ingredient: true } }, sourceTransformations: { include: { inputs: true } } } } },
    orderBy: [{ recipeKey: "asc" }, { version: "desc" }],
  });
  const currentRecipes = [...new Map([...allRecipes].reverse().map((recipe) => [recipe.recipeKey, recipe])).values()];
  const lunchRecipes = allRecipes.filter((recipe) => recipe.role === "lunch");
  const lunchById = new Map(lunchRecipes.map((recipe) => [recipe.id, recipe]));
  const lunchByInputComponent = new Map(lunchRecipes.flatMap((recipe) => recipe.components.map((component) => [component.id, recipe] as const)));
  const householdItems = await prisma.householdIngredient.findMany({ where: { householdId } });
  const itemByIngredient = new Map(householdItems.map((item) => [item.ingredientId, item]));
  const dinnerRecipes = currentRecipes.filter((recipe) => recipe.role === "dinner");
  const lockedSlots = sourcePlan?.slots.filter((slot) => slot.locked) ?? [];
  const lockedRecipeRows = lockedSlots.flatMap((slot) => {
    if (slot.mealKind !== "dinner" || slot.slotType !== "cook" || slot.status !== "planned" || !slot.recipeId) {
      throw new PlanningError("A kept slot is no longer a planned dinner. Unlock it before regenerating.");
    }
    const recipe = allRecipes.find((item) => item.id === slot.recipeId && item.role === "dinner");
    if (!recipe) throw new PlanningError("A kept dinner recipe is no longer available. Unlock it before regenerating.");
    return [recipe];
  });
  const candidateById = new Map([...dinnerRecipes, ...lockedRecipeRows].map((recipe) => [recipe.id, recipe]));
  const candidateFromRecipe = (recipe: typeof dinnerRecipes[number]): DinnerCandidate => ({
    id: recipe.id, key: recipe.recipeKey, title: recipe.title, totalMinutes: recipe.totalMinutes,
    tags: Object.fromEntries([...new Set(recipe.tags.map((tag) => tag.dimension))].map((dimension) => [dimension, recipe.tags.filter((tag) => tag.dimension === dimension).map((tag) => tag.value)])),
    ingredients: [...new Map(recipe.components.flatMap((component) => component.ingredients).map((item) => [item.ingredientId, {
      id: item.ingredientId, name: item.ingredient.name,
      isStaple: itemByIngredient.get(item.ingredientId)?.isStaple ?? item.ingredient.groceryCategory === "Pantry",
      useFirst: itemByIngredient.get(item.ingredientId)?.useFirst ?? false,
    }])).values()],
    lunchOptions: recipe.components.flatMap((component) => component.sourceTransformations).flatMap((transformation) => {
      if (transformation.inputs.length !== 1) return [];
      const lunch = lunchByInputComponent.get(transformation.inputs[0].targetComponentId);
      if (!lunch || lunch.recipeKey !== transformation.targetRecipeKey) return [];
      const source = recipe.components.find((component) => component.id === transformation.sourceComponentId);
      if (!source?.reservable || source.yieldUnit !== transformation.inputs[0].unit) return [];
      return [{ transformationId: transformation.id, lunchRecipeId: lunch.id, lunchKey: lunch.recipeKey, lunchTitle: lunch.title }];
    }),
  });
  const candidates = dinnerRecipes.map(candidateFromRecipe);
  const lockedDinners = lockedSlots.map((slot) => {
    const recipe = candidateById.get(slot.recipeId!);
    if (!recipe) throw new PlanningError("A kept dinner recipe is no longer available.");
    const candidate = candidateFromRecipe(recipe);
    const linkedLunches = sourcePlan!.slots.filter((lunch) => lunch.mealKind === "lunch" && lunch.status === "planned" &&
      lunch.incomingAllocations.some((allocation) => allocation.sourceComponent.slotId === slot.id));
    if (linkedLunches.length > 1) throw new PlanningError("A kept dinner has multiple linked lunches and cannot be regenerated safely.");
    const linkedLunch = linkedLunches[0];
    const allocation = linkedLunch?.incomingAllocations.find((item) => item.sourceComponent.slotId === slot.id);
    const lunch = allocation ? candidate.lunchOptions.find((option) => option.transformationId === allocation.transformationId &&
      option.lunchRecipeId === linkedLunch.recipeId) : undefined;
    if (allocation && !lunch) throw new PlanningError("A kept dinner has an unavailable lunch pairing. Unlock it before regenerating.");
    return { date: slot.localDate, recipe: candidate, lunch };
  });
  const week = generateWeek({ weekStart, settings: household.settings, candidates,
    signals,
    recentKeys: previous?.slots.flatMap((slot) => slot.mealKind === "dinner" && slot.recipe ? [slot.recipe.recipeKey] : []) ?? [],
    generationIndex, lockedDinners });
  const planId = randomUUID();
  const slots: Array<PlanSlotDraft & { reason?: string; locked?: boolean }> = [];
  const components: ComponentUse[] = [];
  const plannedComponents: Array<{ id: string; slotId: string; recipeComponentId: string; preparationMilli: number; plannedYieldMilli: number; mealUseMilli: number; unit: string }> = [];
  const allocations: Array<{ id: string; sourceComponentId: string; destinationSlotId: string; transformationId: string; reservedMilli: number; unit: string }> = [];

  for (const dinner of week.dinners) {
    const recipe = candidateById.get(dinner.recipe.id)!;
    const dinnerSlotId = randomUUID();
    slots.push({ id: dinnerSlotId, planId, householdId, localDate: dinner.date, mealKind: "dinner", slotType: "cook", recipeId: recipe.id,
      servings: household.settings.servings, reason: dinner.reason, locked: dinner.locked });
    let lunchSlotId: string | undefined;
    let transformation: typeof recipe.components[number]["sourceTransformations"][number] | undefined;
    const lunchRecipe = dinner.lunch ? lunchById.get(dinner.lunch.lunchRecipeId) : undefined;
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
    if (source) {
      const fresh = await tx.mealPlan.findFirst({ where: { id: source.planId, householdId, weekStart,
        state: { in: ["draft", "active"] } }, select: { revision: true } });
      if (!fresh || fresh.revision !== source.expectedRevision) {
        throw new PlanningError("This plan changed. Refresh it before generating another draft.");
      }
    }
    await tx.mealPlan.create({ data: { id: planId, householdId, weekStart, settingsJson: JSON.stringify(household.settings), generationIndex } });
    await tx.planSlot.createMany({ data: slots.map((slot) => ({ id: slot.id, planId: slot.planId,
      localDate: slot.localDate, mealKind: slot.mealKind, slotType: slot.slotType, recipeId: slot.recipeId,
      servings: slot.servings, reason: slot.reason, locked: slot.locked ?? false })) });
    await tx.plannedComponent.createMany({ data: plannedComponents });
    await tx.componentAllocation.createMany({ data: allocations });
  });
  return planId;
}
