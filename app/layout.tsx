import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "10 признаков теневой Excel-системы | TABULA CONSULTING",
  description:
    "Self-check для CFO: определите, где живёт управленческий факт и не стал ли Excel теневой системой управления.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
