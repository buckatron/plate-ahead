export type MealReaction = "loved" | "good" | "not_again" | "break";
export type MealEffort = "easy" | "about_right" | "too_much";
export type LeftoverExperience = "appealing" | "okay" | "not_appealing";

export function validateMealFeedback(input: { reaction: MealReaction | null; effort: MealEffort | null;
  leftovers: LeftoverExperience | null; hasLeftovers: boolean }): void {
  if (!input.reaction && !input.effort && !input.leftovers) {
    throw new Error("Choose at least one answer, or leave feedback for another time.");
  }
  if (input.leftovers && !input.hasLeftovers) {
    throw new Error("No reusable leftovers were recorded for this meal.");
  }
}
