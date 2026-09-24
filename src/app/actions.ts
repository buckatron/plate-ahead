"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlanningError } from "@/domain/planning/generate-week";
import { saveHouseholdSettings } from "@/repositories/households";
import { parseHouseholdSettingsForm } from "@/schemas/household";
import { createGeneratedWeek } from "@/services/plan-week";
import { acceptPlan, PlanAcceptanceError } from "@/services/accept-plan";
import { PlanLockError, setDinnerLocked } from "@/services/plan-lock";
import { PlanRepairError, repairPlan } from "@/services/repair-plan";
import { CookingError, recordCooking } from "@/services/record-cooking";

export type SettingsActionState = { status: "idle" | "saved" | "error"; message: string };

export async function saveSettingsAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const result = parseHouseholdSettingsForm(formData);
  if (!result.success) return { status: "error", message: result.error.issues[0]?.message ?? "Check the planning settings." };
  try {
    await saveHouseholdSettings("home", result.data);
    revalidatePath("/");
    return { status: "saved", message: "Preferences saved. Generate another draft to use them." };
  } catch {
    return { status: "error", message: "Could not save preferences. Please try again." };
  }
}

export async function generateWeekAction(formData: FormData) {
  let error: string | null = null;
  let planId: string | null = null;
  try {
    const currentPlanId = z.uuid().safeParse(formData.get("currentPlanId"));
    const expectedRevision = z.coerce.number().int().positive().safeParse(formData.get("currentRevision"));
    planId = await createGeneratedWeek("home", new Date(), currentPlanId.success ? {
      planId: currentPlanId.data, expectedRevision: expectedRevision.success ? expectedRevision.data : 0,
    } : undefined);
  } catch (cause) {
    error = cause instanceof PlanningError ? cause.message : "The week could not be generated. Please try again.";
  }
  if (error) {
    const currentPlanId = z.uuid().safeParse(formData.get("currentPlanId"));
    const params = new URLSearchParams({ planningError: error });
    if (currentPlanId.success) params.set("planId", currentPlanId.data);
    redirect(`/?${params}`);
  }
  redirect(`/?planId=${planId}`);
}

export async function setDinnerLockedAction(formData: FormData) {
  const input = z.object({ planId: z.uuid(), slotId: z.uuid(),
    expectedRevision: z.coerce.number().int().positive(), locked: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/?lockError=Refresh%20the%20week%20and%20try%20again.");
  let error: string | null = null;
  try {
    await setDinnerLocked({ householdId: "home", planId: input.data.planId, slotId: input.data.slotId,
      expectedRevision: input.data.expectedRevision, locked: input.data.locked === "1" });
    revalidatePath("/");
  } catch (cause) {
    error = cause instanceof PlanLockError ? cause.message : "Could not update this dinner. Please try again.";
  }
  const params = new URLSearchParams({ planId: input.data.planId });
  if (error) params.set("lockError", error);
  redirect(`/?${params}#slot-${input.data.slotId}`);
}

export async function repairPlanAction(formData: FormData) {
  const input = z.object({ planId: z.uuid(), slotId: z.uuid(), expectedRevision: z.coerce.number().int().positive(),
    change: z.enum(["skip-dinner", "cancel-lunch"]) }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/?repairError=Refresh%20the%20week%20and%20try%20again.");
  let error: string | null = null;
  let linkedLunchCancelled = false;
  let sourceAlreadyCooked = false;
  try {
    const result = await repairPlan({ householdId: "home", ...input.data });
    linkedLunchCancelled = result.linkedLunchCancelled;
    sourceAlreadyCooked = result.sourceAlreadyCooked;
    revalidatePath("/");
    revalidatePath("/groceries");
  } catch (cause) {
    error = cause instanceof PlanRepairError ? cause.message : "Could not change this meal. Please try again.";
  }
  const params = new URLSearchParams({ planId: input.data.planId });
  params.set(error ? "repairError" : "repairSaved", error ?? (sourceAlreadyCooked ? "cancel-lunch-cooked" :
    input.data.change === "skip-dinner" && !linkedLunchCancelled ? "skip-dinner-only" : input.data.change));
  redirect(`/?${params}#slot-${input.data.slotId}`);
}

export async function recordCookingAction(formData: FormData) {
  const input = z.object({ planId: z.uuid(), slotId: z.uuid(), expectedRevision: z.coerce.number().int().positive(),
    requestId: z.uuid(), servingsServed: z.coerce.number().int().min(1).max(99) }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/?cookingError=Check%20the%20servings%20and%20refresh%20the%20week.");
  const amounts = [...formData.entries()].filter(([key]) => key.startsWith("amount:")).map(([key, value]) => ({
    componentId: key.slice(7), rawAmount: typeof value === "string" ? value : "",
  }));
  let error: string | null = null;
  let needsAttention = false;
  try {
    needsAttention = (await recordCooking({ householdId: "home", ...input.data, amounts })).lunchNeedsAttention;
    revalidatePath("/");
    revalidatePath("/groceries");
  } catch (cause) {
    error = cause instanceof CookingError ? cause.message : "Could not record dinner. Please try again.";
  }
  const params = new URLSearchParams({ planId: input.data.planId });
  params.set(error ? "cookingError" : "cookingSaved", error ?? (needsAttention ? "shortfall" : "1"));
  redirect(`/?${params}#slot-${input.data.slotId}`);
}

export async function acceptPlanAction(formData: FormData) {
  const input = z.object({ planId: z.uuid(), revision: z.coerce.number().int().positive() }).safeParse({
    planId: formData.get("planId"), revision: formData.get("revision"),
  });
  if (!input.success) redirect("/?acceptError=Refresh%20the%20draft%20and%20try%20again.");
  try {
    await acceptPlan("home", input.data.planId, input.data.revision);
    revalidatePath("/");
  } catch (cause) {
    const message = cause instanceof PlanAcceptanceError ? cause.message : "Could not accept this draft. Please try again.";
    redirect(`/?planId=${input.data.planId}&acceptError=${encodeURIComponent(message)}`);
  }
  redirect(`/?planId=${input.data.planId}`);
}
