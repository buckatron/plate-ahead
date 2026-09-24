import { describe, expect, it } from "vitest";
import { hasLeftoverShortfall, parseConfirmedQuantity } from "../../src/domain/meals/cooking";

describe("confirmed cooking quantities", () => {
  it("parses exact amounts including confirmed zero", () => {
    expect(parseConfirmedQuantity("0")).toBe(0);
    expect(parseConfirmedQuantity("2.125")).toBe(2125);
    expect(parseConfirmedQuantity(" 3.5 ")).toBe(3500);
  });

  it("rejects blank, negative, and overprecise amounts", () => {
    for (const raw of ["", "-1", "1.0001", "abc"]) expect(() => parseConfirmedQuantity(raw)).toThrow();
  });

  it("flags a lunch only when confirmed stock is below its reservation", () => {
    expect(hasLeftoverShortfall(1999, 2000)).toBe(true);
    expect(hasLeftoverShortfall(2000, 2000)).toBe(false);
    expect(hasLeftoverShortfall(3000, 2000)).toBe(false);
  });
});
