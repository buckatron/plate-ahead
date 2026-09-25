"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GroceryActionError, saveGroceryOnHand, setGroceryPurchased } from "@/services/grocery-needs";

const lineFormSchema = z.object({
  planId: z.uuid(),
  expectedRevision: z.coerce.number().int().positive(),
  ingredientId: z.string().regex(/^[a-z0-9-]+$/),
  unitGroup: z.enum(["mass", "volume", "count", "portion", "unmeasured"]),
});

function destination(planId: string | null, error: string | null, ingredientId?: string, unitGroup?: string) {
  const params = new URLSearchParams();
  if (planId) params.set("planId", planId);
  if (error) params.set("shoppingError", error);
  const anchor = ingredientId && unitGroup ? `#line-${ingredientId}-${unitGroup}` : "";
  return `/groceries${params.size ? `?${params}` : ""}${anchor}`;
}

export async function saveOnHandAction(formData: FormData) {
  const parsed = lineFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(destination(null, "Refresh groceries and try again."));
  const raw = formData.get("onHand");
  let error: string | null = null;
  try {
    if (typeof raw !== "string") throw new GroceryActionError("Enter an on-hand amount or leave it blank.");
    await saveGroceryOnHand({ householdId: "home", ...parsed.data, rawAmount: raw });
    revalidatePath("/groceries");
  } catch (cause) {
    error = cause instanceof GroceryActionError ? cause.message : "Could not save the on-hand amount. Please try again.";
  }
  redirect(destination(parsed.data.planId, error, parsed.data.ingredientId, parsed.data.unitGroup));
}

export async function setPurchasedAction(formData: FormData) {
  const parsed = lineFormSchema.extend({ checked: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(destination(null, "Refresh groceries and try again."));
  let error: string | null = null;
  try {
    await setGroceryPurchased({ householdId: "home", planId: parsed.data.planId,
      expectedRevision: parsed.data.expectedRevision, ingredientId: parsed.data.ingredientId,
      unitGroup: parsed.data.unitGroup, checked: parsed.data.checked === "1" });
    revalidatePath("/groceries");
  } catch (cause) {
    error = cause instanceof GroceryActionError ? cause.message : "Could not update this item. Please try again.";
  }
  redirect(destination(parsed.data.planId, error, parsed.data.ingredientId, parsed.data.unitGroup));
}
