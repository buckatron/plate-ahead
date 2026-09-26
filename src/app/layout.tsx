import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plate Ahead",
  description: "A calmer way to plan delicious weeks of cooking.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
