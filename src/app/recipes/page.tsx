import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { listDinnerRecipes } from "@/repositories/recipes";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await listDinnerRecipes();

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
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
