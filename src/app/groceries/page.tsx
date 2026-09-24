import Link from "next/link";
import { notFound } from "next/navigation";
import { saveOnHandAction, setPurchasedAction } from "@/app/groceries/actions";
import { SiteHeader } from "@/components/site-header";
import { formatQuantity } from "@/domain/meals/scale-recipe";
import type { ReviewedGroceryNeed } from "@/domain/meals/grocery-review";
import { findActivePlanReference, findLatestPlan } from "@/repositories/plans";
import { getGroceryNeeds } from "@/services/grocery-needs";

export const dynamic = "force-dynamic";

export default async function GroceriesPage({ searchParams }: { searchParams: Promise<{ planId?: string; shoppingError?: string }> }) {
  const { planId, shoppingError } = await searchParams;
  const latestPlan = planId ? null : await findLatestPlan("home");
  const activePlan = latestPlan ? await findActivePlanReference("home", latestPlan.weekStart) : null;
  const selectedId = planId ?? activePlan?.id ?? latestPlan?.id;
  const result = selectedId ? await getGroceryNeeds("home", selectedId) : null;
  if (planId && !result) notFound();

  const categories = new Map<string, ReviewedGroceryNeed[]>();
  for (const need of result?.needs ?? []) {
    const lines = categories.get(need.category) ?? [];
    lines.push(need);
    categories.set(need.category, lines);
  }
  const weekLabel = result ? new Date(`${result.plan.weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }) : null;

  return <main className="page">
    <div className="shell">
      <SiteHeader />
      <div className="recipe-breadcrumb"><Link href={result ? `/?planId=${result.plan.id}` : "/"}>← Back to week</Link></div>
      <section className="grocery-heading">
        <p className="overline">Plan before shopping</p>
        <h1>Groceries<br /><em>for the week.</em></h1>
        {result && <p className="lead">Week of {weekLabel} · {result.needs.length} ingredients · {result.plan.state} plan</p>}
      </section>
      {shoppingError && <p className="plan-error" role="alert">{shoppingError}</p>}
      {result ? <>
        <p className="grocery-note">Recipe needs include extra dinner portions reserved for lunch and add new lunch ingredients once. Enter what you already have to see the amount still needed. A blank on-hand field means you have not checked yet; zero means you checked and have none. Optional ingredients are omitted.</p>
        {categories.size ? <div className="grocery-sections">
          {[...categories].map(([category, lines]) => <section className="panel grocery-category" key={category}>
            <h2>{category}</h2>
            <ul className="grocery-lines">{lines.map((line) => {
              const unitGroup = line.key.slice(line.ingredientId.length + 1);
              const fields = <>
                <input type="hidden" name="planId" value={result.plan.id} />
                <input type="hidden" name="expectedRevision" value={result.plan.revision} />
                <input type="hidden" name="ingredientId" value={line.ingredientId} />
                <input type="hidden" name="unitGroup" value={unitGroup} />
              </>;
              return <li key={line.key} id={`line-${line.ingredientId}-${unitGroup}`}>
              <div className={`grocery-line-top${line.checked ? " grocery-bought" : ""}`}><strong>{line.name}</strong><span>{formatQuantity(line.quantity)} needed</span></div>
              <div className="grocery-line-status"><span>{line.onHandMilli === null ? "On hand: not reviewed" : `On hand: ${line.onHandMilli / 1000} ${line.quantity.unit}`}</span>
                <strong>{line.toBuy.milli > 0 ? `${formatQuantity(line.toBuy)} ${line.checked ? "marked bought" : "to buy"}${line.onHandMilli === null ? " (before pantry review)" : ""}` : "Enough on hand"}</strong></div>
              <div className="grocery-controls">
                <form action={saveOnHandAction} className="grocery-onhand-form">
                  {fields}
                  <label htmlFor={`onhand-${line.key}`}>Have</label>
                  <input id={`onhand-${line.key}`} type="number" name="onHand" min="0" step="0.001" inputMode="decimal" defaultValue={line.onHandMilli === null ? "" : String(line.onHandMilli / 1000)} aria-label={`${line.name} on hand in ${line.quantity.unit}`} />
                  <span>{line.quantity.unit}</span><button type="submit">Save</button>
                </form>
                {(line.toBuy.milli > 0 || line.checked) && <form action={setPurchasedAction}>
                  {fields}<input type="hidden" name="checked" value={line.checked ? "0" : "1"} />
                  <button type="submit" className={line.checked ? "grocery-bought-button" : "grocery-buy-button"}>{line.checked ? "✓ Bought · undo" : "Mark bought"}</button>
                </form>}
              </div>
              <details><summary>Used by {line.contributions.length} {line.contributions.length === 1 ? "meal" : "meals"}</summary>
                <ul className="grocery-contributions">{line.contributions.map((source) => <li key={source.slotId}>
                  <span>{source.localDate} · {source.mealKind} · {source.recipeTitle}</span>
                  <span>{formatQuantity(source.quantity)}</span>
                </li>)}</ul>
              </details>
            </li>})}</ul>
          </section>)}
        </div> : <div className="panel grocery-empty"><h2>No ingredients yet</h2><p>This plan has no cooked meals. Add dinners to see their grocery needs.</p></div>}
      </> : <div className="panel grocery-empty"><h2>No plan yet</h2><p>Generate a week first, then its grocery needs will appear here.</p><Link className="text-link" href="/">Go to this week →</Link></div>}
    </div>
  </main>;
}
