import "server-only";

import { prisma } from "@/services/prisma";

export async function listDinnerRecipes() {
  const [allDinners, transformations, lunches] = await Promise.all([
    prisma.recipe.findMany({
      where: { role: "dinner", reviewStatus: "reviewed" },
      orderBy: [{ title: "asc" }, { version: "desc" }],
      include: { tags: true },
    }),
    prisma.transformation.findMany({ include: { sourceComponent: true } }),
    prisma.recipe.findMany({ where: { role: "lunch", reviewStatus: "reviewed" }, select: { recipeKey: true, title: true, version: true } }),
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

export async function getRecipe(recipeKey: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { recipeKey, reviewStatus: "reviewed" },
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
  const targetRecipes = await prisma.recipe.findMany({ where: { recipeKey: { in: targetKeys }, reviewStatus: "reviewed" }, orderBy: { version: "desc" } });
  const targetByKey = new Map<string, (typeof targetRecipes)[number]>();
  for (const target of targetRecipes) if (!targetByKey.has(target.recipeKey)) targetByKey.set(target.recipeKey, target);

  return {
    recipe,
    outgoing: outgoing.map(({ component, transformation }) => ({ component, transformation, target: targetByKey.get(transformation.targetRecipeKey) })).filter((item) => item.target),
    incoming,
  };
}
