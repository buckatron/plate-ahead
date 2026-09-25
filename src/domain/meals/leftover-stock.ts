export type StockMovement = { type: string; quantityMilli: number };

export function stockCorrectionMovement(currentMilli: number, targetMilli: number):
  { type: "adjust_in" | "adjust_out"; quantityMilli: number } {
  if (!Number.isSafeInteger(currentMilli) || currentMilli < 0 ||
    !Number.isSafeInteger(targetMilli) || targetMilli < 0) throw new Error("Invalid leftover balance.");
  if (currentMilli === targetMilli) throw new Error("The corrected amount is already the current amount.");
  return { type: targetMilli > currentMilli ? "adjust_in" : "adjust_out",
    quantityMilli: Math.abs(targetMilli - currentMilli) };
}

export function remainingBatchQuantity(initialMilli: number, movements: readonly StockMovement[]): number {
  if (!Number.isSafeInteger(initialMilli) || initialMilli <= 0) throw new Error("Invalid starting leftover quantity.");
  let remaining = initialMilli;
  for (const movement of movements) {
    if (!Number.isSafeInteger(movement.quantityMilli) || movement.quantityMilli < 0) {
      throw new Error("Invalid leftover movement quantity.");
    }
    if (movement.type === "consume" || movement.type === "discard" || movement.type === "adjust_out") {
      if (movement.quantityMilli === 0) throw new Error("A stock reduction must be positive.");
      remaining -= movement.quantityMilli;
    } else if (movement.type === "adjust_in") {
      if (movement.quantityMilli === 0) throw new Error("A stock correction must be positive.");
      remaining += movement.quantityMilli;
    } else if (movement.type === "freeze" || movement.type === "thaw") {
      if (movement.quantityMilli !== 0) throw new Error("Moving storage location cannot change quantity.");
    } else throw new Error("Unknown leftover movement.");
    if (!Number.isSafeInteger(remaining)) throw new Error("Leftover balance is too large.");
  }
  if (remaining < 0) throw new Error("Leftover movements exceed the batch quantity.");
  return remaining;
}

export function unallocatedBatchQuantity(initialMilli: number, movements: readonly StockMovement[], reservedMilli: number): number {
  if (!Number.isSafeInteger(reservedMilli) || reservedMilli < 0) throw new Error("Invalid planned reservation.");
  return Math.max(0, remainingBatchQuantity(initialMilli, movements) - reservedMilli);
}
