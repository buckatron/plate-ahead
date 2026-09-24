import "server-only";

import { unallocatedBatchQuantity } from "@/domain/meals/leftover-stock";
import { prisma } from "@/services/prisma";

export async function getLeftoverOverview(householdId: string) {
  const [lunches, batches] = await Promise.all([
    prisma.planSlot.findMany({ where: { mealKind: "lunch", status: { in: ["planned", "needs_attention"] },
      plan: { householdId, state: "active" } }, include: { recipe: true,
      incomingAllocations: { include: { sourceComponent: { include: { slot: { include: { recipe: true } } } } } } },
      orderBy: [{ localDate: "asc" }, { id: "asc" }] }),
    prisma.leftoverBatch.findMany({
      where: { cookingEvent: { householdId } },
      include: {
        recipeComponent: true,
        movements: true,
        cookingEvent: { include: { slot: { include: {
          recipe: true,
          components: { include: { outgoingAllocations: { include: { destinationSlot: true } } } },
        } } } },
      },
      orderBy: [{ storedAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const unallocated = batches.flatMap((batch) => {
    const source = batch.cookingEvent.slot.components.find((component) => component.recipeComponentId === batch.recipeComponentId);
    const reservedMilli = source?.outgoingAllocations.filter((allocation) =>
      ["planned", "needs_attention"].includes(allocation.destinationSlot.status))
      .reduce((sum, allocation) => sum + allocation.reservedMilli, 0) ?? 0;
    const quantityMilli = unallocatedBatchQuantity(batch.quantityMilli, batch.movements, reservedMilli);
    if (quantityMilli <= 0) return [];
    return [{ id: batch.id, planId: batch.cookingEvent.slot.planId, slotId: batch.cookingEvent.slotId,
      componentName: batch.recipeComponent.name, dinnerTitle: batch.cookingEvent.slot.recipe?.title ?? "a cooked dinner",
      quantityMilli, unit: batch.unit, location: batch.location, storedAt: batch.storedAt }];
  });

  return { lunches: lunches.map((lunch) => ({ id: lunch.id, planId: lunch.planId, localDate: lunch.localDate,
    title: lunch.recipe?.title ?? "Linked lunch", needsAttention: lunch.status === "needs_attention",
    sourceTitle: lunch.incomingAllocations[0]?.sourceComponent.slot.recipe?.title ?? "its source dinner" })), unallocated };
}

export type LeftoverOverviewData = Awaited<ReturnType<typeof getLeftoverOverview>>;
