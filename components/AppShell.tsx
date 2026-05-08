"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Luka } from "./Luka";
import { NotificationBell } from "./NotificationBell";
import { SessionGuard } from "./security/SessionGuard";
import { SyncOnFocus } from "./SyncOnFocus";
import { SwipeableNavigator } from "./SwipeableNavigator";

const AUTH_PATHS = ["/login", "/signup", "/sign-in", "/sign-up", "/register", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.includes(pathname) || pathname.startsWith("/auth/");
  const isOnboarding = pathname.startsWith("/onboarding");

  if (isAuthPage || isOnboarding) {
    return (
      <main className="min-h-screen w-full bg-[var(--bg)]">
        {children}
      </main>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg)] md:ml-[228px] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 pt-[env(safe-area-inset-top)] md:pt-0">
        <SwipeableNavigator>
          {children}
        </SwipeableNavigator>
      </main>
      <BottomNav />
      <div className="fixed right-4 top-[calc(env(safe-area-inset-top)+12px)] z-[52] md:hidden">
        <NotificationBell align="right" />
      </div>
      <Luka />
      <SessionGuard />
      <SyncOnFocus />
    </>
  );
}
