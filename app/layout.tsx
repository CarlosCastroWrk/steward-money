import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steward Money",
  description: "Personal finance app shell"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-zinc-900 md:ml-[220px] pb-20 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
