import Link from "next/link";
import { notFound } from "next/navigation";
import { saveRecipeDraftAction } from "@/app/recipes/actions";
import { SiteHeader } from "@/components/site-header";
import { parseIngredientLine, recipeIssues } from "@/domain/meals/personal-recipe";
import { toBaseQuantity, type Unit } from "@/domain/meals/quantity";
import { findDraft } from "@/services/personal-recipes";
import { prisma } from "@/services/prisma";

export const dynamic = "force-dynamic";

export default async function RecipeDraftPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const draft = await findDraft("home", id);
  if (!draft) notFound();
  const recipe = draft.payload;
  const basedOn = draft.basedOnRecipeId ? await prisma.recipe.findUnique({ where: { id: draft.basedOnRecipeId },
    select: { version: true, entryId: true } }) : null;
  const sourceSnapshot = draft.sourceSnapshotJson ? JSON.parse(draft.sourceSnapshotJson) as {
    title?: string; yieldText?: string; ingredientLines?: string[]; steps?: string[];
  } : null;
  const issues = recipeIssues(recipe);
  const knownIngredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  const categories = ["Produce", "Meat & seafood", "Dairy", "Bread", "Dry goods", "Canned goods", "Pantry", "Protein", "Other"];
  const ingredientGroups = recipe.components.length ? recipe.components.map((component, index) => ({
    label: component.name, key: String(index), lines: component.ingredientLines })) :
    [{ label: "Whole recipe", key: "base", lines: recipe.ingredientLines }];
  return <main className="page"><div className="shell"><SiteHeader />
    <div className="recipe-breadcrumb"><Link href="/recipes">← Recipes</Link></div>
    <section className="library-heading"><p className="overline">Editable draft</p><h1>{recipe.title || "New recipe"}</h1>
      <p className="lead">Save at any point. Publish when the amounts, servings and steps are ready for planning.</p></section>
    {basedOn && <p className="recipe-version-note">Editing version {basedOn.version}. Publishing creates a new version; meals already planned or cooked keep their original recipe.</p>}
    {basedOn && !basedOn.entryId && <p className="recipe-version-note">This is a starter recipe. Your changes will become your household’s version.</p>}
    {saved && <p role="status">Draft saved.</p>}{error && <p className="plan-error" role="alert">{error}</p>}
    {sourceSnapshot && <details className="panel recipe-section"><summary>Original imported recipe text</summary>
      <h2>{sourceSnapshot.title}</h2>{sourceSnapshot.yieldText && <p>Source yield: {sourceSnapshot.yieldText}</p>}
      <h3>Ingredients</h3><ul>{sourceSnapshot.ingredientLines?.map((line, index) => <li key={index}>{line}</li>)}</ul>
      <h3>Instructions</h3><ol>{sourceSnapshot.steps?.map((step, index) => <li key={index}>{step}</li>)}</ol>
    </details>}
    {issues.length > 0 && <div className="panel recipe-section"><h2>Before publishing</h2><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
    <form action={saveRecipeDraftAction} className="panel recipe-section personal-recipe-form">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="revision" value={draft.revision} />
      <input type="hidden" name="origin" value={recipe.origin} /><input type="hidden" name="sourceUrl" value={recipe.sourceUrl} />
      <input type="hidden" name="originalYield" value={recipe.originalYield} />
      <label>Title<input name="title" maxLength={180} defaultValue={recipe.title} /></label>
      <label>Description<textarea name="summary" rows={3} defaultValue={recipe.summary} /></label>
      <div className="personal-recipe-fields"><label>Meal type<select name="role" defaultValue={recipe.role}><option value="dinner">Dinner</option><option value="lunch">Lunch</option></select></label>
        <label>Serves<input type="number" name="servings" min="0" max="24" defaultValue={recipe.servings || ""} /></label>
        <label>Total minutes<input type="number" name="totalMinutes" min="0" max="1440" defaultValue={recipe.totalMinutes || ""} /></label>
        <label>Active minutes, if known<input type="number" name="activeMinutes" min="0" max="1440" defaultValue={recipe.activeMinutes || ""} /></label>
        <label>Cuisine, if useful<input name="cuisine" defaultValue={recipe.cuisine} /></label></div>
      {recipe.originalYield && <p>Source yield: {recipe.originalYield}. Confirm servings above.</p>}
      <label>Ingredients, one per line<textarea name="ingredientLines" rows={12} defaultValue={recipe.ingredientLines.join("\n")} placeholder={"2 eggs\n150 g rice\n1 tbsp olive oil"} /></label>
      <p className="subtle">Use amounts such as 2 eggs, 150 g rice, or 1 tbsp olive oil. Choose one amount for ranges and replace vague packages or bunches before publishing.</p>
      <details><summary>Advanced: separate recipe components</summary>
        <p className="subtle">Use components when only one part of dinner should be prepared in extra quantity for lunch. When component names are filled in, their ingredient lists replace the simple list above.</p>
        {Array.from({ length: 4 }, (_, index) => {
          const component = recipe.components[index];
          return <fieldset className="personal-component" key={index}><legend>Component {index + 1}</legend>
            <label>Name<input name={`componentName:${index}`} defaultValue={component?.name ?? ""} placeholder="Roast chicken" /></label>
            <div className="personal-recipe-fields"><label>Yield amount<input type="number" name={`componentYield:${index}`} min="0.001" step="0.001" defaultValue={component?.yieldAmount ?? ""} /></label>
              <label>Yield unit<select name={`componentUnit:${index}`} defaultValue={component?.yieldUnit ?? "portion"}>
                {["portion", "g", "kg", "ml", "l", "each"].map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label></div>
            <label>Ingredients<textarea name={`componentIngredients:${index}`} rows={5} defaultValue={component?.ingredientLines.join("\n") ?? ""} /></label>
            <label>Preparation note<textarea name={`componentPreparation:${index}`} rows={2} defaultValue={component?.preparation ?? ""} /></label>
            <label className="lunch-check"><input type="checkbox" name={`componentReservable:${index}`} value="1" defaultChecked={component?.reservable} /> Can reserve this component for lunch</label>
            <label>Storage guidance<textarea name={`componentStorage:${index}`} rows={2} defaultValue={component?.storageGuidance ?? ""} /></label>
            <label>Storage guidance source<input type="url" name={`componentStorageUrl:${index}`} defaultValue={component?.storageSourceUrl ?? ""} /></label>
          </fieldset>;
        })}
      </details>
      {ingredientGroups.some((group) => group.lines.length) && <section className="personal-ingredient-review">
        <h2>Review ingredient matches</h2>
        <p className="subtle">Choose a matching grocery ingredient or leave “New ingredient” selected and choose a category. Save the draft after editing the text above to refresh this review.</p>
        {ingredientGroups.flatMap((group) => group.lines.map((line, index) => {
          const parsed = parseIngredientLine(line);
          if (parsed.kind === "error") return <p key={`${group.key}:${index}`}>{line}: {parsed.error}</p>;
          const key = `${group.key}:${index}`;
          const matching = knownIngredients.filter((ingredient) => parsed.kind === "unmeasured" ||
            toBaseQuantity({ milli: 1000, unit: ingredient.defaultUnit as Unit }).group ===
              toBaseQuantity({ milli: 1000, unit: parsed.unit }).group);
          const suggestions = matching.filter((ingredient) => ingredient.name.toLocaleLowerCase() === parsed.name.toLocaleLowerCase() ||
            ingredient.name.toLocaleLowerCase().includes(parsed.name.toLocaleLowerCase()) ||
            parsed.name.toLocaleLowerCase().includes(ingredient.name.toLocaleLowerCase())).slice(0, 8);
          const savedChoice = recipe.ingredientChoices[key];
          const savedIngredient = matching.find((ingredient) => ingredient.id === savedChoice?.ingredientId);
          if (savedIngredient && !suggestions.some((ingredient) => ingredient.id === savedIngredient.id)) suggestions.unshift(savedIngredient);
          const exact = suggestions.find((ingredient) => ingredient.name.toLocaleLowerCase() === parsed.name.toLocaleLowerCase());
          const selectedId = savedChoice?.original === line ? savedChoice.ingredientId : exact?.id ?? "";
          const selectedCategory = savedChoice?.original === line ? savedChoice.category : exact?.groceryCategory ?? "Other";
          return <div className="personal-ingredient-row" key={key}>
            <div><strong>{line}</strong><span>{group.label} · {parsed.kind === "measured" ? `${parsed.quantityMilli / 1000} ${parsed.unit}` : "amount to taste"}</span></div>
            <input type="hidden" name={`original:${key}`} value={line} />
            <label>Grocery match<select name={`match:${key}`} defaultValue={selectedId}><option value="">New ingredient</option>
              {suggestions.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select></label>
            <label>Category for new ingredient<select name={`category:${key}`} defaultValue={selectedCategory}>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          </div>;
        }))}
      </section>}
      <label>Instructions, one step per line<textarea name="steps" rows={12} defaultValue={recipe.steps.join("\n")} /></label>
      <label className="lunch-check"><input type="checkbox" name="reservable" value="1" defaultChecked={recipe.reservable} /> I want to reserve extra portions for a linked lunch</label>
      <label>Storage guidance for reserved food<textarea name="storageGuidance" rows={2} defaultValue={recipe.storageGuidance} /></label>
      <label>Source for storage guidance<input type="url" name="storageSourceUrl" defaultValue={recipe.storageSourceUrl} /></label>
      <label>Source or author<input name="sourceAttribution" defaultValue={recipe.sourceAttribution} /></label>
      {recipe.sourceUrl && <p>Imported from <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">the original recipe</a>.</p>}
      <div className="recipe-controls"><button type="submit" name="intent" value="save">Save draft</button>
        <button type="submit" name="intent" value="publish">Publish recipe</button></div>
    </form>
  </div></main>;
}
