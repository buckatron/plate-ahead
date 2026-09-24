import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { formatQuantity } from "@/domain/meals/scale-recipe";
import { getSwapShortlist } from "@/services/swap-options";

export const dynamic = "force-dynamic";

export default async function SwapPage({ searchParams }: { searchParams: Promise<{ planId?: string; slotId?: string }> }) {
  const { planId, slotId } = await searchParams;
  if (!planId || !slotId) notFound();
  const result = await getSwapShortlist("home", planId, slotId);
  if (!result) notFound();
  const day = new Date(`${result.slot.localDate}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });

  return <main className="page"><div className="shell">
    <SiteHeader />
    <div className="recipe-breadcrumb"><Link href={`/?planId=${result.plan.id}`}>← Back to week</Link></div>
    <section className="swap-heading">
      <p className="overline">Explore a change</p>
      <h1>Something else<br /><em>for dinner.</em></h1>
      <p className="lead">{day}: currently {result.slot.title}.</p>
    </section>
    <p className="swap-notice">These are previews of recipe needs, not the amount left to buy after pantry review. Your plan and grocery checks have not changed. Confirming a replacement is a future step.</p>
    {result.slot.locked && <p className="plan-error">This meal is locked. Unlock it before a future swap can be applied.</p>}
    {result.linkedLunch && <p className="swap-lunch-note">The current dinner supplies <strong>{result.linkedLunch.title}</strong>. Each alternative below shows what would happen to that lunch.</p>}
    {result.options.length ? <div className="recipe-grid swap-grid">{result.options.map((option) => <article className="recipe-card" key={option.recipe.id}>
      <div className="recipe-card-top"><span>{option.recipe.tags.cuisine?.[0] ?? "Different style"}</span></div>
      <h2><Link href={`/recipes/${option.recipe.key}`}>{option.recipe.title}</Link></h2>
      <p>{option.reason}</p>
      <p className="swap-time"><strong>Dinner:</strong> {result.slot.totalMinutes} → {option.dinnerMinutes} minutes
        {option.dinnerMinutes !== result.slot.totalMinutes && ` (${option.dinnerMinutes > result.slot.totalMinutes ? "+" : ""}${option.dinnerMinutes - result.slot.totalMinutes})`}</p>
      {result.linkedLunch && <div className="recipe-card-lunch">{option.lunch
        ? <>Potential new lunch: <strong>{option.lunch.lunchTitle}</strong>. The existing linked lunch would be replaced.
          <span className="swap-lunch-time">Lunch time: {result.linkedLunch.totalMinutes} → {option.lunchMinutes} minutes</span></>
        : <>No reviewed lunch pairing for this dinner. The existing linked lunch would need to be cancelled or replanned.</>}</div>}
      <details className="swap-groceries"><summary>Grocery changes · {option.groceryChanges.length}</summary>
        {option.groceryChanges.length ? <ul>{option.groceryChanges.map((change) => <li key={change.key}>
          <span><strong>{change.name}</strong><small>{formatQuantity(change.before)} → {formatQuantity(change.after)} needed</small></span>
          <b className={change.deltaMilli > 0 ? "swap-more" : "swap-less"}>
            {change.deltaMilli > 0 ? "+" : "−"}{formatQuantity({ milli: Math.abs(change.deltaMilli), unit: change.before.unit })}
          </b>
        </li>)}</ul> : <p>No ingredient quantities would change.</p>}
      </details>
      <Link className="text-link" href={`/recipes/${option.recipe.key}`}>View recipe →</Link>
    </article>)}</div> : <div className="panel grocery-empty"><h2>No suitable alternatives yet</h2>
      <p>The remaining recipes are already planned or do not fit this plan’s time limit and exclusions. Try changing preferences and generating another draft.</p></div>}
  </div></main>;
}
