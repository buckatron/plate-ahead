import "server-only";

import { randomUUID } from "node:crypto";
import { remainingBatchQuantity } from "@/domain/meals/leftover-stock";
import { prisma } from "@/services/prisma";

export class LunchConsumptionError extends Error {}

export async function consumeLunch(input: { householdId: string; planId: string; slotId: string;
  expectedRevision: number; requestId: string }): Promise<{ alreadyRecorded: boolean }> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new LunchConsumptionError("Refresh this week before recording lunch.");
  }
  return prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.findFirst({ where: { id: input.planId, householdId: input.householdId },
      select: { id: true, state: true, revision: true } });
    if (!plan) throw new LunchConsumptionError("This week is no longer available.");
    const lunch = await tx.planSlot.findFirst({ where: { id: input.slotId, planId: plan.id }, include: {
      incomingAllocations: { include: { sourceComponent: { include: { slot: true } } } },
    } });
    if (!lunch || lunch.mealKind !== "lunch" || lunch.slotType !== "transformed_lunch") {
      throw new LunchConsumptionError("This is not a linked lunch.");
    }
    if (lunch.status === "eaten") {
      if (lunch.consumptionRequestId !== input.requestId) throw new LunchConsumptionError("This lunch was already recorded as eaten.");
      return { alreadyRecorded: true };
    }
    if (plan.state !== "active" || plan.revision !== input.expectedRevision) {
      throw new LunchConsumptionError("This week changed in another tab. Refresh before recording lunch.");
    }
    if (lunch.status !== "planned" || !lunch.recipeId || !lunch.servings || !lunch.incomingAllocations.length) {
      throw new LunchConsumptionError("This lunch needs attention or is no longer planned.");
    }
    const requiredByBatch = new Map<string, { quantityMilli: number; unit: string; remainingMilli: number }>();
    for (const allocation of lunch.incomingAllocations) {
      const source = allocation.sourceComponent;
      if (source.slot.planId !== plan.id || source.slot.status !== "cooked" ||
        source.slot.mealKind !== "dinner" || allocation.reservedMilli <= 0 || allocation.unit !== source.unit) {
        throw new LunchConsumptionError("Cook and confirm the source dinner before recording this lunch.");
      }
      const batch = await tx.leftoverBatch.findFirst({ where: { recipeComponentId: source.recipeComponentId,
        cookingEvent: { slotId: source.slotId, householdId: input.householdId } }, include: { movements: true } });
      if (!batch || batch.unit !== allocation.unit) throw new LunchConsumptionError("No confirmed batch is available for this lunch.");
      if (batch.location !== "fridge") throw new LunchConsumptionError("Thaw the saved food before marking this lunch eaten.");
      const remainingMilli = remainingBatchQuantity(batch.quantityMilli, batch.movements);
      const current = requiredByBatch.get(batch.id);
      const quantityMilli = (current?.quantityMilli ?? 0) + allocation.reservedMilli;
      if (!Number.isSafeInteger(quantityMilli)) throw new LunchConsumptionError("The lunch quantity is too large.");
      requiredByBatch.set(batch.id, { quantityMilli, unit: allocation.unit, remainingMilli });
    }
    if ([...requiredByBatch.values()].some((item) => item.quantityMilli > item.remainingMilli)) {
      throw new LunchConsumptionError("Not enough confirmed leftovers remain. Cancel this lunch or use another source.");
    }
    const revised = await tx.mealPlan.updateMany({ where: { id: plan.id, householdId: input.householdId,
      state: "active", revision: input.expectedRevision }, data: { revision: { increment: 1 } } });
    if (revised.count !== 1) throw new LunchConsumptionError("This week changed in another tab. Refresh before recording lunch.");
    await tx.leftoverMovement.createMany({ data: [...requiredByBatch].map(([batchId, item]) => ({
      id: randomUUID(), batchId, destinationSlotId: lunch.id, requestId: input.requestId,
      type: "consume", quantityMilli: item.quantityMilli,
    })) });
    await tx.componentAllocation.updateMany({ where: { destinationSlotId: lunch.id }, data: { state: "consumed" } });
    await tx.planSlot.update({ where: { id: lunch.id }, data: { status: "eaten",
      consumptionRequestId: input.requestId, reason: null } });
    return { alreadyRecorded: false };
  });
}
