import type { Quantity } from "./quantity";
import { formatQuantity } from "./scale-recipe";

const countNouns: Record<string, { singular: string; plural: string }> = {
  "tortillas": { singular: "tortilla", plural: "tortillas" },
  "pitas": { singular: "pita", plural: "pitas" },
  "bell-pepper": { singular: "bell pepper", plural: "bell peppers" },
  "cucumber": { singular: "cucumber", plural: "cucumbers" },
  "zucchini": { singular: "zucchini", plural: "zucchini" },
  "red-onion": { singular: "red onion", plural: "red onions" },
  "onion": { singular: "onion", plural: "onions" },
  "scallions": { singular: "scallion", plural: "scallions" },
  "lemon": { singular: "lemon", plural: "lemons" },
  "lime": { singular: "lime", plural: "limes" },
  "eggs": { singular: "egg", plural: "eggs" },
};

function fallbackCountNoun(ingredientName: string): { singular: string; plural: string } {
  const words = ingredientName.trim().toLocaleLowerCase().split(/\s+/);
  const last = words.at(-1) ?? "item";
  if (last.endsWith("s")) return { singular: last, plural: last };
  if (/(?:ch|sh|x|z)$/.test(last)) return { singular: last, plural: `${last}es` };
  if (/[^aeiou]y$/.test(last)) return { singular: last, plural: `${last.slice(0, -1)}ies` };
  return { singular: last, plural: `${last}s` };
}

export function ingredientCountNoun(ingredientId: string, ingredientName: string): string {
  return (countNouns[ingredientId] ?? fallbackCountNoun(ingredientName)).plural;
}

export function formatGroceryQuantity(quantity: Quantity, ingredientId: string, ingredientName: string): string {
  if (quantity.unit !== "each") return formatQuantity(quantity);
  const nouns = countNouns[ingredientId] ?? fallbackCountNoun(ingredientName);
  const amount = quantity.milli / 1000;
  const roundedAmount = Math.ceil(amount * 4) / 4;
  const noun = roundedAmount === 1 ? nouns.singular : nouns.plural;
  return `${roundedAmount} ${noun}`;
}
