import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
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
    <p className="swap-notice">These are previews only. Your plan and grocery checks have not changed. Choosing and confirming a replacement is the next step of the build.</p>
    {result.slot.locked && <p className="plan-error">This meal is locked. Unlock it before a future swap can be applied.</p>}
    {result.linkedLunch && <p className="swap-lunch-note">The current dinner supplies <strong>{result.linkedLunch}</strong>. Each alternative below shows what would happen to that lunch.</p>}
    {result.options.length ? <div className="recipe-grid swap-grid">{result.options.map((option) => <article className="recipe-card" key={option.recipe.id}>
      <div className="recipe-card-top"><span>{option.recipe.totalMinutes} minutes</span><span>{option.recipe.tags.cuisine?.[0] ?? "Different style"}</span></div>
      <h2><Link href={`/recipes/${option.recipe.key}`}>{option.recipe.title}</Link></h2>
      <p>{option.reason}</p>
      {result.linkedLunch && <div className="recipe-card-lunch">{option.lunch
        ? <>Potential new lunch: <strong>{option.lunch.lunchTitle}</strong>. The existing linked lunch would be replaced.</>
        : <>No reviewed lunch pairing for this dinner. The existing linked lunch would need to be cancelled or replanned.</>}</div>}
      <Link className="text-link" href={`/recipes/${option.recipe.key}`}>View recipe →</Link>
    </article>)}</div> : <div className="panel grocery-empty"><h2>No suitable alternatives yet</h2>
      <p>The remaining recipes are already planned or do not fit this plan’s time limit and exclusions. Try changing preferences and generating another draft.</p></div>}
  </div></main>;
}
