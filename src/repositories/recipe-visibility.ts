import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/services/prisma";

export async function recipeVisibility(householdId: string, planning = true): Promise<Prisma.RecipeWhereInput> {
  const [preferences, entries] = await Promise.all([
    prisma.householdPreferences.findUnique({ where: { householdId } }),
    prisma.recipeEntry.findMany({ where: { householdId, archivedAt: null,
      ...(planning ? { includeInPlanning: true } : {}) }, select: { currentRecipeId: true } }),
  ]);
  const personalIds = entries.flatMap((entry) => entry.currentRecipeId ? [entry.currentRecipeId] : []);
  return { reviewStatus: "reviewed", OR: preferences?.includePrototypeRecipes === false ?
    [{ id: { in: personalIds } }] : [{ entryId: null }, { id: { in: personalIds } }] };
}
