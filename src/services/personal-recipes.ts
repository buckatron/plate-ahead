import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { blankDraft, draftSchema, parseIngredientLine, recipeIssues, type RecipeDraftData } from "@/domain/meals/personal-recipe";
import { toBaseQuantity } from "@/domain/meals/quantity";
import { decodeRecipeText } from "@/domain/meals/recipe-jsonld";
import { prisma } from "@/services/prisma";

export class PersonalRecipeError extends Error {}

export async function createDraft(householdId: string, payload: RecipeDraftData = blankDraft, sourceSnapshot?: {
  submittedUrl: string; finalUrl: string; importedAt: string; title: string; yieldText: string;
  ingredientLines: string[]; steps: string[]; extractionMethod: string;
}) {
  return prisma.recipeDraft.create({ data: { householdId, payloadJson: JSON.stringify(draftSchema.parse(payload)),
    sourceSnapshotJson: sourceSnapshot ? JSON.stringify(sourceSnapshot) : null } });
}

export async function findDraft(householdId: string, id: string) {
  const row = await prisma.recipeDraft.findFirst({ where: { id, householdId }, include: { entry: true } });
  return row ? { ...row, payload: draftSchema.parse(JSON.parse(row.payloadJson)) } : null;
}

export async function saveDraft(householdId: string, id: string, revision: number, payload: RecipeDraftData) {
  const parsed = draftSchema.parse(payload);
  const result = await prisma.recipeDraft.updateMany({ where: { id, householdId, revision },
    data: { payloadJson: JSON.stringify(parsed), revision: { increment: 1 } } });
  if (result.count !== 1) throw new PersonalRecipeError("This draft changed. Refresh it before saving.");
}

export async function createRevisionDraft(householdId: string, entryId: string) {
  const entry = await prisma.recipeEntry.findFirst({ where: { id: entryId, householdId },
    include: { versions: { orderBy: { version: "desc" }, take: 1, include: {
      tags: true, steps: { orderBy: { sequence: "asc" } },
      components: { include: { ingredients: { include: { ingredient: true } } } },
    } } } });
  const recipe = entry?.versions[0];
  if (!entry || !recipe) throw new PersonalRecipeError("Recipe not found.");
  const activeDraft = await prisma.recipeDraft.findFirst({ where: { householdId, entryId }, orderBy: { updatedAt: "desc" } });
  if (activeDraft) return activeDraft;
  const linesFor = (component: typeof recipe.components[number]) => component.ingredients.map((item) =>
    item.originalText ?? (item.quantityMilli === null ? `${item.ingredient.name} to taste` :
    `${item.quantityMilli / 1000} ${item.unit === "each" ? "" : `${item.unit} `}${item.ingredient.name}${item.preparation ? `, ${item.preparation}` : ""}`));
  const advanced = recipe.components.length > 1 || recipe.components[0]?.name !== "Whole recipe";
  const payload: RecipeDraftData = {
    schemaVersion: 1,
    title: recipe.title, summary: decodeRecipeText(recipe.summary), role: recipe.role === "lunch" ? "lunch" : "dinner",
    servings: recipe.baseServings, totalMinutes: recipe.totalMinutes, activeMinutes: recipe.activeMinutes,
    cuisine: recipe.tags.find((tag) => tag.dimension === "cuisine")?.value ?? "",
    ingredientLines: advanced ? [] : recipe.components.flatMap(linesFor), ingredientChoices: {},
    components: advanced ? recipe.components.map((component) => ({ name: component.name,
      yieldAmount: component.baseYieldMilli / 1000, yieldUnit: component.yieldUnit as "g" | "kg" | "ml" | "l" | "each" | "portion",
      ingredientLines: linesFor(component), preparation: component.preparation,
      reservable: component.reservable, storageGuidance: component.storageGuidance ?? "",
      storageSourceUrl: component.storageSourceUrl ?? "" })) : [],
    steps: recipe.steps.map((step) => step.text), sourceUrl: recipe.sourceUrl ?? "",
    sourceAttribution: recipe.sourceAttribution ?? "", originalYield: "", origin: entry.origin === "url_import" ? "url_import" : "manual",
    reservable: recipe.components[0]?.reservable ?? false,
    storageGuidance: recipe.components[0]?.storageGuidance ?? "",
    storageSourceUrl: recipe.components[0]?.storageSourceUrl ?? "",
  };
  return prisma.recipeDraft.create({ data: { householdId, entryId, basedOnRecipeId: recipe.id,
    payloadJson: JSON.stringify(payload), sourceSnapshotJson: recipe.sourceSnapshotJson } });
}

export async function publishDraft(householdId: string, id: string, revision: number) {
  const row = await findDraft(householdId, id);
  if (!row || row.revision !== revision) throw new PersonalRecipeError("This draft changed. Refresh it before publishing.");
  const payload = row.payload;
  const issues = recipeIssues(payload);
  if (issues.length) throw new PersonalRecipeError(issues.join(" "));
  const componentSpecs = payload.components.length ? payload.components : [{ name: "Whole recipe",
    yieldAmount: payload.servings, yieldUnit: "portion" as const, ingredientLines: payload.ingredientLines,
    preparation: "Follow the recipe steps.", reservable: payload.reservable,
    storageGuidance: payload.storageGuidance, storageSourceUrl: payload.storageSourceUrl }];
  const entryId = row.entryId ?? randomUUID();
  const recipeKey = row.entry?.recipeKey ?? `personal-${entryId}`;
  const recipeId = randomUUID();
  await prisma.$transaction(async (tx) => {
    const draft = await tx.recipeDraft.findFirst({ where: { id, householdId, revision } });
    if (!draft) throw new PersonalRecipeError("This draft changed. Refresh it before publishing.");
    const entry = row.entryId ? await tx.recipeEntry.findFirst({ where: { id: row.entryId, householdId } }) : null;
    if (row.entryId && (!entry || entry.currentRecipeId !== row.basedOnRecipeId)) {
      throw new PersonalRecipeError("This recipe was updated elsewhere. Refresh your draft.");
    }
    if (!entry) await tx.recipeEntry.create({ data: { id: entryId, householdId, recipeKey, origin: payload.origin } });
    const version = entry ? (await tx.recipe.aggregate({ where: { entryId }, _max: { version: true } }))._max.version! + 1 : 1;
    const allIngredients = await tx.ingredient.findMany();
    const componentRows = [];
    for (const [componentIndex, component] of componentSpecs.entries()) {
      const parsed = component.ingredientLines.map(parseIngredientLine);
      if (parsed.some((item) => item.kind === "error")) throw new PersonalRecipeError("Review the ingredient amounts.");
      const ingredients = parsed.filter((item): item is Exclude<typeof item, { kind: "error" }> => item.kind !== "error");
      const items = [];
      for (const [itemIndex, item] of ingredients.entries()) {
      let unit = item.kind === "measured" ? item.unit : "each";
      const group = toBaseQuantity({ milli: 1000, unit }).group;
      const savedChoice = payload.ingredientChoices[`${payload.components.length ? componentIndex : "base"}:${itemIndex}`];
      const choice = savedChoice?.original === item.original ? savedChoice : undefined;
      let ingredient = choice?.ingredientId ? allIngredients.find((candidate) => candidate.id === choice.ingredientId) : undefined;
      if (choice?.ingredientId && !ingredient) throw new PersonalRecipeError("An ingredient match changed. Review the ingredient list.");
      if (ingredient && item.kind === "measured" &&
        toBaseQuantity({ milli: 1000, unit: ingredient.defaultUnit as typeof unit }).group !== group) {
        throw new PersonalRecipeError(`The selected match for ${item.name} uses an incompatible unit.`);
      }
      ingredient ??= allIngredients.find((candidate) => candidate.name.toLocaleLowerCase() === item.name.toLocaleLowerCase() &&
        (item.kind === "unmeasured" || toBaseQuantity({ milli: 1000, unit: candidate.defaultUnit as typeof unit }).group === group));
      if (ingredient && item.kind === "unmeasured") unit = ingredient.defaultUnit as typeof unit;
      if (!ingredient) {
        const conflictingName = allIngredients.some((candidate) => candidate.name.toLocaleLowerCase() === item.name.toLocaleLowerCase());
        ingredient = await tx.ingredient.create({ data: { id: `personal-ingredient-${randomUUID()}`,
          name: conflictingName ? `${item.name} (${unit})` : item.name,
          defaultUnit: unit, groceryCategory: choice?.category || "Other" } });
        allIngredients.push(ingredient);
      }
        items.push({ ingredientId: ingredient.id, quantityMilli: item.kind === "measured" ? item.quantityMilli : null,
          unit, amountKind: item.kind, originalText: item.original, preparation: item.preparation || null });
      }
      componentRows.push({ name: component.name, baseYieldMilli: Math.round(component.yieldAmount * 1000),
        yieldUnit: component.yieldUnit, reservable: component.reservable, preparation: component.preparation,
        storageGuidance: component.storageGuidance || null, storageSourceUrl: component.storageSourceUrl || null,
        ingredients: { create: items } });
    }
    const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    await tx.recipe.create({ data: {
      id: recipeId, entryId, recipeKey, version, title: payload.title,
      summary: payload.summary || "From your recipe collection", role: payload.role,
      baseServings: payload.servings, activeMinutes: payload.activeMinutes,
      totalMinutes: payload.totalMinutes, sourceUrl: payload.sourceUrl || null,
      sourceAttribution: payload.sourceAttribution || "Written in your kitchen",
      reviewStatus: "reviewed", contentHash: hash,
      sourceSnapshotJson: row.sourceSnapshotJson,
      tags: payload.cuisine ? { create: [{ dimension: "cuisine", value: payload.cuisine }] } : undefined,
      components: { create: componentRows },
      steps: { create: payload.steps.map((text, index) => ({ sequence: index + 1, text })) },
    } });
    await tx.recipeEntry.update({ where: { id: entryId }, data: { currentRecipeId: recipeId, archivedAt: null } });
    await tx.recipeDraft.delete({ where: { id } });
  });
  return recipeKey;
}

export async function setRecipeArchived(householdId: string, entryId: string, archived: boolean) {
  const result = await prisma.recipeEntry.updateMany({ where: { id: entryId, householdId },
    data: { archivedAt: archived ? new Date() : null } });
  if (result.count !== 1) throw new PersonalRecipeError("Recipe not found.");
}

export async function pairPersonalRecipes(input: { householdId: string; sourceComponentId: string; targetComponentId: string;
  requiredAmount: number; description: string; compatibleState: string }) {
  if (!Number.isFinite(input.requiredAmount) || input.requiredAmount <= 0 || input.requiredAmount > 100000 ||
    !input.description.trim() || !input.compatibleState.trim()) {
    throw new PersonalRecipeError("Enter the required dinner portions and describe how the lunch reuses them.");
  }
  const [source, target] = await Promise.all([
    prisma.recipeComponent.findFirst({ where: { id: input.sourceComponentId, reservable: true,
      recipe: { role: "dinner", entry: { householdId: input.householdId, archivedAt: null } } },
      include: { recipe: { include: { entry: true } } } }),
    prisma.recipeComponent.findFirst({ where: { id: input.targetComponentId,
      recipe: { role: "lunch", entry: { householdId: input.householdId, archivedAt: null } } },
      include: { recipe: { include: { entry: true } } } }),
  ]);
  const dinner = source?.recipe;
  const lunch = target?.recipe;
  if (!dinner || !lunch || dinner.entry?.currentRecipeId !== dinner.id || lunch.entry?.currentRecipeId !== lunch.id ||
    !source || !target ||
    !source.storageGuidance || !source.storageSourceUrl) {
    throw new PersonalRecipeError("Choose current personal recipes with a dinner marked for reservation and storage guidance.");
  }
  const existing = await prisma.transformation.findFirst({ where: { sourceComponentId: source.id, targetRecipeKey: lunch.recipeKey } });
  if (existing) throw new PersonalRecipeError("These recipe versions are already paired.");
  await prisma.transformation.create({ data: {
    sourceComponentId: source.id, targetRecipeKey: lunch.recipeKey,
    description: input.description.trim(), compatibleState: input.compatibleState.trim(),
    storageGuidance: source.storageGuidance, storageSourceUrl: source.storageSourceUrl,
    inputs: { create: [{ targetComponentId: target.id, requiredMilli: Math.round(input.requiredAmount * 1000), unit: source.yieldUnit }] },
  } });
}
