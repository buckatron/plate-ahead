import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Database = typeof import("../../src/services/prisma").prisma;
type PersonalRecipes = typeof import("../../src/services/personal-recipes");
let prisma: Database;
let recipes: PersonalRecipes;
let tempRoot: string;
const previousDatabaseUrl = process.env.DATABASE_URL;

beforeAll(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "plate-ahead-integration-"));
  const dbPath = join(tempRoot, "integration.db");
  const url = `file:${dbPath.replaceAll("\\", "/")}`;
  process.env.DATABASE_URL = url;
  const database = new Database(dbPath);
  try {
    const root = resolve("prisma/migrations");
    for (const folder of (await readdir(root)).filter((name) => /^\d/.test(name)).sort()) {
      database.exec(await readFile(join(root, folder, "migration.sql"), "utf8"));
    }
  } finally { database.close(); }
  ({ prisma } = await import("../../src/services/prisma"));
  recipes = await import("../../src/services/personal-recipes");
  await prisma.household.create({ data: { id: "home", name: "Integration test kitchen" } });
}, 90_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (tempRoot && dirname(tempRoot) === tmpdir() && basename(tempRoot).startsWith("plate-ahead-integration-")) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe("personal recipe persistence", () => {
  it("publishes an imported recipe, then edits a new version without changing the first", async () => {
    const sourceUrl = "https://recipes.example/eggs";
    const { blankDraft } = await import("../../src/domain/meals/personal-recipe");
    const payload = { ...blankDraft, title: "Crispy eggs", servings: 2, totalMinutes: 15,
      ingredientLines: ["2 eggs"], steps: ["Fry the eggs."], origin: "url_import" as const,
      sourceUrl, sourceAttribution: "Test kitchen" };
    const draft = await recipes.createDraft("home", payload, { submittedUrl: sourceUrl, finalUrl: sourceUrl,
      importedAt: new Date().toISOString(), title: payload.title, yieldText: "2 servings",
      ingredientLines: payload.ingredientLines, steps: payload.steps, extractionMethod: "test-fixture" });
    const key = await recipes.publishDraft("home", draft.id, draft.revision);
    const first = await prisma.recipe.findFirstOrThrow({ where: { recipeKey: key, version: 1 }, include: { components: { include: { ingredients: true } } } });
    expect(first).toMatchObject({ title: "Crispy eggs", sourceUrl, baseServings: 2 });
    expect(first.components[0].ingredients[0]).toMatchObject({ quantityMilli: 2000, unit: "each" });
    expect(await prisma.recipeDraft.findUnique({ where: { id: draft.id } })).toBeNull();

    const entry = await prisma.recipeEntry.findUniqueOrThrow({ where: { recipeKey: key } });
    const revision = await recipes.createRevisionDraft("home", entry.id);
    const editable = await recipes.findDraft("home", revision.id);
    expect(editable?.payload.title).toBe("Crispy eggs");
    await recipes.saveDraft("home", revision.id, revision.revision, { ...editable!.payload,
      title: "Crispy eggs with herbs", steps: ["Fry the eggs.", "Add herbs."] });
    await recipes.publishDraft("home", revision.id, revision.revision + 1);

    const versions = await prisma.recipe.findMany({ where: { recipeKey: key }, orderBy: { version: "asc" } });
    expect(versions.map((version) => [version.version, version.title])).toEqual([
      [1, "Crispy eggs"], [2, "Crispy eggs with herbs"],
    ]);
    expect(versions[0].id).toBe(first.id);
    expect((await prisma.recipeEntry.findUniqueOrThrow({ where: { recipeKey: key } })).currentRecipeId).toBe(versions[1].id);
    const { listDinnerRecipes, getRecipe } = await import("../../src/repositories/recipes");
    expect((await listDinnerRecipes("home")).filter((recipe) => recipe.recipeKey === key).map((recipe) => recipe.title))
      .toEqual(["Crispy eggs with herbs"]);
    expect((await getRecipe(key, "home", 1))?.recipe.title).toBe("Crispy eggs");
    await expect(recipes.publishDraft("home", revision.id, revision.revision + 1)).rejects.toThrow("draft changed");
  }, 30_000);

  it("plans, shops, cooks, and records feedback for personal recipes while preserving history", async () => {
    const householdId = "journey";
    await prisma.household.create({ data: { id: householdId, name: "Recipe journey",
      preferences: { create: { dinnerCount: 2, lunchCount: 0, includePrototypeRecipes: false } } } });
    const { blankDraft } = await import("../../src/domain/meals/personal-recipe");
    const manual = await recipes.createDraft(householdId, { ...blankDraft, title: "Tomato rice",
      servings: 2, totalMinutes: 30, ingredientLines: ["2 cups rice", "2 tomatoes"],
      steps: ["Cook rice.", "Add tomatoes."] });
    const manualKey = await recipes.publishDraft(householdId, manual.id, manual.revision);
    const imported = await recipes.createDraft(householdId, { ...blankDraft, title: "Crispy eggs",
      servings: 2, totalMinutes: 15, ingredientLines: ["2 eggs"], steps: ["Fry eggs."],
      origin: "url_import", sourceUrl: "https://recipes.example/eggs", sourceAttribution: "Test kitchen" });
    const importedKey = await recipes.publishDraft(householdId, imported.id, imported.revision);

    const { createGeneratedWeek } = await import("../../src/services/plan-week");
    const { getGroceryNeeds, saveGroceryOnHand, setGroceryPurchased } = await import("../../src/services/grocery-needs");
    const { acceptPlan } = await import("../../src/services/accept-plan");
    const { recordCooking } = await import("../../src/services/record-cooking");
    const { saveMealFeedback } = await import("../../src/services/save-meal-feedback");
    const planId = await createGeneratedWeek(householdId, new Date("2026-10-01T12:00:00Z"));
    const plan = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId },
      include: { slots: { include: { recipe: true } } } });
    const dinners = plan.slots.filter((slot) => slot.slotType === "cook");
    expect(dinners.map((slot) => slot.recipe?.recipeKey).sort()).toEqual([manualKey, importedKey].sort());
    const groceries = await getGroceryNeeds(householdId, planId);
    expect(groceries?.needs.map((need) => need.name).sort()).toEqual(["eggs", "rice", "tomatoes"]);
    const eggs = groceries!.needs.find((need) => need.name === "eggs")!;
    expect(eggs.quantity.milli).toBe(2000);
    await saveGroceryOnHand({ householdId, planId, expectedRevision: plan.revision,
      ingredientId: eggs.ingredientId, unitGroup: "count", rawAmount: "1" });
    await setGroceryPurchased({ householdId, planId, expectedRevision: plan.revision,
      ingredientId: eggs.ingredientId, unitGroup: "count", checked: true });
    expect((await getGroceryNeeds(householdId, planId))?.needs.find((need) => need.name === "eggs"))
      .toMatchObject({ onHandMilli: 1000, toBuy: { milli: 1000 }, checked: true });

    await acceptPlan(householdId, planId, plan.revision);
    const dinner = dinners.find((slot) => slot.recipe?.recipeKey === manualKey)!;
    const accepted = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId } });
    const cooking = await recordCooking({ householdId, planId, slotId: dinner.id,
      expectedRevision: accepted.revision, requestId: "journey-cook", servingsServed: 2, amounts: [] });
    expect(cooking).toEqual({ alreadyRecorded: false, lunchNeedsAttention: false });
    const event = await prisma.cookingEvent.findUniqueOrThrow({ where: { householdId_requestId: {
      householdId, requestId: "journey-cook" } } });
    await saveMealFeedback({ householdId, planId, slotId: dinner.id, cookingEventId: event.id,
      expectedRevision: 0, reaction: "good", effort: "about_right", leftovers: null });
    const importedDinner = dinners.find((slot) => slot.recipe?.recipeKey === importedKey)!;
    const afterFirstDinner = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId } });
    await recordCooking({ householdId, planId, slotId: importedDinner.id,
      expectedRevision: afterFirstDinner.revision, requestId: "journey-imported-cook", servingsServed: 2, amounts: [] });
    const importedEvent = await prisma.cookingEvent.findUniqueOrThrow({ where: { householdId_requestId: {
      householdId, requestId: "journey-imported-cook" } } });
    await saveMealFeedback({ householdId, planId, slotId: importedDinner.id, cookingEventId: importedEvent.id,
      expectedRevision: 0, reaction: "loved", effort: "easy", leftovers: null });

    const entry = await prisma.recipeEntry.findUniqueOrThrow({ where: { recipeKey: manualKey } });
    const revision = await recipes.createRevisionDraft(householdId, entry.id);
    const editable = await recipes.findDraft(householdId, revision.id);
    await recipes.saveDraft(householdId, revision.id, revision.revision,
      { ...editable!.payload, title: "Tomato rice with herbs" });
    await recipes.publishDraft(householdId, revision.id, revision.revision + 1);
    const savedSlot = await prisma.planSlot.findUniqueOrThrow({ where: { id: dinner.id }, include: { recipe: true } });
    expect(savedSlot.recipe?.title).toBe("Tomato rice");
    expect(event.recipeId).toBe(savedSlot.recipeId);
    expect((await prisma.mealFeedback.findUniqueOrThrow({ where: { cookingEventId: event.id } })).reaction).toBe("good");
    expect((await prisma.mealFeedback.findUniqueOrThrow({ where: { cookingEventId: importedEvent.id } })).reaction).toBe("loved");
    await recipes.setRecipeArchived(householdId, entry.id, true);
    const { listDinnerRecipes } = await import("../../src/repositories/recipes");
    expect((await listDinnerRecipes(householdId)).map((recipe) => recipe.recipeKey)).toEqual([importedKey]);
    expect((await prisma.planSlot.findUniqueOrThrow({ where: { id: dinner.id }, include: { recipe: true } })).recipe?.title)
      .toBe("Tomato rice");
  }, 30_000);
});
