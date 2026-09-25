import Link from "next/link";
import { createRecipeDraftAction, importRecipeAction } from "@/app/recipes/actions";
import { SiteHeader } from "@/components/site-header";

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ importError?: string; url?: string }> }) {
  const { importError, url } = await searchParams;
  return <main className="page"><div className="shell"><SiteHeader />
    <div className="recipe-breadcrumb"><Link href="/recipes">← Recipes</Link></div>
    <section className="library-heading"><p className="overline">Your kitchen</p><h1>Add a recipe.</h1>
      <p className="lead">Start from scratch or pull in a recipe link. Both open an editable draft.</p></section>
    <div className="recipe-layout"><section className="panel recipe-section"><h2>Write your own</h2>
      <p>Add ingredients and steps, then save whenever you like.</p><form action={createRecipeDraftAction}><button type="submit">Start a recipe</button></form>
    </section><section className="panel recipe-section"><h2>Import a link</h2>
      <p>Paste a public recipe page. You can review every field before adding it to your library.</p>
      {importError && <p className="plan-error" role="alert">{importError}</p>}
      <form action={importRecipeAction} className="recipe-controls"><label htmlFor="import-url">Recipe URL</label>
        <input id="import-url" name="url" type="url" required placeholder="https://example.com/recipe" defaultValue={url ?? ""} />
        <button type="submit">Import recipe</button></form>
      <p className="subtle">If a website blocks import, start a recipe and paste its ingredients and steps into the editor.</p>
    </section></div>
  </div></main>;
}
