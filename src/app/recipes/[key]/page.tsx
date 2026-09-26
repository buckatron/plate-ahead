import Link from "next/link";
import { editRecipeAction } from "@/app/recipes/actions";
import { decodeRecipeText } from "@/domain/meals/recipe-jsonld";
import { parseIngredientLine } from "@/domain/meals/personal-recipe";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { scaleQuantity } from "@/domain/meals/quantity";
import { formatIngredientAmount, formatQuantity, scaleRecipe } from "@/domain/meals/scale-recipe";
import { getRecipe } from "@/repositories/recipes";

export const dynamic = "force-dynamic";

type RecipePageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ servings?: string; lunch?: string; version?: string }>;
};

export default async function RecipePage({ params, searchParams }: RecipePageProps) {
  const { key } = await params;
  const query = await searchParams;
  const version = Number(query.version);
  const detail = await getRecipe(key, "home", Number.isInteger(version) && version > 0 ? version : undefined);
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
  const isCurrentRecipe = !query.version || (recipe.entryId && recipe.entry?.currentRecipeId === recipe.id);
  const reviewLines = recipe.entryId ? recipe.components.flatMap((component) => component.ingredients.flatMap((ingredient) =>
    ingredient.originalText && parseIngredientLine(ingredient.originalText).kind === "error" ? [ingredient.originalText] : [])) : [];

  return (
    <main className="page">
      <div className="shell">
        <SiteHeader />
        <div className="recipe-breadcrumb"><Link href="/recipes">← All recipes</Link><span>/</span><span>{recipe.role === "dinner" ? "Dinner" : "Lunch"}</span></div>
        <section className="recipe-hero">
          <div>
            <p className="overline">{cuisine} · {recipe.role}</p>
            <h1>{recipe.title}</h1>
            <p className="lead">{decodeRecipeText(recipe.summary)}</p>
            <div className="recipe-meta"><span>{recipe.totalMinutes} min total</span><span>{recipe.activeMinutes > 0 ? `${recipe.activeMinutes} min active` : "Active time not specified"}</span><span>Serves {servings}</span></div>
            {isCurrentRecipe && <form action={editRecipeAction} className="recipe-edit-action">
              <input type="hidden" name="recipeKey" value={recipe.recipeKey} />
              <button type="submit">Edit this recipe</button>
            </form>}
            {query.version && !isCurrentRecipe && <p className="recipe-version-note">Viewing version {recipe.version}. <Link href={`/recipes/${recipe.recipeKey}`}>See the current recipe →</Link></p>}
          </div>
        </section>

        {reviewLines.length > 0 && <div className="recipe-review" role="alert">
          <strong>Check these ingredient amounts before shopping or cooking.</strong>
          <p>These saved lines may include a range, an alternative, or an optional amount. {isCurrentRecipe ? "Use Edit this recipe above to choose clear amounts:" : "Check the current recipe before planning another week:"}</p>
          <ul>{reviewLines.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}</ul>
        </div>}

        <div className="recipe-layout">
          <div className="recipe-main">
            <section className="panel recipe-section">
              <div className="panel-head"><h2>Ingredients</h2><span className="subtle">For {servings}</span></div>
              <form method="get" className="recipe-controls">
                  {query.version && <input type="hidden" name="version" value={query.version} />}
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
                  <ul className="ingredient-list">{component.ingredients.map((item, index) => <li key={item.id ?? index}><span>{item.ingredient.name}</span><strong>{item.scaled ? formatIngredientAmount(item.scaled) : "to taste"}</strong></li>)}</ul>
                </div>
              ))}
              {lunchDetail && <div className="ingredient-group lunch-ingredients"><h3>For the new lunch</h3><p className="ingredient-hint">Add these to the dinner ingredients above.</p>
                <ul className="ingredient-list">{scaledLunch.flatMap((component) => component.ingredients.map((item, index) =>
                  <li key={item.id ?? `${component.id}:${index}`}><span>{item.ingredient.name}</span><strong>{item.scaled ? formatIngredientAmount(item.scaled) : "to taste"}</strong></li>))}</ul>
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
            {lunchLink?.target && <div className="panel lunch-panel"><span className="overline">Leftover lunch</span><h2>{lunchLink.target.title}</h2><p>{lunchLink.transformation.description}</p><Link className="text-link" href={`/recipes/${lunchLink.target.recipeKey}`}>View lunch recipe →</Link></div>}
            <div className="panel safety-panel"><h2>Kitchen notes</h2><p>{recipe.sourceAttribution}</p>
              {recipe.sourceUrl && <p><a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">View the original recipe ↗</a></p>}
              {recipe.components.filter((component) => component.storageGuidance).map((component) => <p key={component.id}>{component.storageGuidance} <a href={component.storageSourceUrl ?? "https://www.foodsafety.gov/"} target="_blank" rel="noreferrer">Storage guidance</a></p>)}
              <p>Check meat, fish, and reheated leftovers with a thermometer. <a href="https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures" target="_blank" rel="noreferrer">Safe temperatures</a></p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
