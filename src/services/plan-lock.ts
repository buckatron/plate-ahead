import "server-only";

import { prisma } from "@/services/prisma";

export class PlanLockError extends Error {}

export async function setDinnerLocked(input: {
  householdId: string; planId: string; slotId: string; expectedRevision: number; locked: boolean;
}): Promise<void> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new PlanLockError("Refresh this week before changing a lock.");
  }
  await prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.findFirst({ where: { id: input.planId, householdId: input.householdId },
      select: { id: true, state: true, revision: true } });
    if (!plan || !["draft", "active"].includes(plan.state)) throw new PlanLockError("This plan can no longer be edited.");
    if (plan.revision !== input.expectedRevision) throw new PlanLockError("This plan changed in another tab. Refresh before trying again.");
    const slot = await tx.planSlot.findFirst({ where: { id: input.slotId, planId: plan.id },
      select: { id: true, mealKind: true, slotType: true, status: true } });
    if (!slot || slot.mealKind !== "dinner" || slot.slotType !== "cook" || slot.status !== "planned") {
      throw new PlanLockError("Only a planned dinner can be kept in the next draft.");
    }
    const revised = await tx.mealPlan.updateMany({ where: { id: plan.id, householdId: input.householdId,
      revision: input.expectedRevision, state: { in: ["draft", "active"] } }, data: { revision: { increment: 1 } } });
    if (revised.count !== 1) throw new PlanLockError("This plan changed in another tab. Refresh before trying again.");
    await tx.planSlot.update({ where: { id: slot.id }, data: { locked: input.locked } });
  });
}
