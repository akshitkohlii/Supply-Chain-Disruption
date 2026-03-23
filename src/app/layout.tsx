import "./globals.css";
import Sidebar from "@/components/dashboard/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased overflow-hidden">
        <div className="h-screen bg-[radial-gradient(circle_at_top,#162033_0%,#0b1220_45%,#070b14_100%)]">
          <Sidebar />

          <div className="h-screen lg:ml-20 lg:peer-hover:ml-64 transition-all duration-300">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}