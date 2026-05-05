import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Luka } from "@/components/Luka";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { SessionGuard } from "@/components/security/SessionGuard";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Steward Money",
    template: "%s — Steward Money",
  },
  description: "Your personal financial co-pilot",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Steward",
  },
};

export const viewport: Viewport = {
  themeColor: "#7857ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen bg-[var(--bg)] text-[var(--text-1)] antialiased font-sans">
        <ThemeProvider>
          <ToastProvider>
            <Sidebar />
            <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg)] md:ml-[228px] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
              {children}
            </main>
            <BottomNav />
            <div className="fixed right-4 top-[calc(env(safe-area-inset-top)+12px)] z-[52] md:hidden">
              <NotificationBell align="right" />
            </div>
            <Luka />
            <SessionGuard />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
