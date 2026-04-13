import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muse Hotel Intelligence",
  description:
    "Deep research on hotels for the Muse sales team — contacts, challenges, services, ADR and positioning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 antialiased">{children}</body>
    </html>
  );
}
