import { describe, expect, it } from "vitest";
import { householdSettingsSchema, parseHouseholdSettingsForm } from "../../src/schemas/household";
import { validateComponentUse } from "../../src/domain/meals/allocations";
import { scaleQuantity, toBaseQuantity } from "../../src/domain/meals/quantity";
import { validatePlanDraft, type PlanSlotDraft } from "../../src/domain/planning/plan";

const dinner: PlanSlotDraft = {
  id: "dinner-1", planId: "plan-1", householdId: "home", localDate: "2026-09-21",
  mealKind: "dinner", slotType: "cook", recipeId: "recipe-v1", servings: 2,
};
const lunch: PlanSlotDraft = {
  id: "lunch-1", planId: "plan-1", householdId: "home", localDate: "2026-09-22",
  mealKind: "lunch", slotType: "transformed_lunch", recipeId: "lunch-v1", servings: 2,
};
const component = {
  slotId: dinner.id,
  sourceDate: dinner.localDate,
  reservable: true,
  yield: { milli: 4000, unit: "g" as const },
  dinnerUse: { milli: 2000, unit: "g" as const },
  allocations: [{
    sourceSlotId: dinner.id, destinationSlotId: lunch.id, destinationKind: "lunch" as const,
    destinationDate: lunch.localDate, quantity: { milli: 2000, unit: "g" as const },
  }],
};

describe("planning contracts", () => {
  it("accepts a dinner with an allocated next-day lunch", () => {
    expect(() => validatePlanDraft({ householdId: "home", planId: "plan-1", slots: [dinner, lunch], components: [component] })).not.toThrow();
  });

  it("rejects an allocation that double-spends a dinner component", () => {
    expect(() => validateComponentUse({ ...component, allocations: [
      component.allocations[0],
      { ...component.allocations[0], destinationSlotId: "lunch-2", quantity: { milli: 1000, unit: "g" } },
    ] })).toThrow(/more than this component yields/);
  });

  it("rejects a meal slot from another household", () => {
    expect(() => validatePlanDraft({ householdId: "home", planId: "plan-1", slots: [
      { ...dinner, householdId: "someone-else" }, lunch,
    ], components: [component] })).toThrow(/another household/);
  });

  it("rejects a transformed lunch without its source dinner", () => {
    expect(() => validatePlanDraft({ householdId: "home", planId: "plan-1", slots: [lunch], components: [] })).toThrow(/source allocation/);
  });

  it("does not allocate a component that cannot be reserved", () => {
    expect(() => validateComponentUse({ ...component, reservable: false })).toThrow(/cannot be reserved/);
  });

  it("scales exact quantities and rejects incompatible units", () => {
    expect(scaleQuantity({ milli: 1500, unit: "g" }, 3, 2)).toEqual({ milli: 2250, unit: "g" });
    expect(toBaseQuantity({ milli: 1000, unit: "kg" })).toEqual({ milli: 1_000_000, group: "mass" });
    expect(() => validateComponentUse({ ...component, dinnerUse: { milli: 1000, unit: "ml" } })).toThrow(/Cannot combine/);
  });

  it("rejects a weekly setting with no open night", () => {
    expect(householdSettingsSchema.safeParse({ servings: 2, dinnerCount: 7, lunchCount: 2,
      maxDinnerMinutes: 60, varietyPreference: "balanced", exclusions: [],
    }).success).toBe(false);
  });

  it("normalizes exclusions and rejects lunches that dinners cannot supply", () => {
    const fields = new FormData();
    fields.set("servings", "2");
    fields.set("dinnerCount", "1");
    fields.set("lunchCount", "2");
    fields.set("maxDinnerMinutes", "60");
    fields.set("varietyPreference", "balanced");
    fields.set("exclusions", "Mushrooms\n mushrooms, shellfish");
    expect(parseHouseholdSettingsForm(fields).success).toBe(false);
    fields.set("dinnerCount", "3");
    const valid = parseHouseholdSettingsForm(fields);
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.exclusions).toEqual(["mushrooms", "shellfish"]);
  });
});
