import { assertCompatible, toBaseQuantity, type Quantity } from "./quantity";

export interface Allocation {
  sourceSlotId: string;
  destinationSlotId: string;
  destinationKind: "lunch";
  destinationDate: string;
  quantity: Quantity;
}

export interface ComponentUse {
  slotId: string;
  sourceDate: string;
  reservable: boolean;
  yield: Quantity;
  dinnerUse: Quantity;
  allocations: Allocation[];
}

export function validateComponentUse(component: ComponentUse): void {
  const { slotId, sourceDate, yield: produced, dinnerUse, allocations } = component;
  if (produced.milli <= 0) throw new Error("A component must yield a positive quantity.");
  if (!component.reservable && allocations.length > 0) throw new Error("This component cannot be reserved for lunch.");
  assertCompatible(produced, dinnerUse);
  const producedBase = toBaseQuantity(produced).milli;
  let usedBase = toBaseQuantity(dinnerUse).milli;

  for (const allocation of allocations) {
    if (allocation.quantity.milli <= 0) throw new Error("A lunch reservation must be positive.");
    if (allocation.sourceSlotId !== slotId) throw new Error("Allocation source does not match this component.");
    if (allocation.destinationSlotId === slotId) throw new Error("A meal cannot allocate food to itself.");
    if (allocation.destinationKind !== "lunch") throw new Error("Reusable food must go to a lunch slot.");
    if (allocation.destinationDate <= sourceDate) throw new Error("Lunch must follow its source dinner.");
    assertCompatible(produced, allocation.quantity);
    usedBase += toBaseQuantity(allocation.quantity).milli;
  }

  if (!Number.isSafeInteger(usedBase)) throw new Error("Allocated quantity exceeds supported precision.");
  if (usedBase > producedBase) throw new Error("Dinner and lunches use more than this component yields.");
}
