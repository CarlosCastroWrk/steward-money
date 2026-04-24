import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
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
        <main className="ml-[220px] min-h-0 flex-1 overflow-y-auto bg-zinc-900">{children}</main>
      </body>
    </html>
  );
}
