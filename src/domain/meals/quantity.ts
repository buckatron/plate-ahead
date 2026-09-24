import { z } from "zod";

export const unitSchema = z.enum(["g", "kg", "ml", "l", "each", "portion"]);
export type Unit = z.infer<typeof unitSchema>;

export const quantitySchema = z.object({
  // Thousandths avoid floating-point drift when scaling recipe fractions.
  milli: z.number().int().nonnegative(),
  unit: unitSchema,
});
export type Quantity = z.infer<typeof quantitySchema>;

const conversion: Record<Unit, { group: string; factor: number }> = {
  g: { group: "mass", factor: 1 },
  kg: { group: "mass", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  l: { group: "volume", factor: 1000 },
  each: { group: "count", factor: 1 },
  portion: { group: "portion", factor: 1 },
};

export function toBaseQuantity(quantity: Quantity): { milli: number; group: string } {
  const parsed = quantitySchema.parse(quantity);
  const { group, factor } = conversion[parsed.unit];
  const milli = parsed.milli * factor;
  if (!Number.isSafeInteger(milli)) throw new Error("Quantity exceeds supported precision.");
  return { milli, group };
}

export function assertCompatible(a: Quantity, b: Quantity): void {
  if (toBaseQuantity(a).group !== toBaseQuantity(b).group) {
    throw new Error(`Cannot combine ${a.unit} with ${b.unit} without an ingredient-specific conversion.`);
  }
}

export function scaleQuantity(quantity: Quantity, numerator: number, denominator: number): Quantity {
  quantitySchema.parse(quantity);
  if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error("Invalid recipe scale.");
  }
  // Round up so a scaled recipe never underbuys an ingredient.
  const milli = Math.ceil((quantity.milli * numerator) / denominator);
  if (!Number.isSafeInteger(milli)) throw new Error("Scaled quantity exceeds supported precision.");
  return { milli, unit: quantity.unit };
}
