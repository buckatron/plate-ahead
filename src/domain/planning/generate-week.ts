import type { HouseholdSettings } from "../../schemas/household";

export type DinnerCandidate = {
  id: string;
  key: string;
  title: string;
  totalMinutes: number;
  tags: Record<string, string[]>;
  ingredients: Array<{ id: string; name: string; isStaple: boolean; useFirst: boolean }>;
  lunchOptions: Array<{ transformationId: string; lunchRecipeId: string; lunchKey: string; lunchTitle: string }>;
};

export type GeneratedDinner = { date: string; recipe: DinnerCandidate; reason: string; lunch?: DinnerCandidate["lunchOptions"][number] };
export type GeneratedWeek = { weekStart: string; dinners: GeneratedDinner[]; eatOutDate: string; flexibleDates: string[] };

export class PlanningError extends Error {}

export function addDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new PlanningError("The planning week has an invalid date.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextPlanningMonday(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (kind: string) => parts.find((item) => item.type === kind)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, (8 - weekday) % 7);
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index++) {
    value = Math.imul(value ^ input.charCodeAt(index), 16777619);
  }
  return (value >>> 0) / 4294967296;
}

function tag(candidate: DinnerCandidate, dimension: string): string[] {
  return candidate.tags[dimension] ?? [];
}

function score(candidate: DinnerCandidate, selected: DinnerCandidate[], recentKeys: Set<string>, settings: HouseholdSettings): number {
  const varietyWeight = settings.varietyPreference === "adventurous" ? 1.5 : settings.varietyPreference === "familiar" ? 0.65 : 1;
  let points = candidate.lunchOptions.length ? 2 : 0;
  if (recentKeys.has(candidate.key)) points -= 5;
  for (const other of selected) {
    for (const [dimension, penalty] of [["main", 6], ["format", 2.4], ["cuisine", 1.5], ["technique", 1]] as const) {
      if (tag(candidate, dimension).some((value) => tag(other, dimension).includes(value))) points -= penalty * varietyWeight;
    }
    const shared = candidate.ingredients.filter((ingredient) => !ingredient.isStaple && other.ingredients.some((item) => item.id === ingredient.id));
    points += Math.min(shared.length, 2) * 0.8;
  }
  points += candidate.ingredients.filter((ingredient) => ingredient.useFirst).length * 1.5;
  return points;
}

export function generateWeek(input: {
  weekStart: string;
  settings: HouseholdSettings;
  candidates: DinnerCandidate[];
  recentKeys?: string[];
  generationIndex?: number;
}): GeneratedWeek {
  const { weekStart, settings } = input;
  const weekday = new Date(`${weekStart}T00:00:00Z`).getUTCDay();
  if (weekday !== 1 || addDays(weekStart, 0) !== weekStart) throw new PlanningError("Planning weeks must start on Monday.");
  if (settings.dinnerCount > 6) throw new PlanningError("Please leave one night for eating out.");
  if (settings.lunchCount > settings.dinnerCount) throw new PlanningError("There are not enough dinners to supply those lunches.");

  const exclusions = settings.exclusions.map((value) => value.toLocaleLowerCase());
  const candidates = input.candidates.filter((candidate) => candidate.totalMinutes <= settings.maxDinnerMinutes &&
    !exclusions.some((excluded) => [candidate.title, ...Object.values(candidate.tags).flat(), ...candidate.ingredients.map((item) => item.name)]
      .some((value) => value.toLocaleLowerCase().includes(excluded))));
  if (candidates.length < settings.dinnerCount) throw new PlanningError("Not enough dinners fit the time limit and exclusions. Try relaxing those settings or add more recipes.");
  if (candidates.filter((candidate) => candidate.lunchOptions.length).length < settings.lunchCount) {
    throw new PlanningError("Not enough dinners can make the requested transformed lunches. Add more lunch options or lower the lunch target.");
  }

  const recentKeys = new Set(input.recentKeys ?? []);
  const selected: DinnerCandidate[] = [];
  for (let index = 0; index < settings.dinnerCount; index++) {
    const remaining = settings.dinnerCount - index;
    const neededLunchSources = settings.lunchCount - selected.filter((item) => item.lunchOptions.length).length;
    const eligible = candidates.filter((candidate) => !selected.some((item) => item.key === candidate.key) &&
      (neededLunchSources < remaining || candidate.lunchOptions.length > 0));
    eligible.sort((a, b) => {
      const difference = score(b, selected, recentKeys, settings) - score(a, selected, recentKeys, settings);
      return difference || hash(`${weekStart}:${input.generationIndex ?? 0}:${b.key}`) - hash(`${weekStart}:${input.generationIndex ?? 0}:${a.key}`);
    });
    const choice = eligible[0];
    if (!choice) throw new PlanningError("Could not compose a week with the requested lunches.");
    selected.push(choice);
  }

  const lunchSources = selected.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => candidate.lunchOptions.length);
  const usedLunchKeys = new Set<string>();
  const lunches = new Map<number, DinnerCandidate["lunchOptions"][number]>();
  // Spread two lunch anchors across the week instead of creating both at the beginning.
  while (lunches.size < settings.lunchCount) {
    const remaining = lunchSources.filter(({ index, candidate }) => !lunches.has(index) && candidate.lunchOptions.some((option) => !usedLunchKeys.has(option.lunchKey)));
    if (!remaining.length) throw new PlanningError("The available transformations do not provide enough distinct lunches.");
    remaining.sort((a, b) => {
      const distance = (item: typeof a) => lunches.size ? Math.min(...[...lunches.keys()].map((index) => Math.abs(index - item.index))) : -item.index;
      return distance(b) - distance(a) || a.index - b.index;
    });
    const source = remaining[0];
    const option = source.candidate.lunchOptions.find((item) => !usedLunchKeys.has(item.lunchKey))!;
    lunches.set(source.index, option);
    usedLunchKeys.add(option.lunchKey);
  }

  const dinners = selected.map((recipe, index) => {
    const lunch = lunches.get(index);
    const shared = recipe.ingredients.find((ingredient) => !ingredient.isStaple && selected.some((other) => other.key !== recipe.key && other.ingredients.some((item) => item.id === ingredient.id)));
    const reason = lunch ? `Make extra ${tag(recipe, "main")[0] ?? "the main component"} for a different lunch tomorrow.` :
      shared ? `Shares ${shared.name.toLowerCase()} with another dinner, without repeating the meal.` :
      "A different main or cooking style to keep the week varied.";
    return { date: addDays(weekStart, index), recipe, reason, lunch };
  });
  return { weekStart, dinners, eatOutDate: addDays(weekStart, 6), flexibleDates: Array.from({ length: 6 - settings.dinnerCount }, (_, index) => addDays(weekStart, settings.dinnerCount + index)) };
}
