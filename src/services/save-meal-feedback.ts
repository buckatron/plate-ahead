import "server-only";

import { type LeftoverExperience, type MealEffort, type MealReaction, validateMealFeedback } from "@/domain/feedback/meal-feedback";
import { prisma } from "@/services/prisma";

export class MealFeedbackError extends Error {}

export async function saveMealFeedback(input: { householdId: string; planId: string; slotId: string; cookingEventId: string;
  expectedRevision: number; reaction: MealReaction | null; effort: MealEffort | null;
  leftovers: LeftoverExperience | null }): Promise<void> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new MealFeedbackError("Refresh this meal before saving feedback.");
  }
  await prisma.$transaction(async (tx) => {
    const event = await tx.cookingEvent.findFirst({ where: { id: input.cookingEventId,
      householdId: input.householdId, slotId: input.slotId, slot: { planId: input.planId } },
      include: { feedback: true, batches: { select: { id: true } } } });
    if (!event) throw new MealFeedbackError("This cooked meal is no longer available.");
    try { validateMealFeedback({ reaction: input.reaction, effort: input.effort,
      leftovers: input.leftovers, hasLeftovers: event.batches.length > 0 }); }
    catch (cause) { throw new MealFeedbackError(cause instanceof Error ? cause.message : "Check your feedback."); }
    if ((event.feedback?.revision ?? 0) !== input.expectedRevision) {
      throw new MealFeedbackError("Feedback changed in another tab. Refresh this meal before saving.");
    }
    const data = { reaction: input.reaction, effort: input.effort, leftovers: input.leftovers };
    if (event.feedback) {
      const updated = await tx.mealFeedback.updateMany({ where: { cookingEventId: event.id,
        revision: input.expectedRevision }, data: { ...data, revision: { increment: 1 } } });
      if (updated.count !== 1) throw new MealFeedbackError("Feedback changed in another tab. Refresh this meal before saving.");
    } else {
      await tx.mealFeedback.create({ data: { cookingEventId: event.id, ...data } });
    }
  });
}
