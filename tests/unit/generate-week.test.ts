import { describe, expect, it } from "vitest";
import { recipes, transformations, ingredients } from "../../src/data/catalog";
import { addDays, generateWeek, nextPlanningMonday, PlanningError, type DinnerCandidate } from "../../src/domain/planning/generate-week";
import { DEFAULT_SETTINGS } from "../../src/schemas/household";
import { learningSignals } from "../../src/domain/feedback/learning";

const ingredientByKey = new Map(ingredients.map((ingredient) => [ingredient.key, ingredient]));
const candidates: DinnerCandidate[] = recipes.filter((recipe) => recipe.role === "dinner").map((recipe) => ({
  id: recipe.key, key: recipe.key, title: recipe.title, totalMinutes: recipe.totalMinutes,
  tags: Object.fromEntries([...new Set(recipe.tags.map((tag) => tag.dimension))].map((dimension) =>
    [dimension, recipe.tags.filter((tag) => tag.dimension === dimension).map((tag) => tag.value)])),
  ingredients: [...new Set(recipe.components.flatMap((component) => component.ingredients.map((item) => item.key)))].map((key) => ({
    id: key, name: ingredientByKey.get(key)!.name, isStaple: ingredientByKey.get(key)!.category === "Pantry", useFirst: false,
  })),
  lunchOptions: transformations.filter((transformation) => transformation.sourceRecipeKey === recipe.key).map((transformation) => ({
    transformationId: transformation.key, lunchRecipeId: transformation.targetRecipeKey,
    lunchKey: transformation.targetRecipeKey, lunchTitle: recipes.find((item) => item.key === transformation.targetRecipeKey)!.title,
  })),
}));

describe("week generation", () => {
  it("builds a repeatable six-dinner week with two different next-day lunches", () => {
    const input = { weekStart: "2026-09-28", settings: DEFAULT_SETTINGS, candidates };
    const week = generateWeek(input);
    expect(generateWeek(input)).toEqual(week);
    expect(week.dinners).toHaveLength(6);
    expect(new Set(week.dinners.map((dinner) => dinner.recipe.key)).size).toBe(6);
    expect(week.dinners.filter((dinner) => dinner.lunch)).toHaveLength(2);
    expect(new Set(week.dinners.flatMap((dinner) => dinner.lunch ? [dinner.lunch.lunchKey] : [])).size).toBe(2);
    expect(week.dinners.every((dinner, index) => dinner.date === addDays(week.weekStart, index) && dinner.reason.length > 0)).toBe(true);
    expect(week.eatOutDate).toBe("2026-10-04");
    const alternative = generateWeek({ ...input, generationIndex: 1, recentKeys: week.dinners.map((dinner) => dinner.recipe.key) });
    expect(alternative.dinners.filter((dinner) => !week.dinners.some((original) => original.recipe.key === dinner.recipe.key)).length).toBeGreaterThanOrEqual(2);
  });

  it("respects time and ingredient exclusions and explains infeasible settings", () => {
    const settings = { ...DEFAULT_SETTINGS, exclusions: ["chicken"], maxDinnerMinutes: 45 };
    const week = generateWeek({ weekStart: "2026-09-28", settings, candidates });
    expect(week.dinners.every((dinner) => dinner.recipe.totalMinutes <= 45 && !dinner.recipe.ingredients.some((item) => item.name.toLowerCase().includes("chicken")))).toBe(true);
    expect(() => generateWeek({ weekStart: "2026-09-28", settings: { ...settings, maxDinnerMinutes: 10 }, candidates })).toThrow(PlanningError);
  });

  it("places the next week using the household timezone", () => {
    expect(nextPlanningMonday(new Date("2026-09-28T02:00:00Z"), "America/Los_Angeles")).toBe("2026-09-28");
    expect(nextPlanningMonday(new Date("2026-09-28T18:00:00Z"), "America/Los_Angeles")).toBe("2026-09-28");
  });

  it("keeps a dinner on its date with the same transformed lunch in another draft", () => {
    const input = { weekStart: "2026-09-28", settings: DEFAULT_SETTINGS, candidates };
    const first = generateWeek(input);
    const kept = first.dinners.find((dinner) => dinner.lunch)!;
    const next = generateWeek({ ...input, generationIndex: 1,
      recentKeys: first.dinners.map((dinner) => dinner.recipe.key),
      lockedDinners: [{ date: kept.date, recipe: kept.recipe, lunch: kept.lunch }] });
    const sameDay = next.dinners.find((dinner) => dinner.date === kept.date)!;
    expect(sameDay).toMatchObject({ recipe: { id: kept.recipe.id }, lunch: { transformationId: kept.lunch!.transformationId }, locked: true });
    expect(next.dinners.filter((dinner) => dinner.lunch)).toHaveLength(DEFAULT_SETTINGS.lunchCount);
    expect(new Set(next.dinners.map((dinner) => dinner.recipe.key)).size).toBe(DEFAULT_SETTINGS.dinnerCount);
  });

  it("explains settings that conflict with a kept dinner", () => {
    const kept = generateWeek({ weekStart: "2026-09-28", settings: DEFAULT_SETTINGS, candidates }).dinners[5];
    expect(() => generateWeek({ weekStart: "2026-09-28", settings: { ...DEFAULT_SETTINGS, dinnerCount: 5 },
      candidates, lockedDinners: [{ date: kept.date, recipe: kept.recipe }] })).toThrow(/no longer fits the number of cooking nights/);
    expect(() => generateWeek({ weekStart: "2026-09-28", settings: { ...DEFAULT_SETTINGS, maxDinnerMinutes: 10 },
      candidates, lockedDinners: [{ date: kept.date, recipe: kept.recipe }] })).toThrow(/Kept dinner/);
    const first = generateWeek({ weekStart: "2026-09-28", settings: DEFAULT_SETTINGS, candidates });
    expect(() => generateWeek({ weekStart: "2026-09-28", settings: DEFAULT_SETTINGS, candidates,
      lockedDinners: first.dinners.map((dinner) => ({ date: dinner.date, recipe: dinner.recipe })) }))
      .toThrow(/Unlock one or lower the lunch target/);
  });

  it("respects explicit feedback when choosing dinners and transformed lunches", () => {
    const source = candidates.find((candidate) => candidate.lunchOptions.length)!;
    const excluded = candidates.find((candidate) => candidate.key !== source.key)!;
    const signals = learningSignals([
      { recipeKey: source.key, cookedAt: new Date("2026-09-01T12:00:00Z"), feedback: {
        reaction: "good", priorEnjoyment: null, effort: null, leftovers: "not_appealing",
        updatedAt: new Date("2026-09-25T12:00:00Z"),
      } },
      { recipeKey: excluded.key, cookedAt: new Date("2026-09-01T12:00:00Z"), feedback: {
        reaction: "not_again", priorEnjoyment: null, effort: null, leftovers: null,
        updatedAt: new Date("2026-09-25T12:00:00Z"),
      } },
    ], new Date("2026-09-28T12:00:00Z"));
    const week = generateWeek({ weekStart: "2026-09-28", settings: DEFAULT_SETTINGS, candidates, signals });
    expect(week.dinners.some((dinner) => dinner.recipe.key === excluded.key)).toBe(false);
    expect(week.dinners.find((dinner) => dinner.recipe.key === source.key)?.lunch).toBeUndefined();
  });
});
