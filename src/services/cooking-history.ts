import "server-only";

import type { LeftoverExperience, MealEffort, MealReaction } from "@/domain/feedback/meal-feedback";
import { learningSignals, type CookingHistoryEntry } from "@/domain/feedback/learning";
import { prisma } from "@/services/prisma";

export async function getCookingSignals(householdId: string, forDate: Date) {
  const events = await prisma.cookingEvent.findMany({ where: { householdId },
    select: { cookedAt: true, recipe: { select: { recipeKey: true } },
      feedback: { select: { reaction: true, priorEnjoyment: true, effort: true, leftovers: true, updatedAt: true } } } });
  const history: CookingHistoryEntry[] = events.map((event) => ({ recipeKey: event.recipe.recipeKey,
    cookedAt: event.cookedAt, feedback: event.feedback ? {
      reaction: event.feedback.reaction as MealReaction | null,
      priorEnjoyment: event.feedback.priorEnjoyment as "loved" | "good" | null,
      effort: event.feedback.effort as MealEffort | null,
      leftovers: event.feedback.leftovers as LeftoverExperience | null,
      updatedAt: event.feedback.updatedAt,
    } : null }));
  return learningSignals(history, forDate);
}
