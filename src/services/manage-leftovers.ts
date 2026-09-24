import "server-only";

import { randomUUID } from "node:crypto";
import { parseConfirmedQuantity } from "@/domain/meals/cooking";
import { remainingBatchQuantity } from "@/domain/meals/leftover-stock";
import { prisma } from "@/services/prisma";

export class LeftoverActionError extends Error {}

export async function manageLeftoverBatch(input: { householdId: string; planId: string; batchId: string;
  expectedRevision: number; requestId: string; change: "freeze" | "thaw" | "discard"; rawAmount?: string }): Promise<void> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new LeftoverActionError("Refresh this week before changing leftovers.");
  }
  let quantityMilli = 0;
  if (input.change === "discard") {
    try { quantityMilli = parseConfirmedQuantity(input.rawAmount ?? ""); }
    catch (cause) { throw new LeftoverActionError(cause instanceof Error ? cause.message : "Check the discarded amount."); }
    if (quantityMilli <= 0) throw new LeftoverActionError("Enter a positive amount to discard.");
  }
  await prisma.$transaction(async (tx) => {
    const batch = await tx.leftoverBatch.findFirst({ where: { id: input.batchId,
      cookingEvent: { householdId: input.householdId } }, include: { movements: true,
      cookingEvent: { include: { slot: { include: { plan: true } } } } } });
    const plan = batch?.cookingEvent.slot.plan;
    if (!batch || !plan || plan.id !== input.planId || plan.householdId !== input.householdId) {
      throw new LeftoverActionError("This leftover batch is no longer available.");
    }
    const prior = batch.movements.find((movement) => movement.requestId === input.requestId);
    if (prior) {
      if (prior.type !== input.change || prior.quantityMilli !== quantityMilli || prior.destinationSlotId !== null) {
        throw new LeftoverActionError("This leftover action was already used with different details.");
      }
      return;
    }
    if (!["active", "archived"].includes(plan.state) || plan.revision !== input.expectedRevision) {
      throw new LeftoverActionError("This week changed in another tab. Refresh before changing leftovers.");
    }
    const remaining = remainingBatchQuantity(batch.quantityMilli, batch.movements);
    if (remaining <= 0) throw new LeftoverActionError("No food remains in this batch.");
    if (input.change === "freeze" && batch.location !== "fridge" ||
      input.change === "thaw" && batch.location !== "freezer") {
      throw new LeftoverActionError("The storage location changed. Refresh this batch before trying again.");
    }
    if (input.change === "discard" && quantityMilli > remaining) {
      throw new LeftoverActionError("You cannot discard more than remains in this batch.");
    }
    const revised = await tx.mealPlan.updateMany({ where: { id: plan.id, householdId: input.householdId,
      revision: input.expectedRevision, state: { in: ["active", "archived"] } }, data: { revision: { increment: 1 } } });
    if (revised.count !== 1) throw new LeftoverActionError("This week changed in another tab. Refresh before changing leftovers.");
    await tx.leftoverMovement.create({ data: { id: randomUUID(), batchId: batch.id,
      destinationSlotId: null, requestId: input.requestId, type: input.change, quantityMilli } });
    if (input.change !== "discard") await tx.leftoverBatch.update({ where: { id: batch.id },
      data: { location: input.change === "freeze" ? "freezer" : "fridge" } });
    else {
      const source = await tx.plannedComponent.findFirst({ where: { slotId: batch.cookingEvent.slotId,
        recipeComponentId: batch.recipeComponentId }, include: {
        outgoingAllocations: { include: { destinationSlot: true } },
      } });
      const planned = source?.outgoingAllocations.filter((allocation) => allocation.destinationSlot.status === "planned") ?? [];
      const reserved = planned.reduce((sum, allocation) => sum + allocation.reservedMilli, 0);
      if (remaining - quantityMilli < reserved) {
        await tx.planSlot.updateMany({ where: { id: { in: planned.map((allocation) => allocation.destinationSlotId) },
          planId: plan.id, status: "planned" }, data: { status: "needs_attention",
          reason: "Saved food was discarded, leaving too little for this lunch. Cancel it or supply the missing food separately." } });
      }
    }
  });
}
