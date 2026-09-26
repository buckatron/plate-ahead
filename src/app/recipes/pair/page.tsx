import Link from "next/link";
import { pairRecipesAction } from "@/app/recipes/actions";
import { SiteHeader } from "@/components/site-header";
import { prisma } from "@/services/prisma";
import { recipeVisibility } from "@/repositories/recipe-visibility";

export const dynamic = "force-dynamic";

export default async function PairPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const recipes = await prisma.recipe.findMany({ where: await recipeVisibility("home"),
    orderBy: [{ recipeKey: "asc" }, { version: "desc" }], include: { components: true } });
  const current = [...new Map([...recipes].reverse().map((recipe) => [recipe.recipeKey, recipe])).values()];
  const dinners = current.filter((recipe) => recipe.role === "dinner").flatMap((recipe) =>
    recipe.components.filter((component) => component.reservable).map((component) => ({ recipe, component })));
  const lunches = current.filter((recipe) => recipe.role === "lunch").flatMap((recipe) =>
    recipe.components.map((component) => ({ recipe, component })));
  return <main className="page"><div className="shell"><SiteHeader />
    <div className="recipe-breadcrumb"><Link href="/recipes">← Recipes</Link></div>
    <section className="library-heading"><h1>Plan a leftover lunch</h1>
      <p className="lead">Choose a dinner, a lunch, and how much dinner to save.</p></section>
    {saved && <p role="status">Lunch pairing saved. It can appear in new weekly plans.</p>}
    {error && <p className="plan-error" role="alert">{error}</p>}
    {(!dinners.length || !lunches.length) && <p>Add or enable a dinner with a reservable component and a lunch recipe first.</p>}
    <form action={pairRecipesAction} className="panel recipe-section personal-recipe-form">
      <label>Dinner component<select name="sourceComponentId" required>{dinners.map(({ recipe, component }) => <option key={component.id} value={component.id}>{recipe.title} · {component.name} ({component.yieldUnit})</option>)}</select></label>
      <label>Lunch component<select name="targetComponentId" required>{lunches.map(({ recipe, component }) => <option key={component.id} value={component.id}>{recipe.title} · {component.name}</option>)}</select></label>
      <label>Amount of dinner component to reserve per base lunch yield<input type="number" name="requiredAmount" min="0.001" max="100000" step="0.001" placeholder="e.g. 200 for g, 2 for portions" required /></label>
      <label>How the leftovers become lunch<textarea name="description" rows={3} required placeholder="Use the reserved roast vegetables in a fresh wrap with yogurt and herbs." /></label>
      <label>Required state of the reserved food<input name="compatibleState" required placeholder="Cooked, refrigerated and unsauced" /></label>
      <button type="submit" disabled={!dinners.length || !lunches.length}>Save lunch pairing</button>
    </form>
  </div></main>;
}
