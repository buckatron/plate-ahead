import { saveMealFeedbackAction } from "@/app/actions";

type Feedback = { reaction: string | null; effort: string | null; leftovers: string | null; revision: number } | null;

export function MealFeedbackForm({ planId, slotId, cookingEventId, feedback, hasLeftovers, returnTo = "week" }: {
  planId: string; slotId: string; cookingEventId: string; feedback: Feedback;
  hasLeftovers: boolean; returnTo?: "week" | "history";
}) {
  return <details className="meal-repair meal-feedback"><summary>{feedback ? "Edit meal feedback" : "How was this meal?"}</summary>
    <p>Optional answers help us learn what to repeat and what needs a break. “Need a break” lasts four weeks.</p>
    <form action={saveMealFeedbackAction}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="cookingEventId" value={cookingEventId} />
      <input type="hidden" name="expectedRevision" value={feedback?.revision ?? 0} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Would you cook it again?
        <select name="reaction" defaultValue={feedback?.reaction ?? ""}>
          <option value="">Skip this question</option>
          <option value="loved">Loved it</option>
          <option value="good">Good</option>
          <option value="break">Need a break</option>
          <option value="not_again">Not again</option>
        </select>
      </label>
      <label>How did the effort feel?
        <select name="effort" defaultValue={feedback?.effort ?? ""}>
          <option value="">Skip this question</option>
          <option value="easy">Easy</option>
          <option value="about_right">About right</option>
          <option value="too_much">Too much effort</option>
        </select>
      </label>
      {hasLeftovers && <label>How did the leftovers sound?
        <select name="leftovers" defaultValue={feedback?.leftovers ?? ""}>
          <option value="">Skip this question</option>
          <option value="appealing">Appealing</option>
          <option value="okay">Okay</option>
          <option value="not_appealing">Not appealing</option>
        </select>
      </label>}
      <button type="submit">Save feedback</button>
    </form>
  </details>;
}
