"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlanningError } from "@/domain/planning/generate-week";
import { saveHouseholdSettings } from "@/repositories/households";
import { parseHouseholdSettingsForm } from "@/schemas/household";
import { createGeneratedWeek } from "@/services/plan-week";
import { acceptPlan, PlanAcceptanceError } from "@/services/accept-plan";

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
    planId = await createGeneratedWeek("home");
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
