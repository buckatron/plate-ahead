import type { HouseholdSettings } from "../../schemas/household";
import type { RecipeSignal } from "../feedback/learning";

export type DinnerCandidate = {
  id: string;
  key: string;
  title: string;
  totalMinutes: number;
  tags: Record<string, string[]>;
  ingredients: Array<{ id: string; name: string; isStaple: boolean; useFirst: boolean }>;
  lunchOptions: Array<{ transformationId: string; lunchRecipeId: string; lunchKey: string; lunchTitle: string }>;
};

export type LockedDinner = { date: string; recipe: DinnerCandidate; lunch?: DinnerCandidate["lunchOptions"][number] };
export type GeneratedDinner = { date: string; recipe: DinnerCandidate; reason: string; locked: boolean; lunch?: DinnerCandidate["lunchOptions"][number] };
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

function score(candidate: DinnerCandidate, selected: DinnerCandidate[], recentKeys: Set<string>,
  signals: ReadonlyMap<string, RecipeSignal>, settings: HouseholdSettings): number {
  const varietyWeight = settings.varietyPreference === "adventurous" ? 1.5 : settings.varietyPreference === "familiar" ? 0.65 : 1;
  let points = candidate.lunchOptions.length ? 2 : 0;
  if (recentKeys.has(candidate.key)) points -= 5;
  points += signals.get(candidate.key)?.points ?? 0;
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
  signals?: ReadonlyMap<string, RecipeSignal>;
  generationIndex?: number;
  lockedDinners?: LockedDinner[];
}): GeneratedWeek {
  const { weekStart, settings } = input;
  const weekday = new Date(`${weekStart}T00:00:00Z`).getUTCDay();
  if (weekday !== 1 || addDays(weekStart, 0) !== weekStart) throw new PlanningError("Planning weeks must start on Monday.");
  if (settings.dinnerCount > 6) throw new PlanningError("Please leave one night for eating out.");
  if (settings.lunchCount > settings.dinnerCount) throw new PlanningError("There are not enough dinners to supply those lunches.");

  const exclusions = settings.exclusions.map((value) => value.toLocaleLowerCase());
  const fitsSettings = (candidate: DinnerCandidate) => candidate.totalMinutes <= settings.maxDinnerMinutes &&
    !exclusions.some((excluded) => [candidate.title, ...Object.values(candidate.tags).flat(), ...candidate.ingredients.map((item) => item.name)]
      .some((value) => value.toLocaleLowerCase().includes(excluded)));
  const lockedByIndex = new Map<number, LockedDinner>();
  const lockedKeys = new Set<string>();
  const lockedLunchKeys = new Set<string>();
  for (const locked of input.lockedDinners ?? []) {
    const index = Array.from({ length: settings.dinnerCount }, (_, position) => addDays(weekStart, position)).indexOf(locked.date);
    if (index < 0) throw new PlanningError("A kept dinner no longer fits the number of cooking nights. Increase dinners or unlock it first.");
    if (lockedByIndex.has(index) || lockedKeys.has(locked.recipe.key)) throw new PlanningError("Kept dinners must have different dates and recipes.");
    if (!fitsSettings(locked.recipe)) throw new PlanningError(`Kept dinner “${locked.recipe.title}” conflicts with the time limit or exclusions. Change those settings or unlock it.`);
    if (locked.lunch) {
      const available = locked.recipe.lunchOptions.some((option) => option.transformationId === locked.lunch?.transformationId &&
        option.lunchRecipeId === locked.lunch?.lunchRecipeId);
      if (!available || lockedLunchKeys.has(locked.lunch.lunchKey)) throw new PlanningError("A kept dinner has a lunch pairing that is unavailable or repeated.");
      lockedLunchKeys.add(locked.lunch.lunchKey);
    }
    lockedByIndex.set(index, locked);
    lockedKeys.add(locked.recipe.key);
  }
  if (lockedLunchKeys.size > settings.lunchCount) throw new PlanningError("More kept lunches are linked than the new lunch target. Increase lunches or unlock a dinner.");

  const signals = input.signals ?? new Map<string, RecipeSignal>();
  const canSupplyLunch = (candidate: DinnerCandidate) => candidate.lunchOptions.length > 0 &&
    !signals.get(candidate.key)?.avoidLunch;
  const candidates = [...new Map([...input.candidates, ...[...lockedByIndex.values()].map((item) => item.recipe)]
    .map((candidate) => [candidate.key, candidate])).values()]
    .filter((candidate) => fitsSettings(candidate) && (!signals.get(candidate.key)?.unavailable || lockedKeys.has(candidate.key)));
  if (new Set(candidates.map((candidate) => candidate.key)).size < settings.dinnerCount) {
    throw new PlanningError("Not enough dinners fit the time limit, exclusions, and meal feedback. Relax a setting or edit a recipe's feedback.");
  }
  if (candidates.filter(canSupplyLunch).length + [...lockedByIndex.values()].filter((item) =>
    item.lunch && !canSupplyLunch(item.recipe)).length < settings.lunchCount) {
    throw new PlanningError("Not enough appealing leftover pairings are available. Edit meal feedback or lower the lunch target.");
  }

  const recentKeys = new Set(input.recentKeys ?? []);
  const selected: Array<DinnerCandidate | undefined> = Array.from({ length: settings.dinnerCount }, (_, index) => lockedByIndex.get(index)?.recipe);
  for (let index = 0; index < settings.dinnerCount; index++) {
    if (selected[index]) continue;
    const chosen = selected.filter((item): item is DinnerCandidate => Boolean(item));
    const remaining = selected.filter((item) => !item).length;
    const unlockedLunchSources = selected.filter((item, position) => item && !lockedByIndex.has(position) && canSupplyLunch(item)).length;
    const neededLunchSources = settings.lunchCount - lockedLunchKeys.size - unlockedLunchSources;
    const eligible = candidates.filter((candidate) => !chosen.some((item) => item.key === candidate.key) &&
      (neededLunchSources < remaining || canSupplyLunch(candidate)));
    eligible.sort((a, b) => {
      const difference = score(b, chosen, recentKeys, signals, settings) - score(a, chosen, recentKeys, signals, settings);
      return difference || hash(`${weekStart}:${input.generationIndex ?? 0}:${b.key}`) - hash(`${weekStart}:${input.generationIndex ?? 0}:${a.key}`);
    });
    const choice = eligible[0];
    if (!choice) throw new PlanningError("Could not compose a week with the requested lunches.");
    selected[index] = choice;
  }

  const chosenDinners = selected.map((item) => item!);
  const lunchSources = chosenDinners.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate, index }) => !lockedByIndex.has(index) && canSupplyLunch(candidate));
  const usedLunchKeys = new Set(lockedLunchKeys);
  const lunches = new Map<number, DinnerCandidate["lunchOptions"][number]>(
    [...lockedByIndex].flatMap(([index, locked]) => locked.lunch ? [[index, locked.lunch] as const] : []));
  // Spread two lunch anchors across the week instead of creating both at the beginning.
  while (lunches.size < settings.lunchCount) {
    const remaining = lunchSources.filter(({ index, candidate }) => !lunches.has(index) && candidate.lunchOptions.some((option) => !usedLunchKeys.has(option.lunchKey)));
    if (!remaining.length) {
      const keptWithoutLunch = [...lockedByIndex.values()].some((locked) => !locked.lunch && locked.recipe.lunchOptions.length);
      throw new PlanningError(keptWithoutLunch
        ? "Kept dinners without linked lunches leave too few lunch pairings. Unlock one or lower the lunch target."
        : "The available transformations do not provide enough distinct lunches.");
    }
    remaining.sort((a, b) => {
      const distance = (item: typeof a) => lunches.size ? Math.min(...[...lunches.keys()].map((index) => Math.abs(index - item.index))) : -item.index;
      return distance(b) - distance(a) || a.index - b.index;
    });
    const source = remaining[0];
    const option = source.candidate.lunchOptions.find((item) => !usedLunchKeys.has(item.lunchKey))!;
    lunches.set(source.index, option);
    usedLunchKeys.add(option.lunchKey);
  }

  const dinners = chosenDinners.map((recipe, index) => {
    const lunch = lunches.get(index);
    const shared = recipe.ingredients.find((ingredient) => !ingredient.isStaple && chosenDinners.some((other) => other.key !== recipe.key && other.ingredients.some((item) => item.id === ingredient.id)));
    const baseReason = lockedByIndex.has(index) ? "Kept from the previous plan." : lunch ? `Make extra ${tag(recipe, "main")[0] ?? "the main component"} for a different lunch tomorrow.` :
      shared ? `Shares ${shared.name.toLowerCase()} with another dinner, without repeating the meal.` :
      "A different main or cooking style to keep the week varied.";
    const reaction = signals.get(recipe.key)?.reaction;
    const reason = reaction === "loved" ? `${baseReason} You loved it before.` :
      reaction === "good" ? `${baseReason} You enjoyed it before.` : baseReason;
    return { date: addDays(weekStart, index), recipe, reason, lunch, locked: lockedByIndex.has(index) };
  });
  return { weekStart, dinners, eatOutDate: addDays(weekStart, 6), flexibleDates: Array.from({ length: 6 - settings.dinnerCount }, (_, index) => addDays(weekStart, settings.dinnerCount + index)) };
}
