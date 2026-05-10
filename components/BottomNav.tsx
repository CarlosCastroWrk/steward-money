"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, ArrowLeftRight, LayoutGrid, Activity, Wallet } from "lucide-react";

const NAV_ROUTES = ["/", "/pulse", "/transactions", "/accounts"];

const PRIMARY_NAV = [
  { label: "Home",     href: "/",             icon: <Home size={22} strokeWidth={1.6} /> },
  { label: "Pulse",    href: "/pulse",        icon: <Activity size={22} strokeWidth={1.6} /> },
  { label: "Activity", href: "/transactions", icon: <ArrowLeftRight size={22} strokeWidth={1.6} /> },
  { label: "Accounts", href: "/accounts",     icon: <Wallet size={22} strokeWidth={1.6} /> },
];

const MORE_ACTIVE_PREFIXES = ["/bills", "/card", "/goals", "/decide", "/council", "/settings", "/more", "/subscriptions"];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    PRIMARY_NAV.forEach((item) => router.prefetch(item.href));
  }, [router]);

  // Hide on full-screen overlays (agent detail pages use fixed inset-0 overlay)
  if (pathname.startsWith("/pulse/")) return null;

  const currentNavIndex = NAV_ROUTES.findIndex((r) =>
    r === "/" ? pathname === "/" : pathname.startsWith(r)
  );

  const isMoreActive = MORE_ACTIVE_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div
        className="mx-3 overflow-hidden rounded-2xl border border-[var(--border-default)] shadow-card"
        style={{
          marginBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          background: "rgba(var(--bg-card-rgb, 19,19,31), 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          backgroundColor: "color-mix(in srgb, var(--bg-card) 92%, transparent)",
        }}
      >
        <div className="flex items-stretch px-1 py-1">
          {PRIMARY_NAV.map((item, i) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  if (active) return;
                  const dir = i > currentNavIndex ? 1 : -1;
                  window.dispatchEvent(new CustomEvent("nav:direction", { detail: { direction: dir } }));
                  router.push(item.href);
                }}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[10px] font-medium transition-all duration-150 ${
                  active
                    ? "text-[var(--accent)] bg-[var(--accent)]/8"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {active && <span className="h-0.5 w-4 rounded-full bg-[var(--accent)]" />}
              </button>
            );
          })}

          {/* More */}
          <button
            type="button"
            onClick={() => {
              const dir = currentNavIndex >= 0 ? 1 : 0;
              window.dispatchEvent(new CustomEvent("nav:direction", { detail: { direction: dir } }));
              router.push("/more");
            }}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[10px] font-medium transition-all duration-150 ${
              isMoreActive
                ? "text-[var(--accent)] bg-[var(--accent)]/8"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <LayoutGrid size={22} strokeWidth={1.6} />
            <span>More</span>
            {isMoreActive && <span className="h-0.5 w-4 rounded-full bg-[var(--accent)]" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
