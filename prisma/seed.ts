import "dotenv/config";

import { createHash } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingredients, recipes, transformations } from "../src/data/catalog";
import { asMilli, validateCatalog } from "../src/data/validate-catalog";
import { DEFAULT_SETTINGS } from "../src/schemas/household";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

try {
  validateCatalog();
  await prisma.household.upsert({
    where: { id: "home" },
    update: {},
    create: {
      id: "home",
      name: "Our kitchen",
      timezone: "America/Los_Angeles",
      servings: DEFAULT_SETTINGS.servings,
      preferences: {
        create: {
          dinnerCount: DEFAULT_SETTINGS.dinnerCount,
          lunchCount: DEFAULT_SETTINGS.lunchCount,
          maxDinnerMinutes: DEFAULT_SETTINGS.maxDinnerMinutes,
          varietyPreference: DEFAULT_SETTINGS.varietyPreference,
          exclusionsJson: JSON.stringify(DEFAULT_SETTINGS.exclusions),
        },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    for (const ingredient of ingredients) {
      const existing = await tx.ingredient.findUnique({ where: { id: ingredient.key } });
      if (existing) {
        if (existing.name !== ingredient.name || existing.groceryCategory !== ingredient.category || existing.defaultUnit !== ingredient.defaultUnit) {
          throw new Error(`Catalog ingredient changed: ${ingredient.key}. Add a reviewed migration instead of overwriting it.`);
        }
        continue;
      }
      await tx.ingredient.create({ data: {
        id: ingredient.key,
        name: ingredient.name,
        groceryCategory: ingredient.category,
        defaultUnit: ingredient.defaultUnit,
      } });
    }

    for (const recipe of recipes) {
      const id = `${recipe.key}-v${recipe.version}`;
      const contentHash = createHash("sha256").update(JSON.stringify(recipe)).digest("hex");
      const existing = await tx.recipe.findUnique({ where: { recipeKey_version: { recipeKey: recipe.key, version: recipe.version } } });
      if (existing) {
        if (existing.contentHash !== contentHash) throw new Error(`Recipe ${id} changed. Bump its version to preserve planned history.`);
        continue;
      }
      await tx.recipe.create({ data: {
        id,
        recipeKey: recipe.key,
        version: recipe.version,
        title: recipe.title,
        summary: recipe.summary,
        role: recipe.role,
        baseServings: recipe.baseServings,
        activeMinutes: recipe.activeMinutes,
        totalMinutes: recipe.totalMinutes,
        sourceAttribution: "Original Plate Ahead prototype recipe; not kitchen-tested",
        reviewStatus: "reviewed",
        contentHash,
        tags: { create: recipe.tags },
      } });
      for (const component of recipe.components) {
        await tx.recipeComponent.create({ data: {
          id: `${id}-${component.key}`,
          recipeId: id,
          name: component.name,
          baseYieldMilli: asMilli(component.yield).milli,
          yieldUnit: component.yield.unit,
          reservable: component.reservable,
          preparation: component.preparation,
          storageGuidance: component.storageGuidance,
          storageSourceUrl: component.storageSourceUrl,
          ingredients: { create: component.ingredients.map((item) => ({
            ingredientId: item.key,
            quantityMilli: asMilli(item).milli,
            unit: item.unit,
          })) },
        } });
      }
      for (const [index, step] of recipe.steps.entries()) {
        await tx.recipeStep.create({ data: {
          recipeId: id,
          sequence: index + 1,
          text: step.text,
          componentId: step.componentKey ? `${id}-${step.componentKey}` : undefined,
        } });
      }
    }

    for (const transformation of transformations) {
      const source = recipes.find((recipe) => recipe.key === transformation.sourceRecipeKey)!;
      const target = recipes.find((recipe) => recipe.key === transformation.targetRecipeKey)!;
      const id = `${transformation.key}-v${source.version}-v${target.version}`;
      const sourceComponentId = `${source.key}-v${source.version}-${transformation.sourceComponentKey}`;
      const targetComponentId = `${target.key}-v${target.version}-${transformation.targetComponentKey}`;
      const existing = await tx.transformation.findUnique({ where: { id }, include: { inputs: true } });
      if (existing) {
        if (existing.sourceComponentId !== sourceComponentId || existing.targetRecipeKey !== target.key ||
          existing.description !== transformation.description || existing.compatibleState !== transformation.compatibleState ||
          existing.storageGuidance !== transformation.storageGuidance || existing.storageSourceUrl !== transformation.storageSourceUrl ||
          existing.inputs.length !== 1 || existing.inputs[0].targetComponentId !== targetComponentId ||
          existing.inputs[0].requiredMilli !== asMilli(transformation.required).milli || existing.inputs[0].unit !== transformation.required.unit) {
          throw new Error(`Transformation ${id} changed. Bump a recipe version before replacing it.`);
        }
        continue;
      }
      await tx.transformation.create({ data: {
        id,
        sourceComponentId,
        targetRecipeKey: target.key,
        description: transformation.description,
        compatibleState: transformation.compatibleState,
        storageGuidance: transformation.storageGuidance,
        storageSourceUrl: transformation.storageSourceUrl,
        inputs: { create: [{
          targetComponentId,
          requiredMilli: asMilli(transformation.required).milli,
          unit: transformation.required.unit,
        }] },
      } });
    }
  });
  console.log(`Seeded household, ${recipes.length} recipes, and ${transformations.length} lunch transformations.`);
} finally {
  await prisma.$disconnect();
}
