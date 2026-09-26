import "server-only";

import { aggregateGroceryNeeds, unmeasuredGroceryNeeds, type GroceryComponent } from "@/domain/meals/groceries";
import { parseIngredientLine } from "@/domain/meals/personal-recipe";
import { findUnallocatedPurchases, parseOnHandAmount, reviewGroceryNeed } from "@/domain/meals/grocery-review";
import { toBaseQuantity, unitSchema } from "@/domain/meals/quantity";
import { prisma } from "@/services/prisma";

export class GroceryActionError extends Error {}

export async function getGroceryNeeds(householdId: string, planId: string) {
  const plan = await prisma.mealPlan.findFirst({
    where: { id: planId, householdId },
    include: { groceryList: { include: { lines: { include: { ingredient: true } } } }, slots: { include: {
      recipe: true,
      components: { include: { recipeComponent: { include: { ingredients: { include: { ingredient: true } } } } } },
    } } },
  });
  if (!plan) return null;

  const components: GroceryComponent[] = [];
  const reviewLines = new Map<string, { recipeKey: string; recipeTitle: string; version: number; line: string }>();
  for (const slot of plan.slots) {
    if (!["planned", "needs_attention", "cooked", "eaten"].includes(slot.status) || !slot.recipe) continue;
    for (const planned of slot.components) {
      const source = planned.recipeComponent;
      if (source.recipeId !== slot.recipeId) throw new Error("A planned component does not match its recipe.");
      if (slot.recipe.entryId) for (const item of source.ingredients) {
        if (item.originalText && parseIngredientLine(item.originalText).kind === "error") {
          reviewLines.set(`${slot.recipeId}:${item.originalText}`, { recipeKey: slot.recipe.recipeKey,
            recipeTitle: slot.recipe.title, version: slot.recipe.version, line: item.originalText });
        }
      }
      components.push({
        slotId: slot.id, localDate: slot.localDate,
        mealKind: slot.mealKind === "lunch" ? "lunch" : "dinner", recipeTitle: slot.recipe.title,
        baseYield: { milli: source.baseYieldMilli, unit: unitSchema.parse(source.yieldUnit) },
        plannedYield: { milli: planned.plannedYieldMilli, unit: unitSchema.parse(planned.unit) },
        ingredients: source.ingredients.map((item) => ({
          ingredientId: item.ingredientId, name: item.ingredient.name,
          category: item.ingredient.groceryCategory,
          quantity: item.quantityMilli === null ? null : { milli: item.quantityMilli, unit: unitSchema.parse(item.unit) },
          optional: item.optional,
        })),
      });
    }
  }

  const savedLines = new Map(plan.groceryList?.lines.map((line) => [`${line.ingredientId}:${line.unitGroup}`, line]) ?? []);
  const needs = aggregateGroceryNeeds(components);
  const unmeasured = unmeasuredGroceryNeeds(components);
  return { plan: { id: plan.id, weekStart: plan.weekStart, state: plan.state, revision: plan.revision },
    reviewLines: [...reviewLines.values()],
    unmeasured: unmeasured.map((item) => ({ ...item, checked: savedLines.get(`${item.ingredientId}:unmeasured`)?.checked ?? false })),
    needs: needs.map((need) => reviewGroceryNeed(need, savedLines.get(need.key))),
    unallocatedPurchased: findUnallocatedPurchases([...needs, ...unmeasured.map((item) => ({
      key: `${item.ingredientId}:unmeasured` }))], plan.groceryList?.lines.map((line) => ({
      ingredientId: line.ingredientId, unitGroup: line.unitGroup, checked: line.checked,
      name: line.ingredient.name, category: line.ingredient.groceryCategory,
    })) ?? []) };
}

async function mutateGroceryLine(input: {
  householdId: string; planId: string; expectedRevision: number; ingredientId: string; unitGroup: string;
  change: { onHandMilli: number | null } | { checked: boolean };
}) {
  const snapshot = await getGroceryNeeds(input.householdId, input.planId);
  if (!snapshot) throw new GroceryActionError("This plan is no longer available.");
  if (snapshot.plan.revision !== input.expectedRevision) throw new GroceryActionError("The plan changed. Refresh groceries before saving.");
  const need = snapshot.needs.find((line) => line.ingredientId === input.ingredientId && toBaseQuantity(line.quantity).group === input.unitGroup);
  const unmeasuredNeed = input.unitGroup === "unmeasured" && snapshot.unmeasured.some((item) => item.ingredientId === input.ingredientId);
  if (unmeasuredNeed && "onHandMilli" in input.change) throw new GroceryActionError("This ingredient has no measured amount. Use its shopping check instead.");
  const clearingUnallocated = !need && "checked" in input.change && !input.change.checked &&
    snapshot.unallocatedPurchased.some((line) => line.ingredientId === input.ingredientId && line.unitGroup === input.unitGroup);
  if (!need && !unmeasuredNeed && !clearingUnallocated) throw new GroceryActionError("That ingredient is not in this plan. Refresh groceries before saving.");

  await prisma.$transaction(async (tx) => {
    const currentPlan = await tx.mealPlan.findFirst({ where: { id: input.planId, householdId: input.householdId }, select: { revision: true } });
    if (!currentPlan || currentPlan.revision !== input.expectedRevision) {
      throw new GroceryActionError("The plan changed. Refresh groceries before saving.");
    }
    const list = await tx.groceryList.upsert({
      where: { planId: input.planId },
      create: { householdId: input.householdId, planId: input.planId, generatedRevision: input.expectedRevision },
      update: { generatedRevision: input.expectedRevision },
    });
    if (clearingUnallocated) {
      const cleared = await tx.groceryLine.updateMany({ where: { listId: list.id, ingredientId: input.ingredientId,
        unitGroup: input.unitGroup, checked: true }, data: { checked: false } });
      if (cleared.count !== 1) throw new GroceryActionError("This purchase check changed. Refresh groceries before saving.");
    } else {
      await tx.groceryLine.upsert({
        where: { listId_ingredientId_unitGroup: { listId: list.id, ingredientId: input.ingredientId, unitGroup: input.unitGroup } },
        create: { listId: list.id, ingredientId: input.ingredientId, unitGroup: input.unitGroup, ...input.change },
        update: input.change,
      });
    }
  });
}

export async function saveGroceryOnHand(input: {
  householdId: string; planId: string; expectedRevision: number; ingredientId: string; unitGroup: string; rawAmount: string;
}) {
  let onHandMilli: number | null;
  try {
    onHandMilli = parseOnHandAmount(input.rawAmount);
  } catch (cause) {
    throw new GroceryActionError(cause instanceof Error ? cause.message : "Check the on-hand amount.");
  }
  await mutateGroceryLine({ ...input, change: { onHandMilli } });
}

export async function setGroceryPurchased(input: {
  householdId: string; planId: string; expectedRevision: number; ingredientId: string; unitGroup: string; checked: boolean;
}) {
  await mutateGroceryLine({ ...input, change: { checked: input.checked } });
}
