import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/services/prisma";

export async function recipeVisibility(householdId: string, planning = true): Promise<Prisma.RecipeWhereInput> {
  const [preferences, entries] = await Promise.all([
    prisma.householdPreferences.findUnique({ where: { householdId } }),
    prisma.recipeEntry.findMany({ where: { householdId },
      select: { recipeKey: true, currentRecipeId: true, archivedAt: true, includeInPlanning: true } }),
  ]);
  const personalIds = entries.flatMap((entry) => entry.currentRecipeId && !entry.archivedAt &&
    (!planning || entry.includeInPlanning) ? [entry.currentRecipeId] : []);
  const ownedKeys = entries.map((entry) => entry.recipeKey);
  return { reviewStatus: "reviewed", OR: preferences?.includePrototypeRecipes === false ?
    [{ id: { in: personalIds } }] : [{ entryId: null, recipeKey: { notIn: ownedKeys } }, { id: { in: personalIds } }] };
}
