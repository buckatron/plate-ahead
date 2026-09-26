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
});
