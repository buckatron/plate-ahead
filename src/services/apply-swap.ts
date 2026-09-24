import "server-only";

import { randomUUID } from "node:crypto";
import { addDays } from "@/domain/planning/generate-week";
import { validateComponentUse } from "@/domain/meals/allocations";
import { scaleQuantity, unitSchema } from "@/domain/meals/quantity";
import { getSwapShortlist } from "@/services/swap-options";
import { prisma } from "@/services/prisma";

export class PlanSwapError extends Error {}

export async function applySwap(input: {
  householdId: string; planId: string; slotId: string; recipeId: string; expectedRevision: number;
}): Promise<{ cancelledLunch: boolean }> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new PlanSwapError("Refresh this week before swapping a dinner.");
  }
  const shortlist = await getSwapShortlist(input.householdId, input.planId, input.slotId);
  if (!shortlist || !["draft", "active"].includes(shortlist.plan.state)) {
    throw new PlanSwapError("This dinner is no longer available for swapping.");
  }
  if (shortlist.plan.revision !== input.expectedRevision) {
    throw new PlanSwapError("This week changed in another tab. Refresh the alternatives before swapping.");
  }
  const option = shortlist.options.find((item) => item.recipe.id === input.recipeId);
  if (!option) throw new PlanSwapError("That alternative is no longer available. Refresh the shortlist.");
  if (shortlist.slot.locked || shortlist.linkedLunch?.locked) {
    throw new PlanSwapError("Unlock this dinner or its linked lunch before swapping.");
  }

  return prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.findFirst({ where: { id: input.planId, householdId: input.householdId },
      include: { slots: { include: { components: { include: { outgoingAllocations: true } },
        incomingAllocations: { include: { sourceComponent: true } } } } } });
    if (!plan || !["draft", "active"].includes(plan.state) || plan.revision !== input.expectedRevision) {
      throw new PlanSwapError("This week changed in another tab. Refresh the alternatives before swapping.");
    }
    const dinner = plan.slots.find((slot) => slot.id === input.slotId && slot.mealKind === "dinner" &&
      slot.slotType === "cook" && slot.status === "planned" && slot.recipeId);
    if (!dinner || dinner.locked || !dinner.servings) throw new PlanSwapError("This dinner can no longer be swapped.");
    const destinationIds = new Set(dinner.components.flatMap((component) =>
      component.outgoingAllocations.map((allocation) => allocation.destinationSlotId)));
    if (destinationIds.size > 1) throw new PlanSwapError("This dinner has multiple linked lunches and needs a fresh plan.");
    const linkedLunch = plan.slots.find((slot) => destinationIds.has(slot.id));
    if (Boolean(linkedLunch) !== Boolean(shortlist.linkedLunch) ||
      (linkedLunch && (linkedLunch.mealKind !== "lunch" || linkedLunch.status !== "planned" || linkedLunch.locked ||
        !linkedLunch.servings || linkedLunch.localDate !== addDays(dinner.localDate, 1) ||
        linkedLunch.incomingAllocations.some((allocation) => allocation.sourceComponent.slotId !== dinner.id)))) {
      throw new PlanSwapError("The linked lunch changed. Refresh the alternatives before swapping.");
    }
    const recipe = await tx.recipe.findFirst({ where: { id: option.recipe.id, role: "dinner", reviewStatus: "reviewed" },
      include: { components: true } });
    if (!recipe || recipe.recipeKey !== option.recipe.key) throw new PlanSwapError("This recipe is no longer available.");
    const lunchRecipe = linkedLunch && option.lunch
      ? await tx.recipe.findFirst({ where: { id: option.lunch.lunchRecipeId, role: "lunch", reviewStatus: "reviewed" },
        include: { components: true } }) : null;
    const transformation = linkedLunch && option.lunch
      ? await tx.transformation.findUnique({ where: { id: option.lunch.transformationId },
        include: { inputs: true, sourceComponent: true } }) : null;
    if (linkedLunch && option.lunch) {
      if (!lunchRecipe || !transformation || lunchRecipe.recipeKey !== option.lunch.lunchKey ||
        transformation.targetRecipeKey !== lunchRecipe.recipeKey ||
        transformation.sourceComponent.recipeId !== recipe.id || !transformation.sourceComponent.reservable ||
        transformation.inputs.length !== 1 ||
        !lunchRecipe.components.some((component) => component.id === transformation!.inputs[0].targetComponentId) ||
        transformation.sourceComponent.yieldUnit !== transformation.inputs[0].unit) {
        throw new PlanSwapError("This lunch pairing is no longer available. Refresh the alternatives.");
      }
    }
    const revised = await tx.mealPlan.updateMany({ where: { id: plan.id, householdId: input.householdId,
      revision: input.expectedRevision, state: { in: ["draft", "active"] } }, data: { revision: { increment: 1 } } });
    if (revised.count !== 1) throw new PlanSwapError("This week changed in another tab. Refresh the alternatives before swapping.");

    const affectedSlotIds = [dinner.id, ...(linkedLunch ? [linkedLunch.id] : [])];
    await tx.plannedComponent.deleteMany({ where: { slotId: { in: affectedSlotIds } } });
    await tx.planSlot.update({ where: { id: dinner.id }, data: { recipeId: recipe.id, reason: option.reason } });
    if (linkedLunch) {
      await tx.planSlot.update({ where: { id: linkedLunch.id }, data: option.lunch && lunchRecipe
        ? { recipeId: lunchRecipe.id, status: "planned", reason: null }
        : { recipeId: null, servings: null, status: "cancelled", reason: "Cancelled because its source dinner was swapped." } });
    }

    const plannedComponents: Array<{ id: string; slotId: string; recipeComponentId: string;
      preparationMilli: number; plannedYieldMilli: number; mealUseMilli: number; unit: string }> = [];
    let allocation: { id: string; sourceComponentId: string; destinationSlotId: string;
      transformationId: string; reservedMilli: number; unit: string } | null = null;
    for (const component of recipe.components) {
      const unit = unitSchema.parse(component.yieldUnit);
      const dinnerUse = scaleQuantity({ milli: component.baseYieldMilli, unit }, dinner.servings, recipe.baseServings);
      const inputItem = transformation?.sourceComponentId === component.id ? transformation.inputs[0] : null;
      const reservedMilli = inputItem && lunchRecipe && linkedLunch?.servings
        ? scaleQuantity({ milli: inputItem.requiredMilli, unit: unitSchema.parse(inputItem.unit) },
          linkedLunch.servings, lunchRecipe.baseServings).milli : 0;
      const plannedYieldMilli = dinnerUse.milli + reservedMilli;
      if (!Number.isSafeInteger(plannedYieldMilli)) throw new PlanSwapError("The replacement quantity is too large.");
      const id = randomUUID();
      plannedComponents.push({ id, slotId: dinner.id, recipeComponentId: component.id,
        preparationMilli: Math.ceil(plannedYieldMilli * 1000 / component.baseYieldMilli),
        plannedYieldMilli, mealUseMilli: dinnerUse.milli, unit });
      validateComponentUse({ slotId: dinner.id, sourceDate: dinner.localDate, reservable: component.reservable,
        yield: { milli: plannedYieldMilli, unit }, dinnerUse,
        allocations: reservedMilli && linkedLunch ? [{ sourceSlotId: dinner.id, destinationSlotId: linkedLunch.id,
          destinationKind: "lunch", destinationDate: linkedLunch.localDate,
          quantity: { milli: reservedMilli, unit } }] : [] });
      if (reservedMilli && linkedLunch && transformation) allocation = { id: randomUUID(), sourceComponentId: id,
        destinationSlotId: linkedLunch.id, transformationId: transformation.id, reservedMilli, unit };
    }
    if (linkedLunch && lunchRecipe && option.lunch) {
      for (const component of lunchRecipe.components) {
        const unit = unitSchema.parse(component.yieldUnit);
        const mealUseMilli = scaleQuantity({ milli: component.baseYieldMilli, unit },
          linkedLunch.servings!, lunchRecipe.baseServings).milli;
        plannedComponents.push({ id: randomUUID(), slotId: linkedLunch.id, recipeComponentId: component.id,
          preparationMilli: Math.ceil(mealUseMilli * 1000 / component.baseYieldMilli),
          plannedYieldMilli: mealUseMilli, mealUseMilli, unit });
      }
      if (!allocation) throw new PlanSwapError("The replacement lunch has no reserved food.");
    }
    await tx.plannedComponent.createMany({ data: plannedComponents });
    if (allocation) await tx.componentAllocation.create({ data: allocation });
    return { cancelledLunch: Boolean(linkedLunch && !option.lunch) };
  });
}
