import { z } from "zod";
import { validateComponentUse, type ComponentUse } from "../meals/allocations";

const localDateSchema = z.iso.date();

const slotSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  householdId: z.string().min(1),
  localDate: localDateSchema,
  mealKind: z.enum(["dinner", "lunch"]),
  slotType: z.enum(["cook", "transformed_lunch", "eat_out", "flexible"]),
  recipeId: z.string().min(1).nullable(),
  servings: z.number().int().positive().nullable(),
});

export type PlanSlotDraft = z.infer<typeof slotSchema>;

export function validatePlanDraft(input: {
  householdId: string;
  planId: string;
  slots: PlanSlotDraft[];
  components: ComponentUse[];
}): void {
  const seen = new Set<string>();
  const slotById = new Map<string, PlanSlotDraft>();

  for (const candidate of input.slots) {
    const slot = slotSchema.parse(candidate);
    if (slot.householdId !== input.householdId || slot.planId !== input.planId) {
      throw new Error("A plan cannot contain a slot from another household or plan.");
    }
    const key = `${slot.localDate}:${slot.mealKind}`;
    if (seen.has(key) || slotById.has(slot.id)) throw new Error("Duplicate meal slot in plan.");
    seen.add(key);
    slotById.set(slot.id, slot);

    if (slot.slotType === "cook" || slot.slotType === "transformed_lunch") {
      if (!slot.recipeId || !slot.servings) throw new Error("A cooked meal needs a recipe and serving count.");
    } else if (slot.recipeId || slot.servings) {
      throw new Error("Eating out and flexible slots cannot contain a recipe or servings.");
    }
    if (slot.slotType === "transformed_lunch" && slot.mealKind !== "lunch") {
      throw new Error("Transformed meals must be lunches.");
    }
    if (slot.slotType === "eat_out" && slot.mealKind !== "dinner") {
      throw new Error("Eating out belongs in a dinner slot.");
    }
  }

  const fedLunches = new Set<string>();
  for (const component of input.components) {
    const source = slotById.get(component.slotId);
    if (!source || source.slotType !== "cook" || source.mealKind !== "dinner") {
      throw new Error("Allocated food must come from a cooked dinner in this plan.");
    }
    if (source.localDate !== component.sourceDate) throw new Error("Component date does not match its dinner.");
    for (const allocation of component.allocations) {
      const destination = slotById.get(allocation.destinationSlotId);
      if (!destination || destination.slotType !== "transformed_lunch") {
        throw new Error("Allocation must point to a transformed lunch in this plan.");
      }
      if (destination.localDate !== allocation.destinationDate) throw new Error("Lunch date does not match allocation.");
      fedLunches.add(destination.id);
    }
    validateComponentUse(component);
  }

  for (const slot of input.slots) {
    if (slot.slotType === "transformed_lunch" && !fedLunches.has(slot.id)) {
      throw new Error("A transformed lunch needs at least one source allocation.");
    }
  }
}
