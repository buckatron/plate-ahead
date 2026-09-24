import Link from "next/link";
import { acceptPlanAction, generateWeekAction } from "@/app/actions";
import { findHousehold } from "@/repositories/households";
import { findActivePlanReference, findLatestPlan, findPlanById } from "@/repositories/plans";
import { SiteHeader } from "@/components/site-header";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ planningError?: string; acceptError?: string; planId?: string }> }) {
  const household = await findHousehold("home");
  const { planningError, acceptError, planId } = await searchParams;
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
            <div className="plan-actions">
              <form action={generateWeekAction} className="plan-action">
                {plan && <input type="hidden" name="currentPlanId" value={plan.id} />}
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
                  {day.slots.map((slot) => <div className="day-meal" key={slot.id}>
                    <span className="meal-label">{slot.mealKind === "dinner" ? "Dinner" : "Lunch"}</span>
                    <div>
                      {slot.recipe ? <Link href={`/recipes/${slot.recipe.recipeKey}`}>{slot.recipe.title}</Link> : <strong>{slot.slotType === "eat_out" ? "Eat out" : "Flexible night"}</strong>}
                      {slot.reason && <p>{slot.reason}</p>}
                      {slot.mealKind === "lunch" && <p>From {slot.incomingAllocations[0]?.sourceComponent.slot.recipe?.title ?? "a previous dinner"}.</p>}
                      {slot.mealKind === "dinner" && slot.slotType === "cook" && plan.state !== "archived" &&
                        <Link className="swap-link" href={`/swap?planId=${plan.id}&slotId=${slot.id}`}>See alternatives →</Link>}
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
