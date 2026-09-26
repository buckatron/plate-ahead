import { z } from "zod";
import { unitSchema, type Unit } from "./quantity";

const componentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  yieldAmount: z.number().min(0).max(100000).refine((value) =>
    Number.isSafeInteger(Math.round(value * 1000)) && Math.abs(Math.round(value * 1000) / 1000 - value) < 0.000001,
  "Use at most three decimal places for the yield."),
  yieldUnit: unitSchema,
  ingredientLines: z.array(z.string().trim().max(500)).max(100),
  preparation: z.string().trim().max(1000).default(""),
  reservable: z.boolean().default(false),
  storageGuidance: z.string().trim().max(1000).default(""),
  storageSourceUrl: z.string().trim().max(2000).default(""),
});

export const draftSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  title: z.string().trim().max(180).default(""),
  summary: z.string().trim().max(1000).default(""),
  role: z.enum(["dinner", "lunch"]).default("dinner"),
  servings: z.number().int().min(0).max(24).default(0),
  totalMinutes: z.number().int().min(0).max(1440).default(0),
  activeMinutes: z.number().int().min(0).max(1440).default(0),
  cuisine: z.string().trim().max(80).default(""),
  reservable: z.boolean().default(false),
  storageGuidance: z.string().trim().max(1000).default(""),
  storageSourceUrl: z.string().trim().max(2000).default(""),
  ingredientLines: z.array(z.string().trim().max(500)).max(100).default([]),
  ingredientChoices: z.record(z.string(), z.object({ ingredientId: z.string().max(150).default(""),
    category: z.string().trim().max(80).default("Other"), original: z.string().max(500).default("") })).default({}),
  components: z.array(componentSchema).max(4).default([]),
  steps: z.array(z.string().trim().max(2000)).max(100).default([]),
  sourceUrl: z.string().trim().max(2000).refine((value) => {
    if (!value) return true;
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  }, "Use a valid http or https source link.").default(""),
  sourceAttribution: z.string().trim().max(300).default(""),
  originalYield: z.string().trim().max(100).default(""),
  origin: z.enum(["manual", "url_import"]).default("manual"),
});
export type RecipeDraftData = z.infer<typeof draftSchema>;

export const blankDraft: RecipeDraftData = {
  schemaVersion: 1,
  title: "", summary: "", role: "dinner", servings: 0, totalMinutes: 0,
  activeMinutes: 0, cuisine: "", ingredientLines: [], ingredientChoices: {}, components: [], steps: [], sourceUrl: "",
  sourceAttribution: "", originalYield: "", origin: "manual", reservable: false,
  storageGuidance: "", storageSourceUrl: "",
};

export function manualDraftFromUrl(rawUrl: string): RecipeDraftData | null {
  if (rawUrl.length > 2000) return null;
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.port) return null;
    url.hash = "";
    return { ...blankDraft, sourceUrl: url.href, sourceAttribution: url.hostname.replace(/^www\./i, "") };
  } catch { return null; }
}

const fractions: Record<string, string> = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅛": "1/8" };
const units: Record<string, { unit: Unit; factor: number }> = {
  g: { unit: "g", factor: 1 }, gram: { unit: "g", factor: 1 }, grams: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 }, kilogram: { unit: "g", factor: 1000 },
  ml: { unit: "ml", factor: 1 }, milliliter: { unit: "ml", factor: 1 }, milliliters: { unit: "ml", factor: 1 },
  l: { unit: "ml", factor: 1000 }, liter: { unit: "ml", factor: 1000 }, liters: { unit: "ml", factor: 1000 },
  tsp: { unit: "ml", factor: 5 }, teaspoon: { unit: "ml", factor: 5 }, teaspoons: { unit: "ml", factor: 5 },
  tbsp: { unit: "ml", factor: 15 }, tablespoon: { unit: "ml", factor: 15 }, tablespoons: { unit: "ml", factor: 15 },
  cup: { unit: "ml", factor: 240 }, cups: { unit: "ml", factor: 240 },
  oz: { unit: "g", factor: 28.3495 }, ounce: { unit: "g", factor: 28.3495 }, ounces: { unit: "g", factor: 28.3495 },
  lb: { unit: "g", factor: 453.592 }, pound: { unit: "g", factor: 453.592 }, pounds: { unit: "g", factor: 453.592 },
  each: { unit: "each", factor: 1 }, piece: { unit: "each", factor: 1 }, pieces: { unit: "each", factor: 1 },
};

function number(raw: string): number {
  return raw.split(/\s+/).reduce((sum, part) => {
    if (part.includes("/")) {
      const [top, bottom] = part.split("/").map(Number);
      return sum + top / bottom;
    }
    return sum + Number(part);
  }, 0);
}

export type ParsedIngredient = { kind: "measured"; original: string; name: string; quantityMilli: number; unit: Unit; preparation: string } |
  { kind: "unmeasured"; original: string; name: string; preparation: string };
export function parseIngredientLine(original: string): ParsedIngredient | { kind: "error"; original: string; error: string } {
  const raw = original.trim().replace(/[½⅓⅔¼¾⅛]/g, (part) => ` ${fractions[part]}`).trim();
  if (!raw) return { kind: "error", original, error: "Enter an ingredient." };
  if (/\b(to taste|as needed)\b/i.test(raw)) {
    const name = raw.replace(/,?\s*(to taste|as needed)\b/ig, "").trim();
    return name ? { kind: "unmeasured", original, name, preparation: "to taste" } :
      { kind: "error", original, error: "Add the ingredient name." };
  }
  if (/\d\s*[–-]\s*\d/.test(raw)) return { kind: "error", original, error: "Choose one amount from this range." };
  if (/\([^)]*\d[^)]*\)\s*(?:cans?|jars?|packages?|bags?)\b/i.test(raw)) {
    return { kind: "error", original, error: "Use the stated package contents as a measured amount, such as 800 g tomatoes." };
  }
  const match = raw.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s+(.*)$/);
  if (!match) return { kind: "error", original, error: "Start with an amount, such as 2 eggs or 150 g rice." };
  const amount = number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "error", original, error: "Check the amount." };
  let rest = match[2].trim();
  const unitMatch = rest.match(/^([A-Za-z]+)\.?\s+(.*)$/);
  const spec = unitMatch ? units[unitMatch[1].toLowerCase()] : undefined;
  if (spec) rest = unitMatch![2];
  else if (/^(can|cans|bunch|bunches|package|packages|pinch|pinches|clove|cloves)\b/i.test(rest)) {
    return { kind: "error", original, error: "Replace the package or bunch with an amount and unit you can shop for." };
  }
  const [name, ...prep] = rest.split(/,\s*/);
  if (!name?.trim()) return { kind: "error", original, error: "Add the ingredient name." };
  const unit = unitSchema.parse(spec?.unit ?? "each");
  const quantityMilli = Math.round(amount * (spec?.factor ?? 1) * 1000);
  if (!Number.isSafeInteger(quantityMilli) || quantityMilli <= 0) return { kind: "error", original, error: "Check the amount." };
  return { kind: "measured", original, name: name.trim(), quantityMilli, unit, preparation: prep.join(", ") };
}

export function recipeIssues(draft: RecipeDraftData): string[] {
  const issues: string[] = [];
  if (!draft.title) issues.push("Add a title.");
  if (draft.servings < 1) issues.push("Confirm how many people the recipe serves.");
  if (draft.totalMinutes < 1) issues.push("Add the total cooking time.");
  if (draft.activeMinutes > draft.totalMinutes && draft.totalMinutes > 0) issues.push("Active time cannot exceed total time.");
  if (!draft.ingredientLines.length && !draft.components.length) issues.push("Add ingredients, one per line.");
  if (!draft.steps.length) issues.push("Add instructions, one step per line.");
  if (!draft.components.length && draft.reservable && (!draft.storageGuidance || !/^https?:\/\//.test(draft.storageSourceUrl))) {
    issues.push("Add storage guidance and an http or https source before reserving food for lunch.");
  }
  (draft.components.length ? [] : draft.ingredientLines).forEach((line, index) => {
    const parsed = parseIngredientLine(line);
    if (parsed.kind === "error") issues.push(`Ingredient ${index + 1}: ${parsed.error}`);
  });
  draft.components.forEach((component, componentIndex) => {
    if (component.yieldAmount < 0.001) issues.push(`Component ${componentIndex + 1}: add a positive yield.`);
    if (!component.ingredientLines.length) issues.push(`Component ${componentIndex + 1}: add ingredients.`);
    if (component.reservable && (!component.storageGuidance || !/^https?:\/\//.test(component.storageSourceUrl))) {
      issues.push(`Component ${componentIndex + 1}: add storage guidance and its source.`);
    }
    component.ingredientLines.forEach((line, index) => {
      const parsed = parseIngredientLine(line);
      if (parsed.kind === "error") issues.push(`Component ${componentIndex + 1}, ingredient ${index + 1}: ${parsed.error}`);
    });
  });
  return issues;
}
