import { aggregateGroceryNeeds, type GroceryComponent } from "../meals/groceries";
import type { Quantity } from "../meals/quantity";

export type GroceryChange = {
  key: string;
  name: string;
  category: string;
  before: Quantity;
  after: Quantity;
  deltaMilli: number;
};

export function previewSwapGroceries(input: {
  current: GroceryComponent[];
  replacedSlotIds: string[];
  replacement: GroceryComponent[];
}): GroceryChange[] {
  const replaced = new Set(input.replacedSlotIds);
  const before = new Map(aggregateGroceryNeeds(input.current).map((need) => [need.key, need]));
  const after = new Map(aggregateGroceryNeeds([
    ...input.current.filter((component) => !replaced.has(component.slotId)), ...input.replacement,
  ]).map((need) => [need.key, need]));
  const changes: GroceryChange[] = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const oldNeed = before.get(key);
    const newNeed = after.get(key);
    const unit = oldNeed?.quantity.unit ?? newNeed!.quantity.unit;
    const beforeMilli = oldNeed?.quantity.milli ?? 0;
    const afterMilli = newNeed?.quantity.milli ?? 0;
    if (beforeMilli === afterMilli) continue;
    changes.push({ key, name: newNeed?.name ?? oldNeed!.name, category: newNeed?.category ?? oldNeed!.category,
      before: { milli: beforeMilli, unit }, after: { milli: afterMilli, unit }, deltaMilli: afterMilli - beforeMilli });
  }
  return changes.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}
