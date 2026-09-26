import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plate Ahead",
  description: "Plan dinners, leftover lunches, and groceries.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
