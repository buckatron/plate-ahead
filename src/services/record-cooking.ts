import "server-only";

import { randomUUID } from "node:crypto";
import { hasLeftoverShortfall, parseConfirmedQuantity } from "@/domain/meals/cooking";
import { prisma } from "@/services/prisma";

export class CookingError extends Error {}

export async function recordCooking(input: { householdId: string; planId: string; slotId: string;
  expectedRevision: number; requestId: string; servingsServed: number;
  amounts: Array<{ componentId: string; rawAmount: string }> }): Promise<{ alreadyRecorded: boolean; lunchNeedsAttention: boolean }> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 ||
    !Number.isSafeInteger(input.servingsServed) || input.servingsServed < 1 || input.servingsServed > 99) {
    throw new CookingError("Check the servings and refresh this week before trying again.");
  }
  const actualByComponent = new Map<string, number>();
  for (const amount of input.amounts) {
    if (actualByComponent.has(amount.componentId)) throw new CookingError("A reusable component was entered twice.");
    try { actualByComponent.set(amount.componentId, parseConfirmedQuantity(amount.rawAmount)); }
    catch (cause) { throw new CookingError(cause instanceof Error ? cause.message : "Check the saved amount."); }
  }
  return prisma.$transaction(async (tx) => {
    const priorRequest = await tx.cookingEvent.findUnique({ where: { householdId_requestId: {
      householdId: input.householdId, requestId: input.requestId } }, include: { batches: true,
      slot: { include: { components: { include: { recipeComponent: true } } } } } });
    if (priorRequest) {
      const saved = new Map(priorRequest.batches.map((batch) => [batch.recipeComponentId, batch.quantityMilli]));
      const reusableIds = priorRequest.slot.components.filter((component) => component.recipeComponent.reservable)
        .map((component) => component.recipeComponentId);
      if (priorRequest.slotId !== input.slotId || priorRequest.slot.planId !== input.planId ||
        priorRequest.servingsServed !== input.servingsServed || actualByComponent.size !== reusableIds.length ||
        reusableIds.some((id) => !actualByComponent.has(id)) ||
        [...actualByComponent].some(([id, amount]) => (saved.get(id) ?? 0) !== amount) ||
        [...saved.keys()].some((id) => !actualByComponent.has(id))) {
        throw new CookingError("This cooking confirmation was already used with different details.");
      }
      const attentionCount = await tx.planSlot.count({ where: { planId: input.planId, status: "needs_attention",
        incomingAllocations: { some: { sourceComponent: { slotId: input.slotId } } } } });
      return { alreadyRecorded: true, lunchNeedsAttention: attentionCount > 0 };
    }
    const plan = await tx.mealPlan.findFirst({ where: { id: input.planId, householdId: input.householdId },
      select: { id: true, state: true, revision: true } });
    if (!plan || plan.state !== "active") throw new CookingError("Accept this week before recording a cooked dinner.");
    if (plan.revision !== input.expectedRevision) throw new CookingError("This week changed in another tab. Refresh before recording dinner.");
    const slot = await tx.planSlot.findFirst({ where: { id: input.slotId, planId: plan.id }, include: {
      components: { include: { recipeComponent: true, outgoingAllocations: true } },
    } });
    if (!slot || slot.mealKind !== "dinner" || slot.slotType !== "cook" || !slot.recipeId || slot.status !== "planned") {
      throw new CookingError("This dinner has already been recorded or is no longer planned.");
    }
    if (!slot.components.length) throw new CookingError("This dinner has no planned components.");
    const reusable = slot.components.filter((component) => component.recipeComponent.reservable);
    if (actualByComponent.size !== reusable.length || reusable.some((component) => !actualByComponent.has(component.recipeComponentId))) {
      throw new CookingError("Refresh this dinner to confirm every reusable component.");
    }
    const revised = await tx.mealPlan.updateMany({ where: { id: plan.id, householdId: input.householdId,
      state: "active", revision: input.expectedRevision }, data: { revision: { increment: 1 } } });
    if (revised.count !== 1) throw new CookingError("This week changed in another tab. Refresh before recording dinner.");
    const event = await tx.cookingEvent.create({ data: { id: randomUUID(), householdId: input.householdId,
      slotId: slot.id, recipeId: slot.recipeId, requestId: input.requestId, servingsServed: input.servingsServed } });
    const batches = reusable.flatMap((component) => {
      const quantityMilli = actualByComponent.get(component.recipeComponentId)!;
      return quantityMilli > 0 ? [{ cookingEventId: event.id, recipeComponentId: component.recipeComponentId,
        quantityMilli, unit: component.unit }] : [];
    });
    if (batches.length) await tx.leftoverBatch.createMany({ data: batches });
    const shortLunchIds = new Set<string>();
    for (const component of reusable) {
      const actual = actualByComponent.get(component.recipeComponentId)!;
      const reserved = component.outgoingAllocations.reduce((total, allocation) => total + allocation.reservedMilli, 0);
      if (hasLeftoverShortfall(actual, reserved)) {
        for (const allocation of component.outgoingAllocations) shortLunchIds.add(allocation.destinationSlotId);
      } else if (component.outgoingAllocations.length) {
        await tx.componentAllocation.updateMany({ where: { sourceComponentId: component.id }, data: { state: "fulfilled" } });
      }
    }
    if (shortLunchIds.size) await tx.planSlot.updateMany({ where: { id: { in: [...shortLunchIds] }, planId: plan.id,
      mealKind: "lunch", status: "planned" }, data: { status: "needs_attention",
      reason: "Less reusable food was saved than planned. Cancel this lunch or supply the missing food separately." } });
    await tx.planSlot.update({ where: { id: slot.id }, data: { status: "cooked", locked: false } });
    return { alreadyRecorded: false, lunchNeedsAttention: shortLunchIds.size > 0 };
  });
}
