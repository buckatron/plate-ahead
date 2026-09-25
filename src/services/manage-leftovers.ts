import "server-only";

import { randomUUID } from "node:crypto";
import { parseConfirmedQuantity } from "@/domain/meals/cooking";
import { remainingBatchQuantity, stockCorrectionMovement } from "@/domain/meals/leftover-stock";
import { prisma } from "@/services/prisma";

export class LeftoverActionError extends Error {}

export async function manageLeftoverBatch(input: { householdId: string; planId: string; batchId: string;
  expectedRevision: number; requestId: string; change: "freeze" | "thaw" | "discard" | "correct"; rawAmount?: string }): Promise<void> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new LeftoverActionError("Refresh this week before changing leftovers.");
  }
  let quantityMilli = 0;
  if (input.change === "discard" || input.change === "correct") {
    try { quantityMilli = parseConfirmedQuantity(input.rawAmount ?? ""); }
    catch (cause) { throw new LeftoverActionError(cause instanceof Error ? cause.message : "Check the discarded amount."); }
    if (quantityMilli > 2_147_483_647) throw new LeftoverActionError("The leftover amount is too large.");
    if (input.change === "discard" && quantityMilli <= 0) throw new LeftoverActionError("Enter a positive amount to discard.");
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
      const matchesCorrection = input.change === "correct" && ["adjust_in", "adjust_out"].includes(prior.type) &&
        prior.targetBalanceMilli === quantityMilli;
      const matchesOther = input.change !== "correct" && prior.type === input.change && prior.quantityMilli === quantityMilli;
      if ((!matchesCorrection && !matchesOther) || prior.destinationSlotId !== null) {
        throw new LeftoverActionError("This leftover action was already used with different details.");
      }
      return;
    }
    if (!["active", "archived"].includes(plan.state) || plan.revision !== input.expectedRevision) {
      throw new LeftoverActionError("This week changed in another tab. Refresh before changing leftovers.");
    }
    const remaining = remainingBatchQuantity(batch.quantityMilli, batch.movements);
    if (remaining <= 0 && input.change !== "correct") throw new LeftoverActionError("No food remains in this batch.");
    if (input.change === "freeze" && batch.location !== "fridge" ||
      input.change === "thaw" && batch.location !== "freezer") {
      throw new LeftoverActionError("The storage location changed. Refresh this batch before trying again.");
    }
    if (input.change === "discard" && quantityMilli > remaining) {
      throw new LeftoverActionError("You cannot discard more than remains in this batch.");
    }
    let movementType: string = input.change;
    let movementQuantity = quantityMilli;
    if (input.change === "correct") {
      try {
        const correction = stockCorrectionMovement(remaining, quantityMilli);
        movementType = correction.type;
        movementQuantity = correction.quantityMilli;
      } catch (cause) {
        throw new LeftoverActionError(cause instanceof Error ? cause.message : "Check the corrected amount.");
      }
    }
    const revised = await tx.mealPlan.updateMany({ where: { id: plan.id, householdId: input.householdId,
      revision: input.expectedRevision, state: { in: ["active", "archived"] } }, data: { revision: { increment: 1 } } });
    if (revised.count !== 1) throw new LeftoverActionError("This week changed in another tab. Refresh before changing leftovers.");
    await tx.leftoverMovement.create({ data: { id: randomUUID(), batchId: batch.id,
      destinationSlotId: null, requestId: input.requestId, type: movementType, quantityMilli: movementQuantity,
      targetBalanceMilli: input.change === "correct" ? quantityMilli : null } });
    if (input.change === "freeze" || input.change === "thaw") await tx.leftoverBatch.update({ where: { id: batch.id },
      data: { location: input.change === "freeze" ? "freezer" : "fridge" } });
    if (input.change === "discard" || input.change === "correct") {
      const source = await tx.plannedComponent.findFirst({ where: { slotId: batch.cookingEvent.slotId,
        recipeComponentId: batch.recipeComponentId }, include: {
        outgoingAllocations: { include: { destinationSlot: true } },
      } });
      const candidateIds = source?.outgoingAllocations.filter((allocation) =>
        ["planned", "needs_attention"].includes(allocation.destinationSlot.status))
        .map((allocation) => allocation.destinationSlotId) ?? [];
      const candidates = await tx.planSlot.findMany({ where: { id: { in: candidateIds }, planId: plan.id,
        mealKind: "lunch", status: { in: ["planned", "needs_attention"] } }, include: {
        incomingAllocations: { include: { sourceComponent: { include: {
          slot: true, outgoingAllocations: { include: { destinationSlot: true } },
        } } } },
      } });
      for (const lunch of candidates) {
        let shortage = false;
        for (const allocation of lunch.incomingAllocations) {
          const inputSource = allocation.sourceComponent;
          const inputBatch = await tx.leftoverBatch.findFirst({ where: { recipeComponentId: inputSource.recipeComponentId,
            cookingEvent: { slotId: inputSource.slotId, householdId: input.householdId } }, include: { movements: true } });
          const reserved = inputSource.outgoingAllocations.filter((item) =>
            ["planned", "needs_attention"].includes(item.destinationSlot.status))
            .reduce((sum, item) => sum + item.reservedMilli, 0);
          if (!inputBatch || inputBatch.unit !== allocation.unit ||
            remainingBatchQuantity(inputBatch.quantityMilli, inputBatch.movements) < reserved) {
            shortage = true;
            break;
          }
        }
        if (shortage && lunch.status === "planned") {
          await tx.planSlot.update({ where: { id: lunch.id }, data: { status: "needs_attention",
            reason: "Confirmed leftovers are short for this lunch. Correct the saved amount, cancel the lunch, or supply the missing food separately." } });
        } else if (!shortage && lunch.status === "needs_attention" && lunch.reason &&
          /^(Less reusable food was saved|Saved food was discarded|Confirmed leftovers are short)/.test(lunch.reason)) {
          await tx.planSlot.update({ where: { id: lunch.id }, data: { status: "planned", reason: null } });
        }
      }
    }
  });
}
