import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "STB Token Dashboard",
  description: "Stabble STB token distribution tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0d1117]">
        <header className="border-b border-[#21262d] bg-[#161b22]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#58a6ff] to-[#2dd4bf] flex items-center justify-center text-xs font-bold text-black">S</div>
            <span className="font-semibold text-[#e6edf3]">STB Tracker</span>
            <span className="text-[#30363d]">|</span>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors">Dashboard</Link>
              <Link href="/holders" className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors">Holders</Link>
              <Link href="/analytics" className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors">Analytics</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
