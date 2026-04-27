import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Stewart } from "@/components/Stewart";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Steward Money",
  description: "Your personal finance dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-zinc-950 md:ml-[240px] pb-20 md:pb-0">
          {children}
        </main>
        <BottomNav />
        <Stewart />
      </body>
    </html>
  );
}
