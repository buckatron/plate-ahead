import "server-only";

import { addDays } from "@/domain/planning/generate-week";
import { validatePlanDraft, type PlanSlotDraft } from "@/domain/planning/plan";
import type { ComponentUse } from "@/domain/meals/allocations";
import { scaleQuantity, unitSchema } from "@/domain/meals/quantity";
import { householdSettingsSchema } from "@/schemas/household";
import { prisma } from "@/services/prisma";

export class PlanAcceptanceError extends Error {}

export async function acceptPlan(householdId: string, planId: string, expectedRevision: number): Promise<void> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new PlanAcceptanceError("Refresh the plan and try again.");

  await prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.findFirst({
      where: { id: planId, householdId },
      include: { slots: { include: { recipe: true, components: { include: {
        recipeComponent: true,
        outgoingAllocations: { include: { destinationSlot: { include: { recipe: true } }, transformation: { include: { inputs: { include: { targetComponent: true } } } } } },
      } } } } },
    });
    if (!plan) throw new PlanAcceptanceError("This draft is no longer available.");
    if (plan.state !== "draft" || plan.revision !== expectedRevision) {
      throw new PlanAcceptanceError("This draft changed in another tab. Refresh before accepting it.");
    }

    try {
      const settings = householdSettingsSchema.parse(JSON.parse(plan.settingsJson) as unknown);
      const dinners = plan.slots.filter((slot) => slot.mealKind === "dinner");
      const lunches = plan.slots.filter((slot) => slot.mealKind === "lunch");
      if (dinners.length !== 7 || dinners.filter((slot) => slot.slotType === "cook").length !== settings.dinnerCount ||
        dinners.filter((slot) => slot.slotType === "eat_out").length !== 1 ||
        lunches.length !== settings.lunchCount || lunches.some((slot) => slot.slotType !== "transformed_lunch") ||
        dinners.some((slot) => !["cook", "eat_out", "flexible"].includes(slot.slotType)) ||
        plan.slots.some((slot) => slot.localDate < plan.weekStart || slot.localDate > addDays(plan.weekStart, 6) || slot.status !== "planned")) {
        throw new Error("The week is incomplete.");
      }
      const slots: PlanSlotDraft[] = plan.slots.map((slot) => ({
        id: slot.id, planId: slot.planId, householdId, localDate: slot.localDate,
        mealKind: slot.mealKind as PlanSlotDraft["mealKind"],
        slotType: slot.slotType as PlanSlotDraft["slotType"],
        recipeId: slot.recipeId, servings: slot.servings,
      }));
      const components: ComponentUse[] = [];
      for (const slot of plan.slots) {
        if ((slot.slotType === "cook" || slot.slotType === "transformed_lunch") && slot.components.length === 0) {
          throw new Error("A cooked meal is missing its components.");
        }
        for (const component of slot.components) {
          if (component.recipeComponent.recipeId !== slot.recipeId) throw new Error("A meal component belongs to another recipe.");
          if (slot.slotType !== "cook") {
            if (component.outgoingAllocations.length) throw new Error("Only dinners can supply lunches.");
            continue;
          }
          const unit = unitSchema.parse(component.unit);
          for (const allocation of component.outgoingAllocations) {
            const input = allocation.transformation.inputs[0];
            const destinationRecipe = allocation.destinationSlot.recipe;
            if (!destinationRecipe || allocation.transformation.sourceComponentId !== component.recipeComponentId ||
              allocation.transformation.targetRecipeKey !== destinationRecipe.recipeKey ||
              allocation.transformation.inputs.length !== 1 ||
              input.targetComponent.recipeId !== destinationRecipe.id ||
              allocation.unit !== component.unit || input.unit !== component.unit ||
              allocation.destinationSlot.servings === null ||
              allocation.reservedMilli !== scaleQuantity({ milli: input.requiredMilli, unit },
                allocation.destinationSlot.servings, destinationRecipe.baseServings).milli) {
              throw new Error("A lunch link does not match its dinner component.");
            }
          }
          components.push({ slotId: slot.id, sourceDate: slot.localDate,
            reservable: component.recipeComponent.reservable,
            yield: { milli: component.plannedYieldMilli, unit },
            dinnerUse: { milli: component.mealUseMilli, unit },
            allocations: component.outgoingAllocations.map((allocation) => ({
              sourceSlotId: slot.id, destinationSlotId: allocation.destinationSlotId,
              destinationKind: "lunch" as const, destinationDate: allocation.destinationSlot.localDate,
              quantity: { milli: allocation.reservedMilli, unit: unitSchema.parse(allocation.unit) },
            })),
          });
        }
      }
      validatePlanDraft({ householdId, planId, slots, components });
    } catch {
      throw new PlanAcceptanceError("This draft has an incomplete meal or lunch link. Generate a new draft before accepting it.");
    }

    await tx.mealPlan.updateMany({
      where: { householdId, weekStart: plan.weekStart, state: "active" },
      data: { state: "archived", revision: { increment: 1 } },
    });
    const accepted = await tx.mealPlan.updateMany({
      where: { id: planId, householdId, state: "draft", revision: expectedRevision },
      data: { state: "active", revision: { increment: 1 } },
    });
    if (accepted.count !== 1) throw new PlanAcceptanceError("This draft changed in another tab. Refresh before accepting it.");
  });
}
