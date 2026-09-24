import { z } from "zod";

export const householdSettingsSchema = z.object({
  servings: z.number().int().min(1).max(12),
  dinnerCount: z.number().int().min(0).max(7),
  lunchCount: z.number().int().min(0).max(14),
  maxDinnerMinutes: z.number().int().min(10).max(240),
  varietyPreference: z.enum(["familiar", "balanced", "adventurous"]),
  exclusions: z.array(z.string().trim().min(1).max(80)).max(30),
}).refine((settings) => settings.dinnerCount + 1 <= 7, {
  message: "Leave at least one dinner slot for eating out or a flexible night.",
  path: ["dinnerCount"],
}).refine((settings) => settings.lunchCount <= settings.dinnerCount, {
  message: "Transformed lunches cannot exceed the number of dinners.",
  path: ["lunchCount"],
});

export type HouseholdSettings = z.infer<typeof householdSettingsSchema>;

export const DEFAULT_SETTINGS: HouseholdSettings = {
  servings: 2,
  dinnerCount: 6,
  lunchCount: 2,
  maxDinnerMinutes: 60,
  varietyPreference: "balanced",
  exclusions: [],
};

export function parseHouseholdSettingsForm(formData: FormData) {
  const numberField = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  };
  const exclusionsInput = formData.get("exclusions");
  const exclusions = typeof exclusionsInput === "string"
    ? [...new Map(exclusionsInput.split(/[\n,]/).map((value) => value.trim()).filter(Boolean)
      .map((value) => [value.toLocaleLowerCase(), value])).values()]
    : [];

  return householdSettingsSchema.safeParse({
    servings: numberField("servings"),
    dinnerCount: numberField("dinnerCount"),
    lunchCount: numberField("lunchCount"),
    maxDinnerMinutes: numberField("maxDinnerMinutes"),
    varietyPreference: formData.get("varietyPreference"),
    exclusions,
  });
}
