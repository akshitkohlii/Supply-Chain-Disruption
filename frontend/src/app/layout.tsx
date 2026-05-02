import type { Metadata } from "next";

import "./globals.css";
import Sidebar from "@/components/navigation/Sidebar";

export const metadata: Metadata = {
  title: "Supply Chain Risk Dashboard",
  description:
    "Monitor supply chain disruptions, route risk, port congestion, emerging signals, and mitigation actions from a unified dashboard.",
  applicationName: "Supply Chain Risk Dashboard",
  keywords: [
    "supply chain",
    "risk dashboard",
    "logistics",
    "route disruption",
    "port congestion",
    "mitigation",
  ],
  openGraph: {
    title: "Supply Chain Risk Dashboard",
    description:
      "Monitor supply chain disruptions, route risk, port congestion, emerging signals, and mitigation actions from a unified dashboard.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden bg-slate-950 text-white antialiased">
        <div className="flex h-screen bg-[radial-gradient(circle_at_top,#162033_0%,#0b1220_45%,#070b14_100%)]">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
