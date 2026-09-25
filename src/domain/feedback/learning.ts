import type { LeftoverExperience, MealEffort, MealReaction } from "./meal-feedback";

export type CookingHistoryEntry = {
  recipeKey: string;
  cookedAt: Date;
  feedback: { reaction: MealReaction | null; effort: MealEffort | null;
    leftovers: LeftoverExperience | null; priorEnjoyment: "loved" | "good" | null; updatedAt: Date } | null;
};

export type RecipeSignal = {
  lastCookedAt: Date | null;
  reaction: MealReaction | null;
  effort: MealEffort | null;
  leftovers: LeftoverExperience | null;
  unavailable: "break" | "not_again" | null;
  points: number;
  avoidLunch: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BREAK_DAYS = 28;

export function learningSignals(history: readonly CookingHistoryEntry[], forDate: Date): Map<string, RecipeSignal> {
  const byKey = new Map<string, CookingHistoryEntry[]>();
  for (const event of history) {
    const entries = byKey.get(event.recipeKey) ?? [];
    entries.push(event);
    byKey.set(event.recipeKey, entries);
  }
  const result = new Map<string, RecipeSignal>();
  for (const [key, events] of byKey) {
    const lastCookedAt = events.reduce<Date | null>((latest, event) =>
      !latest || event.cookedAt > latest ? event.cookedAt : latest, null);
    const feedbacks = events.flatMap((event) => event.feedback ? [event.feedback] : [])
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const latestFeedback = feedbacks[0] ?? null;
    const ageDays = lastCookedAt ? Math.max(0, (forDate.getTime() - lastCookedAt.getTime()) / DAY_MS) : Infinity;
    const repetitionPenalty = ageDays < 14 ? 10 : ageDays < 28 ? 7 : ageDays < 56 ? 4 : ageDays < 84 ? 2 : 0;
    const latestReaction = latestFeedback?.reaction ?? null;
    const breakActive = latestReaction === "break" && latestFeedback &&
      forDate.getTime() < latestFeedback.updatedAt.getTime() + BREAK_DAYS * DAY_MS;
    const earlierEnjoyment = latestReaction === "break"
      ? latestFeedback?.priorEnjoyment ?? feedbacks.slice(1)
        .find((item) => item.reaction === "loved" || item.reaction === "good")?.reaction ?? null : null;
    const reaction = latestReaction === "break" && !breakActive ? earlierEnjoyment : latestReaction;
    result.set(key, {
      lastCookedAt, reaction, effort: latestFeedback?.effort ?? null,
      leftovers: latestFeedback?.leftovers ?? null,
      unavailable: reaction === "not_again" ? "not_again" : breakActive ? "break" : null,
      points: -repetitionPenalty + (reaction === "loved" ? 4 : reaction === "good" ? 2 : 0) -
        (latestFeedback?.effort === "too_much" ? 3 : 0),
      avoidLunch: latestFeedback?.leftovers === "not_appealing",
    });
  }
  return result;
}
