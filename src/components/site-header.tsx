"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "This week", current: pathname === "/" || pathname.startsWith("/swap") },
    { href: "/groceries", label: "Groceries", current: pathname.startsWith("/groceries") },
    { href: "/recipes", label: "Recipes", current: pathname.startsWith("/recipes") },
    { href: "/history", label: "History", current: pathname.startsWith("/history") },
  ];
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Plate Ahead home">plate <span>ahead</span><span className="brand-dot">.</span></Link>
      <nav className="site-nav" aria-label="Main navigation">
        {links.map((link) => <Link key={link.href} href={link.href} aria-current={link.current ? "page" : undefined}>{link.label}</Link>)}
      </nav>
    </header>
  );
}
