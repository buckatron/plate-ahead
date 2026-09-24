import type { GroceryNeed } from "./groceries";
import type { Quantity } from "./quantity";

export interface GroceryReviewState {
  onHandMilli: number | null;
  checked: boolean;
}

export interface ReviewedGroceryNeed extends GroceryNeed, GroceryReviewState {
  toBuy: Quantity;
}

// A blank field means unknown; zero means the pantry was checked and none is on hand.
export function parseOnHandAmount(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d{1,12}(?:\.\d{1,3})?$/.test(value)) throw new Error("Enter a non-negative amount with up to three decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(milli)) throw new Error("The on-hand amount is too large.");
  return milli;
}

export function reviewGroceryNeed(need: GroceryNeed, state?: GroceryReviewState): ReviewedGroceryNeed {
  const onHandMilli = state?.onHandMilli ?? null;
  if (onHandMilli !== null && (!Number.isSafeInteger(onHandMilli) || onHandMilli < 0)) {
    throw new Error("The on-hand amount is invalid.");
  }
  return { ...need, onHandMilli, checked: state?.checked ?? false,
    toBuy: { milli: Math.max(0, need.quantity.milli - (onHandMilli ?? 0)), unit: need.quantity.unit } };
}
