import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/services/prisma";

const planInclude = {
  // Within a day, descending meal kind puts lunch before dinner.
  slots: { orderBy: [{ localDate: "asc" }, { mealKind: "desc" }], include: {
    recipe: true,
    components: { include: { recipeComponent: true, outgoingAllocations: true } },
    cookingEvent: { include: { batches: { include: { recipeComponent: true, movements: true } } } },
    incomingAllocations: { include: { sourceComponent: { include: { slot: { include: { recipe: true } } } } } },
  } },
} satisfies Prisma.MealPlanInclude;

export async function findLatestPlan(householdId: string) {
  return prisma.mealPlan.findFirst({
    where: { householdId },
    orderBy: [{ createdAt: "desc" }, { generationIndex: "desc" }],
    include: planInclude,
  });
}

export async function findPlanById(householdId: string, planId: string) {
  return prisma.mealPlan.findFirst({ where: { householdId, id: planId }, include: planInclude });
}

export async function findActivePlanReference(householdId: string, weekStart: string) {
  return prisma.mealPlan.findFirst({
    where: { householdId, weekStart, state: "active" },
    select: { id: true, weekStart: true, revision: true },
    orderBy: { updatedAt: "desc" },
  });
}
