import Link from "next/link";
import { randomUUID } from "node:crypto";
import { acceptPlanAction, generateWeekAction, recordCookingAction, repairPlanAction, setDinnerLockedAction } from "@/app/actions";
import { formatQuantity } from "@/domain/meals/scale-recipe";
import { findHousehold } from "@/repositories/households";
import { findActivePlanReference, findLatestPlan, findPlanById } from "@/repositories/plans";
import { SiteHeader } from "@/components/site-header";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ planningError?: string; acceptError?: string;
  swapError?: string; swapSaved?: string; lockError?: string; repairError?: string; repairSaved?: string;
  cookingError?: string; cookingSaved?: string; planId?: string }> }) {
  const household = await findHousehold("home");
  const { planningError, acceptError, swapError, swapSaved, lockError, repairError, repairSaved,
    cookingError, cookingSaved, planId } = await searchParams;
  const latestPlan = household ? await findLatestPlan(household.id) : null;
  const plan = household && planId ? await findPlanById(household.id, planId) ?? latestPlan : latestPlan;
  const activePlan = household && plan ? await findActivePlanReference(household.id, plan.weekStart) : null;
  const newerDraft = latestPlan?.state === "draft" && latestPlan.weekStart === plan?.weekStart && latestPlan.id !== plan.id ? latestPlan : null;
  const days = plan ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${plan.weekStart}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const localDate = date.toISOString().slice(0, 10);
    return { localDate, label: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }),
      slots: plan.slots.filter((slot) => slot.localDate === localDate) };
  }) : [];

  return (
    <main className="page">
      <div className="shell">
        <SiteHeader />
        <section className="hero" aria-labelledby="page-title">
          <div>
            <p className="overline">The kitchen starts here</p>
            <h1 id="page-title">More variety.<br /><em>Less deciding.</em></h1>
            <p className="lead">A meal plan for two that connects dinner, fresh lunches, and the groceries you actually need.</p>
          </div>
          <div className="hero-mark" aria-hidden="true"><span>{plan ? plan.slots.filter((slot) => slot.slotType === "cook" && slot.mealKind === "dinner").length : household?.settings.dinnerCount ?? 6}</span><small>good dinners<br />each week</small></div>
        </section>

        <section className="content-grid" aria-label="Planning overview">
          <div className="panel plan-panel">
            <div className="panel-head"><h2>{plan ? `Week of ${plan.weekStart}` : "Your week"}</h2><span className="pill">{plan?.state ?? "Getting started"}</span></div>
            <p className="plan-intro">{plan?.state === "active" ? "This is your accepted week. Each linked lunch uses food set aside from dinner." :
              plan?.state === "archived" ? "This earlier plan was replaced by another accepted plan for the week." :
              plan ? "A draft to review before shopping. Each linked lunch uses food set aside from dinner." :
              "Let’s make a week with fresh dinners and a couple of transformed leftover lunches."}</p>
            {planningError && <p className="plan-error" role="alert">{planningError}</p>}
            {acceptError && <p className="plan-error" role="alert">{acceptError}</p>}
            {swapError && <p className="plan-error" role="alert">{swapError}</p>}
            {lockError && <p className="plan-error" role="alert">{lockError}</p>}
            {repairError && <p className="plan-error" role="alert">{repairError}</p>}
            {cookingError && <p className="plan-error" role="alert">{cookingError}</p>}
            {cookingSaved && <p className="settings-message settings-saved" role="status">{cookingSaved === "shortfall"
              ? "Dinner recorded. A linked lunch needs attention because less food was saved than planned."
              : "Dinner and confirmed leftovers recorded."}</p>}
            {repairSaved && <p className="settings-message settings-saved" role="status">{repairSaved === "skip-dinner"
              ? "Dinner skipped and its linked lunch cancelled. Grocery needs were recalculated."
              : repairSaved === "skip-dinner-only" ? "Dinner skipped. Grocery needs were recalculated."
                : repairSaved === "cancel-lunch-cooked" ? "Lunch cancelled. Confirmed leftovers remain recorded."
                : "Lunch cancelled; dinner portions and grocery needs were recalculated."}</p>}
            {swapSaved && <p className="settings-message settings-saved" role="status">{swapSaved === "lunch-cancelled"
              ? "Dinner swapped. Its linked lunch was cancelled; grocery needs were recalculated."
              : "Dinner and linked lunch updated. Grocery needs were recalculated."}</p>}
            <div className="plan-actions">
              <form action={generateWeekAction} className="plan-action">
                {plan && ["draft", "active"].includes(plan.state) && <>
                  <input type="hidden" name="currentPlanId" value={plan.id} />
                  <input type="hidden" name="currentRevision" value={plan.revision} />
                </>}
                <button type="submit">{plan ? "Generate another draft" : "Generate my week"}</button>
              </form>
              {plan?.state === "draft" && <form action={acceptPlanAction} className="plan-action accept-action">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="revision" value={plan.revision} />
                <button type="submit">Use this plan</button>
              </form>}
            </div>
            {plan?.state === "draft" && activePlan && activePlan.id !== plan.id &&
              <p className="plan-context">Using this draft will replace your <Link href={`/?planId=${activePlan.id}`}>accepted plan for this week</Link>.</p>}
            {plan && plan.state !== "draft" && activePlan && activePlan.id !== plan.id &&
              <p className="plan-context"><Link href={`/?planId=${activePlan.id}`}>View accepted plan</Link></p>}
            {plan && newerDraft && <p className="plan-context"><Link href={`/?planId=${newerDraft.id}`}>View latest draft</Link></p>}
            {plan && <p className="plan-context"><Link href={`/groceries?planId=${plan.id}`}>{plan.state === "draft" ? "Preview grocery needs" : "View grocery needs"} →</Link></p>}
            {plan ? (
              <div className="week-list">
                {days.map((day) => <section className="day" key={day.localDate} aria-label={day.label}>
                  <h3>{day.label}</h3>
                  {day.slots.map((slot) => <div className="day-meal" key={slot.id} id={`slot-${slot.id}`}>
                    <span className="meal-label">{slot.mealKind === "dinner" ? "Dinner" : "Lunch"}</span>
                    <div>
                      {slot.status === "cancelled" ? <strong>Lunch cancelled</strong> :
                        slot.status === "skipped" ? <strong>Dinner skipped</strong> :
                        slot.recipe ? <Link href={`/recipes/${slot.recipe.recipeKey}`}>{slot.recipe.title}</Link> :
                        <strong>{slot.slotType === "eat_out" ? "Eat out" : "Flexible night"}</strong>}
                      {slot.reason && <p>{slot.reason}</p>}
                      {slot.status === "needs_attention" && <p className="meal-warning" role="status">Lunch needs attention: supply the missing food separately or cancel it.</p>}
                      {slot.mealKind === "lunch" && ["planned", "needs_attention"].includes(slot.status) &&
                        <p>From {slot.incomingAllocations[0]?.sourceComponent.slot.recipe?.title ?? "a previous dinner"}.</p>}
                      {slot.mealKind === "lunch" && ["planned", "needs_attention"].includes(slot.status) && plan.state !== "archived" &&
                        <details className="meal-repair"><summary>Cancel this lunch</summary>
                          <p>The dinner will no longer reserve extra portions for it.</p>
                          <form action={repairPlanAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="slotId" value={slot.id} />
                            <input type="hidden" name="expectedRevision" value={plan.revision} />
                            <input type="hidden" name="change" value="cancel-lunch" />
                            <button type="submit">Confirm lunch cancellation</button>
                          </form>
                        </details>}
                      {slot.mealKind === "dinner" && slot.slotType === "cook" && slot.status === "planned" && plan.state !== "archived" && <>
                        <form action={setDinnerLockedAction} className="lock-form">
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="slotId" value={slot.id} />
                          <input type="hidden" name="expectedRevision" value={plan.revision} />
                          <input type="hidden" name="locked" value={slot.locked ? "0" : "1"} />
                          <button type="submit" aria-label={slot.locked ? `Unlock ${slot.recipe?.title}` : `Keep ${slot.recipe?.title} in the next draft`}>
                            {slot.locked ? "Kept for next draft · unlock" : "Keep in next draft"}
                          </button>
                        </form>
                        {!slot.locked && <Link className="swap-link" href={`/swap?planId=${plan.id}&slotId=${slot.id}`}>See alternatives →</Link>}
                        <details className="meal-repair"><summary>Skip this dinner</summary>
                          <p>This opens the night, cancels its linked lunch, and updates groceries.</p>
                          <form action={repairPlanAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="slotId" value={slot.id} />
                            <input type="hidden" name="expectedRevision" value={plan.revision} />
                            <input type="hidden" name="change" value="skip-dinner" />
                            <button type="submit">Confirm dinner skip</button>
                          </form>
                        </details>
                      </>}
                      {slot.mealKind === "dinner" && slot.slotType === "cook" && slot.status === "planned" && plan.state === "active" &&
                        <details className="meal-repair cooking-checkin"><summary>Mark dinner cooked</summary>
                          <p>Confirm what you served and what you actually saved. Planned lunch portions are suggestions, not recorded leftovers.</p>
                          <form action={recordCookingAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="slotId" value={slot.id} />
                            <input type="hidden" name="expectedRevision" value={plan.revision} />
                            <input type="hidden" name="requestId" value={randomUUID()} />
                            <label>Servings eaten <input type="number" name="servingsServed" min="1" max="99" step="1" required defaultValue={slot.servings ?? 2} /></label>
                            {slot.components.filter((component) => component.recipeComponent.reservable).map((component) =>
                              <label key={component.id}>{component.recipeComponent.name} saved ({component.unit})
                                <input type="number" name={`amount:${component.recipeComponentId}`} min="0" step="0.001" required
                                  defaultValue={component.outgoingAllocations.reduce((sum, allocation) => sum + allocation.reservedMilli, 0) / 1000} />
                              </label>)}
                            <button type="submit">Confirm cooked dinner</button>
                          </form>
                        </details>}
                      {slot.cookingEvent && <p className="cooked-summary">Cooked · {slot.cookingEvent.servingsServed} servings eaten.
                        {slot.cookingEvent.batches.length ? ` Saved ${slot.cookingEvent.batches.map((batch) =>
                          `${formatQuantity({ milli: batch.quantityMilli, unit: batch.unit as "g" | "kg" | "ml" | "l" | "each" | "portion" })} ${batch.recipeComponent.name}`).join(", ")}.` : " No reusable food saved."}</p>}
                    </div>
                  </div>)}
                </section>)}
              </div>
            ) : <div className="empty-state"><div className="empty-icon" aria-hidden="true">✳</div><h3>Ready when you are.</h3><p>Generate a draft for next week. You can browse each recipe before deciding what to cook.</p></div>}
          </div>

          <div className="aside-stack">
            <div className="panel settings-panel">
              <div className="panel-head"><h2>Planning for</h2><span className="subtle">{household?.name ?? "Our kitchen"}</span></div>
              {household && <SettingsForm settings={household.settings} hasPlan={Boolean(plan)} />}
            </div>
            <div className="note"><span className="note-label">Our approach</span><p>Ingredients can repeat. The meal should still feel new.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}
