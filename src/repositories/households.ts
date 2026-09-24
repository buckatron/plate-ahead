import "server-only";

import { prisma } from "@/services/prisma";
import { householdSettingsSchema } from "@/schemas/household";
import type { HouseholdSettings } from "@/schemas/household";

// A private single-household prototype. Every read takes an explicit household ID.
export async function findHousehold(householdId: string) {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: { preferences: true },
  });
  if (!household || !household.preferences) return null;

  const settings = householdSettingsSchema.parse({
    servings: household.servings,
    dinnerCount: household.preferences.dinnerCount,
    lunchCount: household.preferences.lunchCount,
    maxDinnerMinutes: household.preferences.maxDinnerMinutes,
    varietyPreference: household.preferences.varietyPreference,
    exclusions: JSON.parse(household.preferences.exclusionsJson) as unknown,
  });

  return { id: household.id, name: household.name, timezone: household.timezone, settings };
}

export async function saveHouseholdSettings(householdId: string, settings: HouseholdSettings) {
  const validated = householdSettingsSchema.parse(settings);
  await prisma.$transaction(async (tx) => {
    await tx.household.update({ where: { id: householdId }, data: { servings: validated.servings } });
    await tx.householdPreferences.update({ where: { householdId }, data: {
      dinnerCount: validated.dinnerCount,
      lunchCount: validated.lunchCount,
      maxDinnerMinutes: validated.maxDinnerMinutes,
      varietyPreference: validated.varietyPreference,
      exclusionsJson: JSON.stringify(validated.exclusions),
    } });
  });
}
