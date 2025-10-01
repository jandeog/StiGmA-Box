// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import AuthActions from "../components/AuthActions";
import RoleBadge from "../components/RoleBadge";

export const metadata: Metadata = {
  title: "WOD Box",
  description: "Local demo for schedule, WOD, scores & display",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800">
          <nav className="max-w-4xl mx-auto flex items-center gap-2 p-3 text-sm text-zinc-200">
            <Link href="/" className="flex items-center">
<Image
src="/images/Stigma-Logo-white-650x705.png"
   alt="Stigma Logo"
  width={36}
     height={36}
   className="h-8 w-auto"
   priority
 />
            </Link>

            <Link href="/athletes" className="px-2 py-1 rounded hover:bg-zinc-800">Athlete</Link>
            <Link href="/schedule" className="px-2 py-1 rounded hover:bg-zinc-800">Schedule</Link>
            <Link href="/wod" className="px-2 py-1 rounded hover:bg-zinc-800">WOD</Link>
            <Link href="/score" className="px-2 py-1 rounded hover:bg-zinc-800">Scores</Link>

            <div className="ml-auto flex items-center gap-2">
              <RoleBadge />
              <Link
                href="/display"
                className="px-3 py-1 rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
              >
                TV Display
              </Link>
              <AuthActions />
            </div>
          </nav>
        </header>

        <main className="max-w-4xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
