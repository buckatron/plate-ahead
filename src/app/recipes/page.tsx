import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { listDinnerRecipes } from "@/repositories/recipes";
import { archiveRecipeAction, editRecipeAction, setPrototypeRecipesAction, setRecipePlanningAction } from "./actions";
import { prisma } from "@/services/prisma";
import { decodeRecipeText } from "@/domain/meals/recipe-jsonld";

export const dynamic = "force-dynamic";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ error?: string; q?: string }> }) {
  const { error, q } = await searchParams;
  const search = (q ?? "").trim().slice(0, 100);
  const needle = search.toLocaleLowerCase();
  const allDinners = await listDinnerRecipes();
  const visibleWhere = await import("@/repositories/recipe-visibility").then((module) => module.recipeVisibility("home", false));
  const lunches = await prisma.recipe.findMany({ where: { AND: [visibleWhere, { role: "lunch" }] },
    orderBy: [{ recipeKey: "asc" }, { version: "desc" }] });
  const currentLunches = [...new Map([...lunches].reverse().map((recipe) => [recipe.recipeKey, recipe])).values()]
    .sort((a, b) => a.title.localeCompare(b.title));
  const recipes = needle ? allDinners.filter((recipe) => [recipe.title, recipe.summary,
    ...recipe.tags.map((tag) => tag.value)].some((value) => value.toLocaleLowerCase().includes(needle))) : allDinners;
  const shownLunches = needle ? currentLunches.filter((recipe) => [recipe.title, recipe.summary]
    .some((value) => value.toLocaleLowerCase().includes(needle))) : currentLunches;
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
        <div className="library-heading"><h1>Recipes</h1>
          <p className="lead">Browse, add, and edit recipes for your plans.</p></div>
        {error && <p className="plan-error" role="alert">{error}</p>}
        <div className="recipe-library-tools">
          <Link href="/recipes/new" className="primary-button">Add a recipe</Link>
          <Link href="/recipes/pair" className="secondary-button">Plan a leftover lunch</Link>
          <form method="get" className="recipe-search"><label htmlFor="recipe-search">Find a recipe</label>
            <div><input id="recipe-search" name="q" type="search" defaultValue={search} placeholder="Name or cuisine" />
              <button type="submit">Search</button>{search && <Link href="/recipes">Clear</Link>}</div>
          </form>
        </div>
        <details className="recipe-planning-preference"><summary>Planning catalog: {preferences?.includePrototypeRecipes === false ? "only my recipes" : "my recipes and starters"}</summary>
          <div><form action={setPrototypeRecipesAction}><input type="hidden" name="include" value={preferences?.includePrototypeRecipes === false ? "1" : "0"} />
            <button type="submit">{preferences?.includePrototypeRecipes === false ? "Include starter recipes in plans" : "Use only my recipes in plans"}</button>
          </form><p>This also changes which recipes appear below.</p></div>
        </details>
        {drafts.length > 0 && <section className="drafts-summary"><h2>Drafts</h2><ul>{drafts.map((draft) => {
          let title = "Untitled recipe";
          try { title = (JSON.parse(draft.payloadJson) as { title?: string }).title || title; } catch { /* Keep the draft accessible. */ }
          return <li key={draft.id}><Link href={`/recipes/drafts/${draft.id}`}>{title}</Link></li>;
        })}</ul></section>}
        {entries.some((entry) => entry.archivedAt) && <section className="panel recipe-section"><h2>Archived recipes</h2><ul>{entries.filter((entry) => entry.archivedAt).map((entry) => <li key={entry.id}>
          <Link href={`/recipes/${entry.recipeKey}`}>{archivedTitles.get(entry.currentRecipeId ?? "") ?? entry.recipeKey}</Link> <form action={archiveRecipeAction}>
            <input type="hidden" name="recipeKey" value={entry.recipeKey} /><input type="hidden" name="archived" value="0" /><button type="submit">Restore</button></form>
        </li>)}</ul></section>}
        <div className="library-count">{recipes.length} {recipes.length === 1 ? "dinner" : "dinners"}{search ? ` matching “${search}”` : ""}</div>
        {recipes.length === 0 && <p className="library-empty">{search ? "No matching dinners. Try another search or clear it." : "No dinners in this library yet. Add a recipe or include starter recipes."}</p>}
        <section className="recipe-grid" aria-label="Dinner recipes">
          {recipes.map((recipe) => {
            const cuisine = recipe.tags.find((tag) => tag.dimension === "cuisine")?.value ?? "Dinner";
            return (
              <article className="recipe-card" key={recipe.id}>
                <div className="recipe-card-top"><span>{cuisine}</span><span>{recipe.totalMinutes} min</span></div>
                <h2><Link href={`/recipes/${recipe.recipeKey}`}>{recipe.title}</Link></h2>
                <p>{decodeRecipeText(recipe.summary)}</p>
                {recipe.lunches.length > 0 && <div className="recipe-card-lunch">Leftover lunch: {recipe.lunches.map((lunch) => lunch.title).join(", ")}</div>}
                <Link className="text-link" href={`/recipes/${recipe.recipeKey}`}>View recipe <span aria-hidden="true">→</span></Link>
                <div className="recipe-controls"><form action={editRecipeAction}>
                  <input type="hidden" name="recipeKey" value={recipe.recipeKey} /><button type="submit">Edit</button>
                </form><form action={setRecipePlanningAction}><input type="hidden" name="recipeKey" value={recipe.recipeKey} />
                  <input type="hidden" name="include" value={entryByKey.get(recipe.recipeKey)?.includeInPlanning === false ? "1" : "0"} />
                  <button type="submit">{entryByKey.get(recipe.recipeKey)?.includeInPlanning === false ? "Use in plans" : "Pause suggestions"}</button>
                </form><form action={archiveRecipeAction}><input type="hidden" name="recipeKey" value={recipe.recipeKey} />
                  <input type="hidden" name="archived" value="1" /><button type="submit">Archive</button></form></div>
              </article>
            );
          })}
        </section>
        {shownLunches.length > 0 && <section className="lunch-library"><h2>Lunch recipes</h2>
          <ul className="lunch-library-grid">{shownLunches.map((recipe) => <li className="lunch-library-card" key={recipe.id}><span className="overline">Lunch · {recipe.totalMinutes} min</span><h3><Link href={`/recipes/${recipe.recipeKey}`}>{recipe.title}</Link></h3><p>{decodeRecipeText(recipe.summary)}</p>
            <div className="recipe-controls"><form action={editRecipeAction}>
              <input type="hidden" name="recipeKey" value={recipe.recipeKey} /><button type="submit">Edit</button>
            </form><form action={setRecipePlanningAction}><input type="hidden" name="recipeKey" value={recipe.recipeKey} />
              <input type="hidden" name="include" value={entryByKey.get(recipe.recipeKey)?.includeInPlanning === false ? "1" : "0"} />
              <button type="submit">{entryByKey.get(recipe.recipeKey)?.includeInPlanning === false ? "Use in plans" : "Pause suggestions"}</button>
            </form><form action={archiveRecipeAction}><input type="hidden" name="recipeKey" value={recipe.recipeKey} />
              <input type="hidden" name="archived" value="1" /><button type="submit">Archive</button></form></div>
          </li>)}</ul>
        </section>}
      </div>
    </main>
  );
}
