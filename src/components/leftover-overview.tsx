import Link from "next/link";
import { formatQuantity } from "@/domain/meals/scale-recipe";
import { unitSchema } from "@/domain/meals/quantity";
import type { LeftoverOverviewData } from "@/services/leftover-overview";

export function LeftoverOverview({ overview, timezone }: { overview: LeftoverOverviewData; timezone: string }) {
  const storedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: timezone });
  return <section className="panel leftover-overview" aria-labelledby="leftover-overview-title">
    <div className="panel-head"><h2 id="leftover-overview-title">Leftovers & lunches</h2></div>
    <p className="overview-intro">What is still planned, and what you have actually saved without a planned use.</p>
    <h3>Lunches still on the plan</h3>
    {overview.lunches.length ? <ul>{overview.lunches.map((lunch) => <li key={lunch.id}>
      <Link href={`/?planId=${lunch.planId}#slot-${lunch.id}`}>{lunch.title}</Link>
      <span>{lunch.localDate} · from {lunch.sourceTitle}</span>
      {lunch.needsAttention && <strong className="overview-attention">Needs attention</strong>}
    </li>)}</ul> : <p className="overview-empty">No linked lunches remain to be recorded.</p>}
    <h3>Saved food without a planned use</h3>
    {overview.unallocated.length ? <ul>{overview.unallocated.map((batch) => <li key={batch.id}>
      <Link href={`/?planId=${batch.planId}#slot-${batch.slotId}`}>{batch.componentName}</Link>
      <span>{formatQuantity({ milli: batch.quantityMilli, unit: unitSchema.parse(batch.unit) })} unallocated · {batch.location} · saved {storedDate.format(batch.storedAt)}</span>
      <small>From {batch.dinnerTitle}</small>
    </li>)}</ul> : <p className="overview-empty">No confirmed saved food is waiting for a use.</p>}
    <p className="overview-caution">Stored dates help you remember; they do not confirm that food is safe to eat.</p>
  </section>;
}
