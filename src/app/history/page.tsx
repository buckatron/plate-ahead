import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MealFeedbackForm } from "@/components/meal-feedback-form";
import { getCookingSignals } from "@/services/cooking-history";
import { prisma } from "@/services/prisma";

export const dynamic = "force-dynamic";

const reactions: Record<string, string> = {
  loved: "Loved it", good: "Good", break: "Need a break", not_again: "Not again",
};
const efforts: Record<string, string> = { easy: "Easy", about_right: "Effort felt right", too_much: "Too much effort" };
const leftovers: Record<string, string> = { appealing: "Appealing leftovers", okay: "Leftovers were okay",
  not_appealing: "Leftovers not appealing" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{
  feedbackError?: string; feedbackSaved?: string }> }) {
  const { feedbackError, feedbackSaved } = await searchParams;
  const [household, events, signals] = await Promise.all([
    prisma.household.findUnique({ where: { id: "home" }, select: { timezone: true } }),
    prisma.cookingEvent.findMany({ where: { householdId: "home" }, orderBy: { cookedAt: "desc" },
      include: { recipe: true, slot: { select: { id: true, planId: true } }, feedback: true,
        batches: { select: { id: true } } } }),
    getCookingSignals("home", new Date()),
  ]);
  return <main className="page"><div className="shell">
    <SiteHeader />
    <section className="library-heading">
      <p className="overline">Your cooking history</p>
      <h1>Meals you made,<br /><em>lessons you keep.</em></h1>
      <p className="lead">Confirmed dinners guide the next week. You can change feedback at any time, including a temporary break from a favorite.</p>
    </section>
    {feedbackError && <p className="plan-error" role="alert">{feedbackError}</p>}
    {feedbackSaved && <p className="settings-message settings-saved" role="status">Meal feedback saved. The next draft and swap list will use it.</p>}
    {events.length ? <section className="history-list" aria-label="Cooked dinners">
      {events.map((event) => {
        const signal = signals.get(event.recipe.recipeKey);
        const answers = [event.feedback?.reaction && reactions[event.feedback.reaction],
          event.feedback?.effort && efforts[event.feedback.effort],
          event.feedback?.leftovers && leftovers[event.feedback.leftovers]].filter(Boolean);
        return <article className="panel history-card" id={`event-${event.id}`} key={event.id}>
          <div className="panel-head"><h2><Link href={`/recipes/${event.recipe.recipeKey}`}>{event.recipe.title}</Link></h2>
            <span className="subtle">{event.cookedAt.toLocaleDateString("en-US", { timeZone: household?.timezone ?? "UTC",
              month: "short", day: "numeric", year: "numeric" })}</span></div>
          <p>{answers.length ? answers.join(" · ") : "No feedback yet."}</p>
          {signal?.unavailable === "break" && <p className="history-status">Taking a four-week break in new suggestions.</p>}
          {signal?.unavailable === "not_again" && <p className="history-status">Excluded from new suggestions by “Not again.”</p>}
          <MealFeedbackForm planId={event.slot.planId} slotId={event.slot.id} cookingEventId={event.id}
            feedback={event.feedback} hasLeftovers={event.batches.length > 0} returnTo="history" />
        </article>;
      })}
    </section> : <div className="panel grocery-empty"><h2>No cooked dinners yet</h2>
      <p>When you confirm a dinner, it will appear here with its feedback.</p>
      <Link href="/">Back to this week</Link></div>}
  </div></main>;
}
