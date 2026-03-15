import "./globals.css";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#162033_0%,#0b1220_45%,#070b14_100%)]">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <Topbar />
              <main className="flex-1 p-4 md:p-6">{children}</main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
