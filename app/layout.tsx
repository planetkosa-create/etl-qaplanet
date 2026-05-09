import type { Metadata } from "next";
import { AppShell } from "@/components/etl/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETL QAplanet",
  description: "A QAplanet data validation product for ETL testing workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
