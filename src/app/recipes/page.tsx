import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { listDinnerRecipes } from "@/repositories/recipes";
import { archiveRecipeAction, editRecipeAction, setPrototypeRecipesAction, setRecipePlanningAction } from "./actions";
import { prisma } from "@/services/prisma";

export const dynamic = "force-dynamic";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const recipes = await listDinnerRecipes();
  const visibleWhere = await import("@/repositories/recipe-visibility").then((module) => module.recipeVisibility("home", false));
  const lunches = await prisma.recipe.findMany({ where: { AND: [visibleWhere, { role: "lunch" }] },
    orderBy: [{ title: "asc" }, { version: "desc" }] });
  const currentLunches = [...new Map([...lunches].reverse().map((recipe) => [recipe.recipeKey, recipe])).values()];
  const [drafts, entries, preferences] = await Promise.all([
    prisma.recipeDraft.findMany({ where: { householdId: "home" }, orderBy: { updatedAt: "desc" } }),
    prisma.recipeEntry.findMany({ where: { householdId: "home" }, orderBy: { updatedAt: "desc" } }),
    prisma.householdPreferences.findUnique({ where: { householdId: "home" } }),
  ]);
  const archivedTitles = new Map((await prisma.recipe.findMany({ where: { id: { in: entries.flatMap((entry) => entry.currentRecipeId ? [entry.currentRecipeId] : []) } },
    select: { id: true, title: true } })).map((recipe) => [recipe.id, recipe.title]));
  const entryByKey = new Map(entries.map((entry) => [entry.recipeKey, entry]));

  return (
    <main className="page">
      <div className="shell">
        <SiteHeader />
        <div className="library-heading">
          <p className="overline">The recipe library</p>
          <h1>Good dinners,<br /><em>room to explore.</em></h1>
          <p className="lead">Browse different cuisines and cooking styles. Some dinners have a planned second life as a new lunch.</p>
        </div>
        <div className="library-count">{recipes.length} dinners to explore</div>
        {error && <p className="plan-error" role="alert">{error}</p>}
        <div className="recipe-controls"><Link href="/recipes/new" className="text-link">Add a recipe →</Link>
          <Link href="/recipes/pair" className="text-link">Link dinner to lunch →</Link>
          <form action={setPrototypeRecipesAction}><input type="hidden" name="include" value={preferences?.includePrototypeRecipes === false ? "1" : "0"} />
            <button type="submit">{preferences?.includePrototypeRecipes === false ? "Include prototype recipes" : "Show only my recipes"}</button>
          </form></div>
        {drafts.length > 0 && <section className="panel recipe-section"><h2>Your drafts</h2><ul>{drafts.map((draft) => {
          let title = "Untitled recipe";
          try { title = (JSON.parse(draft.payloadJson) as { title?: string }).title || title; } catch { /* Keep the draft accessible. */ }
          return <li key={draft.id}><Link href={`/recipes/drafts/${draft.id}`}>{title}</Link></li>;
        })}</ul></section>}
        {entries.some((entry) => entry.archivedAt) && <section className="panel recipe-section"><h2>Archived recipes</h2><ul>{entries.filter((entry) => entry.archivedAt).map((entry) => <li key={entry.id}>
          <Link href={`/recipes/${entry.recipeKey}`}>{archivedTitles.get(entry.currentRecipeId ?? "") ?? entry.recipeKey}</Link> <form action={archiveRecipeAction}>
            <input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="archived" value="0" /><button type="submit">Restore</button></form>
        </li>)}</ul></section>}
        <section className="recipe-grid" aria-label="Dinner recipes">
          {recipes.map((recipe) => {
            const cuisine = recipe.tags.find((tag) => tag.dimension === "cuisine")?.value ?? "Dinner";
            return (
              <article className="recipe-card" key={recipe.id}>
                <div className="recipe-card-top"><span>{cuisine}</span><span>{recipe.totalMinutes} min</span></div>
                <h2><Link href={`/recipes/${recipe.recipeKey}`}>{recipe.title}</Link></h2>
                <p>{recipe.summary}</p>
                {recipe.lunches.length > 0 && <div className="recipe-card-lunch">Becomes lunch: {recipe.lunches.map((lunch) => lunch.title).join(", ")}</div>}
                <Link className="text-link" href={`/recipes/${recipe.recipeKey}`}>View recipe <span aria-hidden="true">→</span></Link>
                {entryByKey.has(recipe.recipeKey) && <div className="recipe-controls"><form action={editRecipeAction}>
                  <input type="hidden" name="entryId" value={entryByKey.get(recipe.recipeKey)!.id} /><button type="submit">Edit</button>
                </form><form action={setRecipePlanningAction}><input type="hidden" name="entryId" value={entryByKey.get(recipe.recipeKey)!.id} />
                  <input type="hidden" name="include" value={entryByKey.get(recipe.recipeKey)!.includeInPlanning ? "0" : "1"} />
                  <button type="submit">{entryByKey.get(recipe.recipeKey)!.includeInPlanning ? "Pause suggestions" : "Use in plans"}</button>
                </form><form action={archiveRecipeAction}><input type="hidden" name="entryId" value={entryByKey.get(recipe.recipeKey)!.id} />
                  <input type="hidden" name="archived" value="1" /><button type="submit">Archive</button></form></div>}
              </article>
            );
          })}
        </section>
        {currentLunches.length > 0 && <section className="panel recipe-section"><h2>Lunch recipes</h2>
          <ul>{currentLunches.map((recipe) => <li key={recipe.id}><Link href={`/recipes/${recipe.recipeKey}`}>{recipe.title}</Link>
            {entryByKey.has(recipe.recipeKey) && <div className="recipe-controls"><form action={editRecipeAction}>
              <input type="hidden" name="entryId" value={entryByKey.get(recipe.recipeKey)!.id} /><button type="submit">Edit</button>
            </form><form action={setRecipePlanningAction}><input type="hidden" name="entryId" value={entryByKey.get(recipe.recipeKey)!.id} />
              <input type="hidden" name="include" value={entryByKey.get(recipe.recipeKey)!.includeInPlanning ? "0" : "1"} />
              <button type="submit">{entryByKey.get(recipe.recipeKey)!.includeInPlanning ? "Pause suggestions" : "Use in plans"}</button>
            </form><form action={archiveRecipeAction}><input type="hidden" name="entryId" value={entryByKey.get(recipe.recipeKey)!.id} />
              <input type="hidden" name="archived" value="1" /><button type="submit">Archive</button></form></div>}
          </li>)}</ul>
        </section>}
      </div>
    </main>
  );
}
