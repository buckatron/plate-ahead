import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Misewell home">mise<span>well</span><span className="brand-dot">.</span></Link>
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/">This week</Link>
        <Link href="/groceries">Groceries</Link>
        <Link href="/recipes">Recipes</Link>
      </nav>
    </header>
  );
}
