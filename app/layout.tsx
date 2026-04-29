import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Luka } from "@/components/Luka";
import { NotificationBell } from "@/components/NotificationBell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Steward Money",
  description: "Your personal financial co-pilot",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Steward",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="flex min-h-screen bg-[#0b0b12] text-zinc-100 antialiased">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#0b0b12] md:ml-[228px] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        <BottomNav />
        {/* Mobile-only bell — fixed top-right, hidden on desktop (sidebar has it) */}
        <div
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+12px)] z-[52] md:hidden"
        >
          <NotificationBell align="right" />
        </div>
        <Luka />
      </body>
    </html>
  );
}
