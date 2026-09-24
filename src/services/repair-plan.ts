import "server-only";

import { prisma } from "@/services/prisma";

export class PlanRepairError extends Error {}

export async function repairPlan(input: { householdId: string; planId: string; slotId: string;
  expectedRevision: number; change: "skip-dinner" | "cancel-lunch" }): Promise<{ linkedLunchCancelled: boolean; sourceAlreadyCooked: boolean }> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new PlanRepairError("Refresh this week before changing a meal.");
  }
  return prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.findFirst({ where: { id: input.planId, householdId: input.householdId },
      include: { slots: { include: {
        components: { include: { outgoingAllocations: true, recipeComponent: true } },
        incomingAllocations: { include: { sourceComponent: { include: { recipeComponent: true } } } },
      } } } });
    if (!plan || !["draft", "active"].includes(plan.state)) throw new PlanRepairError("This plan can no longer be edited.");
    if (plan.revision !== input.expectedRevision) throw new PlanRepairError("This plan changed in another tab. Refresh before trying again.");
    const slot = plan.slots.find((item) => item.id === input.slotId);
    if (!slot || (input.change === "skip-dinner" && (slot.mealKind !== "dinner" || slot.slotType !== "cook" || slot.status !== "planned")) ||
      (input.change === "cancel-lunch" && (slot.mealKind !== "lunch" || slot.slotType !== "transformed_lunch" ||
        !["planned", "needs_attention"].includes(slot.status)))) {
      throw new PlanRepairError("This meal is no longer available for that change.");
    }
    const linkedLunches = input.change === "skip-dinner"
      ? plan.slots.filter((item) => item.mealKind === "lunch" && item.status === "planned" &&
          item.incomingAllocations.some((allocation) => slot.components.some((component) => component.id === allocation.sourceComponentId)))
      : [slot];
    if (input.change === "skip-dinner" && slot.components.some((component) =>
      component.outgoingAllocations.some((allocation) => !linkedLunches.some((lunch) => lunch.id === allocation.destinationSlotId)))) {
      throw new PlanRepairError("A linked lunch changed. Refresh the week before trying again.");
    }
    if (linkedLunches.some((lunch) => lunch.locked || lunch.incomingAllocations.length === 0 ||
      lunch.incomingAllocations.some((allocation) => !plan.slots.some((dinner) => dinner.id === allocation.sourceComponent.slotId &&
        dinner.mealKind === "dinner" && ["planned", "cooked"].includes(dinner.status))))) {
      throw new PlanRepairError("A linked lunch changed. Refresh the week before trying again.");
    }
    if (input.change === "skip-dinner" && linkedLunches.some((lunch) =>
      lunch.incomingAllocations.some((allocation) => allocation.sourceComponent.slotId !== slot.id))) {
      throw new PlanRepairError("This lunch has another source dinner and needs a fresh plan.");
    }
    const sourceAlreadyCooked = input.change === "cancel-lunch" && slot.incomingAllocations.some((allocation) =>
      plan.slots.some((item) => item.id === allocation.sourceComponent.slotId && item.status === "cooked"));
    const revised = await tx.mealPlan.updateMany({ where: { id: plan.id, householdId: input.householdId,
      revision: input.expectedRevision, state: { in: ["draft", "active"] } }, data: { revision: { increment: 1 } } });
    if (revised.count !== 1) throw new PlanRepairError("This plan changed in another tab. Refresh before trying again.");

    for (const lunch of linkedLunches) {
      await tx.componentAllocation.deleteMany({ where: { destinationSlotId: lunch.id } });
      await tx.plannedComponent.deleteMany({ where: { slotId: lunch.id } });
      await tx.planSlot.update({ where: { id: lunch.id }, data: { recipeId: null, servings: null, locked: false,
        status: "cancelled", reason: input.change === "skip-dinner"
          ? "Cancelled because its source dinner was skipped." : "Cancelled from the weekly plan." } });
    }
    if (input.change === "skip-dinner") {
      await tx.plannedComponent.deleteMany({ where: { slotId: slot.id } });
      await tx.planSlot.update({ where: { id: slot.id }, data: { slotType: "flexible", recipeId: null,
        servings: null, locked: false, status: "skipped", reason: "Dinner skipped; this night is open." } });
    } else {
      for (const allocation of slot.incomingAllocations) {
        const source = allocation.sourceComponent;
        const sourceSlot = plan.slots.find((item) => item.id === source.slotId);
        if (sourceSlot?.status === "cooked") continue;
        const remaining = await tx.componentAllocation.aggregate({ where: { sourceComponentId: source.id },
          _sum: { reservedMilli: true } });
        const plannedYieldMilli = source.mealUseMilli + (remaining._sum.reservedMilli ?? 0);
        if (!Number.isSafeInteger(plannedYieldMilli) || source.recipeComponent.baseYieldMilli <= 0) {
          throw new PlanRepairError("The dinner quantity could not be recalculated.");
        }
        await tx.plannedComponent.update({ where: { id: source.id }, data: { plannedYieldMilli,
          preparationMilli: Math.ceil(plannedYieldMilli * 1000 / source.recipeComponent.baseYieldMilli) } });
      }
    }
    return { linkedLunchCancelled: linkedLunches.length > 0, sourceAlreadyCooked };
  });
}
