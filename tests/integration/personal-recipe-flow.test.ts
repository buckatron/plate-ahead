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
  await prisma.household.create({ data: { id: "home", name: "Integration test kitchen",
    preferences: { create: {} } } });
  await import("../../prisma/seed");
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

    const revision = await recipes.createRevisionDraft("home", key);
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
    const current = await getRecipe(key, "home");
    const historical = await getRecipe(key, "home", 1);
    expect(current?.recipe.entry?.currentRecipeId).toBe(current?.recipe.id);
    expect(historical?.recipe.title).toBe("Crispy eggs");
    expect(historical?.recipe.entry?.currentRecipeId).not.toBe(historical?.recipe.id);
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
    const importedVersion = await prisma.recipe.findFirstOrThrow({ where: { recipeKey: importedKey },
      include: { components: { include: { ingredients: true } } } });
    // Simulate a recipe published before textual ranges were rejected by the parser.
    await prisma.recipeIngredient.update({ where: { id: importedVersion.components[0].ingredients[0].id },
      data: { originalText: "2 to 3 eggs" } });

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
    expect(groceries?.needs.map((need) => need.name.toLowerCase()).sort()).toEqual(["eggs", "rice", "tomatoes"]);
    const eggs = groceries!.needs.find((need) => need.name.toLowerCase() === "eggs")!;
    expect(eggs.quantity.milli).toBe(2000);
    expect(groceries?.reviewLines).toEqual([{ recipeKey: importedKey, recipeTitle: "Crispy eggs",
      version: 1, line: "2 to 3 eggs" }]);
    await saveGroceryOnHand({ householdId, planId, expectedRevision: plan.revision,
      ingredientId: eggs.ingredientId, unitGroup: "count", rawAmount: "1" });
    await setGroceryPurchased({ householdId, planId, expectedRevision: plan.revision,
      ingredientId: eggs.ingredientId, unitGroup: "count", checked: true });
    expect((await getGroceryNeeds(householdId, planId))?.needs.find((need) => need.name.toLowerCase() === "eggs"))
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
    const revision = await recipes.createRevisionDraft(householdId, manualKey);
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

  it("completes a default week with a swap, saved lunch, feedback, and another draft", async () => {
    const { createGeneratedWeek } = await import("../../src/services/plan-week");
    const { getSwapShortlist } = await import("../../src/services/swap-options");
    const { applySwap } = await import("../../src/services/apply-swap");
    const { getGroceryNeeds, saveGroceryOnHand } = await import("../../src/services/grocery-needs");
    const { acceptPlan } = await import("../../src/services/accept-plan");
    const { recordCooking } = await import("../../src/services/record-cooking");
    const { consumeLunch } = await import("../../src/services/consume-lunch");
    const { saveMealFeedback } = await import("../../src/services/save-meal-feedback");

    const planId = await createGeneratedWeek("home", new Date("2026-10-01T12:00:00Z"));
    const firstPlan = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: {
      slots: { include: { components: { include: { outgoingAllocations: true } } } },
    } });
    const sourceDinner = firstPlan.slots.find((slot) => slot.mealKind === "dinner" &&
      slot.components.some((component) => component.outgoingAllocations.length > 0))!;
    const swapDinner = firstPlan.slots.find((slot) => slot.slotType === "cook" && slot.id !== sourceDinner.id)!;
    const shortlist = await getSwapShortlist("home", planId, swapDinner.id);
    expect(shortlist?.options.length).toBeGreaterThan(0);
    const replacement = shortlist!.options[0];
    expect(await applySwap({ householdId: "home", planId, slotId: swapDinner.id,
      recipeId: replacement.recipe.id, expectedRevision: firstPlan.revision })).toEqual({ cancelledLunch: false });
    expect((await prisma.planSlot.findUniqueOrThrow({ where: { id: swapDinner.id } })).recipeId).toBe(replacement.recipe.id);

    const swappedPlan = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId } });
    const groceries = await getGroceryNeeds("home", planId);
    expect(groceries?.needs.length).toBeGreaterThan(0);
    const firstNeed = groceries!.needs[0];
    await saveGroceryOnHand({ householdId: "home", planId, expectedRevision: swappedPlan.revision,
      ingredientId: firstNeed.ingredientId, unitGroup: firstNeed.key.slice(firstNeed.ingredientId.length + 1), rawAmount: "1" });
    expect((await getGroceryNeeds("home", planId))?.needs.find((need) => need.key === firstNeed.key)?.onHandMilli).toBe(1000);
    await acceptPlan("home", planId, swappedPlan.revision);

    const accepted = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: {
      slots: { include: { components: { include: { outgoingAllocations: true, recipeComponent: true } } } },
    } });
    const cookedSource = accepted.slots.find((slot) => slot.id === sourceDinner.id)!;
    const savedAmounts = cookedSource.components.filter((component) => component.recipeComponent.reservable).map((component) => ({
      componentId: component.recipeComponentId,
      rawAmount: String(component.outgoingAllocations.reduce((sum, allocation) => sum + allocation.reservedMilli, 0) / 1000),
    }));
    expect(savedAmounts.length).toBeGreaterThan(0);
    await recordCooking({ householdId: "home", planId, slotId: cookedSource.id,
      expectedRevision: accepted.revision, requestId: "default-week-cook", servingsServed: 2, amounts: savedAmounts });
    const event = await prisma.cookingEvent.findUniqueOrThrow({ where: { householdId_requestId: {
      householdId: "home", requestId: "default-week-cook" } } });
    const linkedLunch = await prisma.planSlot.findFirstOrThrow({ where: { planId, mealKind: "lunch",
      incomingAllocations: { some: { sourceComponent: { slotId: cookedSource.id } } } } });
    const afterDinner = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId } });
    expect(await consumeLunch({ householdId: "home", planId, slotId: linkedLunch.id,
      expectedRevision: afterDinner.revision, requestId: "default-week-lunch" })).toEqual({ alreadyRecorded: false });
    expect((await prisma.planSlot.findUniqueOrThrow({ where: { id: linkedLunch.id } })).status).toBe("eaten");
    await saveMealFeedback({ householdId: "home", planId, slotId: cookedSource.id, cookingEventId: event.id,
      expectedRevision: 0, reaction: "good", effort: "about_right", leftovers: "appealing" });
    const nextPlanId = await createGeneratedWeek("home", new Date("2026-10-08T12:00:00Z"));
    expect(nextPlanId).not.toBe(planId);
    expect((await prisma.mealPlan.findUniqueOrThrow({ where: { id: nextPlanId } })).state).toBe("draft");
  }, 60_000);
});
