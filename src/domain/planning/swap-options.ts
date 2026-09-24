import type { HouseholdSettings } from "../../schemas/household";
import type { DinnerCandidate } from "./generate-week";

export type SwapOption = {
  recipe: DinnerCandidate;
  reason: string;
  lunch: DinnerCandidate["lunchOptions"][number] | null;
  sharedIngredients: string[];
};

function allowed(candidate: DinnerCandidate, settings: HouseholdSettings): boolean {
  const exclusions = settings.exclusions.map((value) => value.toLocaleLowerCase());
  return candidate.totalMinutes <= settings.maxDinnerMinutes && !exclusions.some((excluded) =>
    [candidate.title, ...Object.values(candidate.tags).flat(), ...candidate.ingredients.map((item) => item.name)]
      .some((value) => value.toLocaleLowerCase().includes(excluded)));
}

export function rankSwapOptions(input: {
  current: DinnerCandidate;
  otherDinners: DinnerCandidate[];
  candidates: DinnerCandidate[];
  settings: HouseholdSettings;
  hasLinkedLunch: boolean;
  otherLunchKeys?: string[];
}): SwapOption[] {
  const usedKeys = new Set([input.current.key, ...input.otherDinners.map((item) => item.key)]);
  const otherIngredientIds = new Set(input.otherDinners.flatMap((dinner) => dinner.ingredients
    .filter((ingredient) => !ingredient.isStaple).map((ingredient) => ingredient.id)));
  const otherTags = (dimension: string) => new Set(input.otherDinners.flatMap((dinner) => dinner.tags[dimension] ?? []));
  const mainTags = otherTags("main");
  const formatTags = otherTags("format");
  const cuisineTags = otherTags("cuisine");
  const usedLunchKeys = new Set(input.otherLunchKeys ?? []);

  return input.candidates.filter((recipe) => !usedKeys.has(recipe.key) && allowed(recipe, input.settings))
    .map((recipe) => {
      const sharedIngredients = recipe.ingredients.filter((item) => !item.isStaple && otherIngredientIds.has(item.id)).map((item) => item.name);
      const freshMain = !(recipe.tags.main ?? []).some((value) => mainTags.has(value));
      const freshFormat = !(recipe.tags.format ?? []).some((value) => formatTags.has(value));
      const freshCuisine = !(recipe.tags.cuisine ?? []).some((value) => cuisineTags.has(value));
      const lunch = input.hasLinkedLunch ? recipe.lunchOptions.find((option) => !usedLunchKeys.has(option.lunchKey)) ?? null : null;
      const score = (freshMain ? 7 : 0) + (freshFormat ? 3 : 0) + (freshCuisine ? 2 : 0) +
        Math.min(sharedIngredients.length, 2) * 1.5 + (input.hasLinkedLunch && lunch ? 4 : 0) +
        recipe.ingredients.filter((item) => item.useFirst).length;
      const reason = sharedIngredients.length
        ? `Shares ${sharedIngredients[0].toLowerCase()} with another dinner while changing the menu.`
        : freshMain && freshFormat ? "A different main and meal format for the week." :
          freshMain ? "A different main ingredient for the week." : "A different way to cook this week.";
      return { recipe, reason, lunch, sharedIngredients, score };
    })
    .sort((a, b) => b.score - a.score || a.recipe.key.localeCompare(b.recipe.key))
    .slice(0, 3).map((option) => ({ recipe: option.recipe, reason: option.reason,
      lunch: option.lunch, sharedIngredients: option.sharedIngredients }));
}
