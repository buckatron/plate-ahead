import Link from "next/link";
import { importRecipeAction } from "@/app/recipes/actions";
import { SiteHeader } from "@/components/site-header";
import { previewRecipeUrl } from "@/services/import-recipe";

export const dynamic = "force-dynamic";

export default async function ChooseImportPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  let choices: Awaited<ReturnType<typeof previewRecipeUrl>> = [];
  let error = "";
  try { if (url) choices = await previewRecipeUrl(url); } catch { error = "Could not read this page again. Retry the link or paste the recipe text manually."; }
  return <main className="page"><div className="shell"><SiteHeader />
    <div className="recipe-breadcrumb"><Link href="/recipes/new">← Import another link</Link></div>
    <section className="library-heading"><p className="overline">Import a link</p><h1>Choose a recipe.</h1></section>
    {error && <p className="plan-error" role="alert">{error}</p>}
    <div className="recipe-grid">{choices.map((choice, index) => <article className="recipe-card" key={`${choice.title}-${index}`}>
      <h2>{choice.title}</h2><p>{choice.summary}</p>
      <form action={importRecipeAction}><input type="hidden" name="url" value={url} />
        <input type="hidden" name="selection" value={index} /><button type="submit">Review this recipe</button></form>
    </article>)}</div>
  </div></main>;
}
