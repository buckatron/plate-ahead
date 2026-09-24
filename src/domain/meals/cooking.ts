export function parseConfirmedQuantity(raw: string): number {
  const value = raw.trim();
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(value)) {
    throw new Error("Enter a confirmed amount, including zero, with up to three decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(milli)) throw new Error("The saved amount is too large.");
  return milli;
}

export function hasLeftoverShortfall(actualMilli: number, reservedMilli: number): boolean {
  if (!Number.isSafeInteger(actualMilli) || actualMilli < 0 || !Number.isSafeInteger(reservedMilli) || reservedMilli < 0) {
    throw new Error("Invalid leftover quantity.");
  }
  return actualMilli < reservedMilli;
}
