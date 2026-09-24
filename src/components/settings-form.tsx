"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSettingsAction, type SettingsActionState } from "@/app/actions";
import type { HouseholdSettings } from "@/schemas/household";

const initialState: SettingsActionState = { status: "idle", message: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</button>;
}

export function SettingsForm({ settings, hasPlan }: { settings: HouseholdSettings; hasPlan: boolean }) {
  const [state, action] = useActionState(saveSettingsAction, initialState);
  return <form action={action} className="settings-form">
    <label htmlFor="servings">People eating</label>
    <input id="servings" name="servings" type="number" min="1" max="12" step="1" required defaultValue={settings.servings} />

    <label htmlFor="dinnerCount">Dinners cooked at home</label>
    <select id="dinnerCount" name="dinnerCount" defaultValue={settings.dinnerCount}>
      {Array.from({ length: 7 }, (_, value) => <option key={value} value={value}>{value}</option>)}
    </select>

    <label htmlFor="lunchCount">New lunches from dinner</label>
    <select id="lunchCount" name="lunchCount" defaultValue={settings.lunchCount}>
      {Array.from({ length: 5 }, (_, value) => <option key={value} value={value}>{value}</option>)}
    </select>
    <p className="field-help">Up to four lunch transformations are in the catalog today.</p>

    <label htmlFor="maxDinnerMinutes">Max dinner time (minutes)</label>
    <input id="maxDinnerMinutes" name="maxDinnerMinutes" type="number" min="10" max="240" step="5" required defaultValue={settings.maxDinnerMinutes} />

    <label htmlFor="varietyPreference">Variety</label>
    <select id="varietyPreference" name="varietyPreference" defaultValue={settings.varietyPreference}>
      <option value="familiar">More familiar</option>
      <option value="balanced">Balanced</option>
      <option value="adventurous">More adventurous</option>
    </select>

    <label htmlFor="exclusions">Avoid ingredients or cuisines</label>
    <textarea id="exclusions" name="exclusions" rows={3} maxLength={2430} defaultValue={settings.exclusions.join("\n")} placeholder="One per line, e.g. mushrooms" />
    <p className="field-help">Matched against recipe titles, ingredients, and tags. Leave blank for no exclusions.</p>

    {hasPlan && <p className="field-help">Changes apply to the next generated draft. The plan shown here stays as it was planned.</p>}
    <SaveButton />
    {state.message && <p className={state.status === "error" ? "settings-message settings-error" : "settings-message settings-saved"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </form>;
}
