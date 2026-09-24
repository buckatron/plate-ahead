import { describe, expect, it } from "vitest";
import { remainingBatchQuantity } from "../../src/domain/meals/leftover-stock";

describe("leftover batch balance", () => {
  it("deducts confirmed consumption without changing the original batch", () => {
    expect(remainingBatchQuantity(300_000, [{ type: "consume", quantityMilli: 200_000 }])).toBe(100_000);
  });

  it("rejects double spending and invalid movements", () => {
    expect(() => remainingBatchQuantity(200_000, [
      { type: "consume", quantityMilli: 150_000 }, { type: "consume", quantityMilli: 100_000 },
    ])).toThrow(/exceed/);
    expect(() => remainingBatchQuantity(200_000, [{ type: "consume", quantityMilli: -1 }])).toThrow(/Invalid/);
  });

  it("does not treat location changes as consumption", () => {
    expect(remainingBatchQuantity(200_000, [{ type: "freeze", quantityMilli: 0 },
      { type: "thaw", quantityMilli: 0 }])).toBe(200_000);
    expect(() => remainingBatchQuantity(200_000, [{ type: "freeze", quantityMilli: 1 }])).toThrow(/cannot change/);
  });

  it("deducts a partial discard while preserving the rest", () => {
    expect(remainingBatchQuantity(300_000, [{ type: "discard", quantityMilli: 50_000 }])).toBe(250_000);
  });
});
