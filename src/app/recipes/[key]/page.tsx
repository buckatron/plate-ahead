import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { scaleQuantity } from "@/domain/meals/quantity";
import { formatQuantity, scaleRecipe } from "@/domain/meals/scale-recipe";
import { getRecipe } from "@/repositories/recipes";

export const dynamic = "force-dynamic";

type RecipePageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ servings?: string; lunch?: string }>;
};

export default async function RecipePage({ params, searchParams }: RecipePageProps) {
  const { key } = await params;
  const query = await searchParams;
  const detail = await getRecipe(key);
  if (!detail) notFound();

  const { recipe, outgoing, incoming } = detail;
  const requested = Number(query.servings);
  const servings = Number.isInteger(requested) && requested >= 1 && requested <= 6 ? requested : recipe.baseServings;
  const lunchLink = outgoing[0];
  const includeLunch = recipe.role === "dinner" && Boolean(lunchLink?.target) && query.lunch === "1";
  const lunchDetail = includeLunch && lunchLink?.target ? await getRecipe(lunchLink.target.recipeKey) : null;
  const extraByComponent: Record<string, { milli: number; unit: "g" | "kg" | "ml" | "l" | "each" | "portion" }> = {};
  if (includeLunch && lunchLink?.target) {
    const input = lunchLink.transformation.inputs[0];
    if (input) {
      const quantity = scaleQuantity({ milli: input.requiredMilli, unit: input.unit as "g" | "kg" | "ml" | "l" | "each" | "portion" }, servings, lunchLink.target.baseServings);
      extraByComponent[lunchLink.component.id] = quantity;
    }
  }
  const scaled = scaleRecipe(recipe, servings, extraByComponent);
  const scaledLunch = lunchDetail ? scaleRecipe(lunchDetail.recipe, servings) : [];
  const cuisine = recipe.tags.find((tag) => tag.dimension === "cuisine")?.value ?? recipe.role;

  return (
    <main className="page">
      <div className="shell">
        <SiteHeader />
        <div className="recipe-breadcrumb"><Link href="/recipes">← All recipes</Link><span>/</span><span>{recipe.role === "dinner" ? "Dinner" : "Lunch"}</span></div>
        <section className="recipe-hero">
          <div>
            <p className="overline">{cuisine} · {recipe.role}</p>
            <h1>{recipe.title}</h1>
            <p className="lead">{recipe.summary}</p>
            <div className="recipe-meta"><span>{recipe.totalMinutes} min total</span><span>{recipe.activeMinutes} min active</span><span>Serves {servings}</span></div>
          </div>
        </section>

        <div className="recipe-layout">
          <div className="recipe-main">
            <section className="panel recipe-section">
              <div className="panel-head"><h2>Ingredients</h2><span className="subtle">For {servings}</span></div>
              <form method="get" className="recipe-controls">
                  <label htmlFor="servings">Servings</label>
                  <select id="servings" name="servings" defaultValue={String(servings)}>
                    {[1, 2, 3, 4, 6].map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                  {recipe.role === "dinner" && lunchLink?.target && <label className="lunch-check"><input type="checkbox" name="lunch" value="1" defaultChecked={includeLunch} /> Make a new lunch too</label>}
                  <button type="submit">Update amounts</button>
                </form>
              {scaled.map((component) => (
                <div className="ingredient-group" key={component.id}>
                  <h3>{component.name}</h3>
                  {component.extraYieldMilli > 0 && <p className="ingredient-hint">Includes {formatQuantity({ milli: component.extraYieldMilli, unit: component.yieldUnit as "g" | "kg" | "ml" | "l" | "each" | "portion" })} to reserve for lunch.</p>}
                  <ul className="ingredient-list">{component.ingredients.map((item) => <li key={item.ingredient.name}><span>{item.ingredient.name}</span><strong>{formatQuantity(item.scaled)}</strong></li>)}</ul>
                </div>
              ))}
              {lunchDetail && <div className="ingredient-group lunch-ingredients"><h3>For the new lunch</h3><p className="ingredient-hint">Add these to the dinner ingredients above.</p>
                <ul className="ingredient-list">{scaledLunch.flatMap((component) => component.ingredients).map((item) => <li key={item.ingredient.name}><span>{item.ingredient.name}</span><strong>{formatQuantity(item.scaled)}</strong></li>)}</ul>
              </div>}
              {recipe.role === "lunch" && incoming.length > 0 && <div className="ingredient-group"><h3>From the earlier dinner</h3>
                {incoming.flatMap((transformation) => transformation.inputs.map((input) => <p className="ingredient-hint" key={input.id}>{formatQuantity(scaleQuantity({ milli: input.requiredMilli, unit: input.unit as "g" | "kg" | "ml" | "l" | "each" | "portion" }, servings, recipe.baseServings))} of {transformation.sourceComponent.name.toLowerCase()} from <Link href={`/recipes/${transformation.sourceComponent.recipe.recipeKey}`}>{transformation.sourceComponent.recipe.title}</Link>.</p>))}
              </div>}
            </section>
            <section className="panel recipe-section">
              <h2>How to make it</h2>
              <ol className="recipe-steps">{recipe.steps.map((step) => <li key={step.sequence}><span>{step.sequence}</span><p>{step.text}</p></li>)}</ol>
            </section>
          </div>

          <aside className="recipe-side">
            {lunchLink?.target && <div className="panel lunch-panel"><span className="overline">A second life</span><h2>{lunchLink.target.title}</h2><p>{lunchLink.transformation.description}</p><Link className="text-link" href={`/recipes/${lunchLink.target.recipeKey}`}>View lunch recipe →</Link></div>}
            <div className="panel safety-panel"><h2>Kitchen notes</h2><p>{recipe.sourceAttribution}</p>
              {recipe.components.filter((component) => component.storageGuidance).map((component) => <p key={component.id}>{component.storageGuidance} <a href={component.storageSourceUrl ?? "https://www.foodsafety.gov/"} target="_blank" rel="noreferrer">Storage guidance</a></p>)}
              <p>Check meat, fish, and reheated leftovers with a thermometer. <a href="https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures" target="_blank" rel="noreferrer">Safe temperatures</a></p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
