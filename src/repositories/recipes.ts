import "server-only";

import { prisma } from "@/services/prisma";
import { recipeVisibility } from "./recipe-visibility";

export async function listDinnerRecipes(householdId = "home") {
  const where = await recipeVisibility(householdId, false);
  const [allDinners, transformations, lunches] = await Promise.all([
    prisma.recipe.findMany({
      where: { AND: [where, { role: "dinner" }] },
      orderBy: [{ title: "asc" }, { version: "desc" }],
      include: { tags: true },
    }),
    prisma.transformation.findMany({ include: { sourceComponent: true } }),
    prisma.recipe.findMany({ where: { AND: [where, { role: "lunch" }] }, select: { recipeKey: true, title: true, version: true } }),
  ]);
  const latest = new Map<string, (typeof allDinners)[number]>();
  for (const recipe of allDinners) if (!latest.has(recipe.recipeKey)) latest.set(recipe.recipeKey, recipe);
  const lunchNames = new Map(lunches.map((recipe) => [recipe.recipeKey, recipe.title]));

  return [...latest.values()].map((recipe) => ({
    ...recipe,
    lunches: transformations
      .filter((transformation) => transformation.sourceComponent.recipeId === recipe.id)
      .map((transformation) => ({ title: lunchNames.get(transformation.targetRecipeKey) ?? transformation.targetRecipeKey, key: transformation.targetRecipeKey })),
  }));
}

export async function getRecipe(recipeKey: string, householdId = "home", version?: number) {
  const entry = version ? null : await prisma.recipeEntry.findFirst({ where: { recipeKey, householdId },
    select: { currentRecipeId: true } });
  const recipe = await prisma.recipe.findFirst({
    where: { recipeKey, version, id: entry?.currentRecipeId ?? undefined,
      reviewStatus: "reviewed", OR: [{ entryId: null }, { entry: { householdId } }] },
    orderBy: { version: "desc" },
    include: {
      tags: true,
      steps: { orderBy: { sequence: "asc" } },
      components: {
        include: {
          ingredients: { include: { ingredient: true } },
          sourceTransformations: { include: { inputs: true } },
        },
      },
    },
  });
  if (!recipe) return null;

  const outgoing = recipe.components.flatMap((component) => component.sourceTransformations.map((transformation) => ({ component, transformation })));
  const incoming = await prisma.transformation.findMany({
    where: { targetRecipeKey: recipeKey },
    include: { inputs: true, sourceComponent: { include: { recipe: true } } },
  });
  const targetKeys = outgoing.map(({ transformation }) => transformation.targetRecipeKey);
  const targetRecipes = await prisma.recipe.findMany({ where: { recipeKey: { in: targetKeys }, reviewStatus: "reviewed",
    OR: [{ entryId: null }, { entry: { householdId } }] }, orderBy: { version: "desc" },
    include: { components: { select: { id: true } } } });

  return {
    recipe,
    outgoing: outgoing.map(({ component, transformation }) => ({ component, transformation,
      target: targetRecipes.find((candidate) => candidate.recipeKey === transformation.targetRecipeKey &&
        transformation.inputs.every((input) => candidate.components.some((item) => item.id === input.targetComponentId))) })).filter((item) => item.target),
    incoming,
  };
}
