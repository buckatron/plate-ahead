import { blankDraft, type RecipeDraftData } from "./personal-recipe";

function clean(value: unknown): string {
  if (typeof value === "string") return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (typeof value === "number") return String(value);
  return "";
}
type Json = Record<string, unknown>;
function object(value: unknown): value is Json { return !!value && typeof value === "object" && !Array.isArray(value); }
function recipesIn(value: unknown, depth = 0): Json[] {
  if (depth > 8) return [];
  if (Array.isArray(value)) return value.flatMap((item) => recipesIn(item, depth + 1));
  if (!object(value)) return [];
  const type = value["@type"];
  if (type === "Recipe" || Array.isArray(type) && type.includes("Recipe")) return [value];
  return Object.values(value).flatMap((item) => recipesIn(item, depth + 1));
}
function instructionSteps(value: unknown): string[] {
  if (typeof value === "string") return value.split(/\n+/).map(clean).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(instructionSteps);
  if (!object(value)) return [];
  const type = value["@type"];
  if (type === "HowToSection") return [clean(value.name), ...instructionSteps(value.itemListElement)].filter(Boolean);
  if (type === "HowToStep") return [clean(value.text || value.name)].filter(Boolean);
  return instructionSteps(value.itemListElement ?? value.text);
}
function minutes(value: unknown): number {
  const raw = clean(value);
  const match = raw.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/i);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : 0;
}
function ingredientLine(value: unknown): string {
  if (!object(value)) return clean(value);
  const name = clean(value.name);
  const amount = clean(value.value);
  const unit = clean(value.unitText ?? value.unitCode);
  if (amount && name && !/^\d/.test(name)) return [amount, unit, name].filter(Boolean).join(" ");
  return name || [amount, unit].filter(Boolean).join(" ");
}
export function extractRecipeJsonLd(html: string, url: string): RecipeDraftData[] {
  const blocks = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const found = blocks.flatMap((match) => {
    try { return recipesIn(JSON.parse(match[1].trim())); } catch { return []; }
  });
  return found.slice(0, 20).map((recipe) => {
    const author = recipe.author;
    const authorName = Array.isArray(author) ? clean(object(author[0]) ? author[0].name : author[0]) : clean(object(author) ? author.name : author);
    const yieldText = Array.isArray(recipe.recipeYield) ? clean(recipe.recipeYield[0]) : clean(recipe.recipeYield);
    const servings = /^\d+\s*(?:servings?|people|portions?)?$/i.test(yieldText) ? Number(yieldText.match(/\d+/)?.[0]) : 0;
    const ingredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
    return { ...blankDraft, title: clean(recipe.name), summary: clean(recipe.description), sourceUrl: url,
      sourceAttribution: authorName || new URL(url).hostname, originalYield: yieldText,
      servings, totalMinutes: minutes(recipe.totalTime) || minutes(recipe.prepTime) + minutes(recipe.cookTime),
      ingredientLines: ingredients.map(ingredientLine).filter(Boolean),
      steps: instructionSteps(recipe.recipeInstructions), origin: "url_import" as const };
  }).filter((recipe) => recipe.title);
}
