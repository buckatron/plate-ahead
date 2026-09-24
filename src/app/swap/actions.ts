"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applySwap, PlanSwapError } from "@/services/apply-swap";

const inputSchema = z.object({
  planId: z.uuid(),
  slotId: z.uuid(),
  recipeId: z.string().regex(/^[a-z0-9-]+-v[1-9][0-9]*$/),
  expectedRevision: z.coerce.number().int().positive(),
});

export async function applySwapAction(formData: FormData) {
  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/?swapError=Refresh%20the%20week%20and%20try%20again.");
  let error: string | null = null;
  let cancelledLunch = false;
  try {
    const result = await applySwap({ householdId: "home", ...parsed.data });
    cancelledLunch = result.cancelledLunch;
    revalidatePath("/");
    revalidatePath("/groceries");
    revalidatePath("/swap");
  } catch (cause) {
    error = cause instanceof PlanSwapError ? cause.message : "Could not save the swap. Please try again.";
  }
  if (error) {
    const params = new URLSearchParams({ planId: parsed.data.planId, slotId: parsed.data.slotId, swapError: error });
    redirect(`/swap?${params}`);
  }
  const params = new URLSearchParams({ planId: parsed.data.planId, swapSaved: cancelledLunch ? "lunch-cancelled" : "1" });
  redirect(`/?${params}`);
}
