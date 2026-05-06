"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Home, CreditCard, ArrowLeftRight, FileText, LayoutGrid, Activity, Layers } from "lucide-react";

const PRIMARY_NAV = [
  { label: "Home",     href: "/",       icon: <Home size={22} strokeWidth={1.6} /> },
  { label: "Expenses", href: "/bills",  icon: <FileText size={22} strokeWidth={1.6} /> },
  { label: "Pulse",    href: "/pulse",  icon: <Activity size={22} strokeWidth={1.6} /> },
  { label: "Card",     href: "/card",   icon: <Layers size={22} strokeWidth={1.6} /> },
];

const MORE_NAV = [
  { label: "Activity", href: "/transactions" },
  { label: "Accounts", href: "/accounts" },
  { label: "Goals",    href: "/goals" },
  { label: "Decide",   href: "/decide" },
  { label: "Council",  href: "/council" },
  { label: "Settings", href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_NAV.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* More overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute left-3 right-3 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 pb-4 pt-3 shadow-card"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 h-1 w-10 rounded-full bg-[var(--border-default)] mx-auto" />
            <div className="grid grid-cols-2 gap-2">
              {MORE_NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-150 ${
                      active
                        ? "border-[var(--accent-border)] bg-[var(--accent-glow)] text-[var(--accent)]"
                        : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              <span className="text-xs text-[var(--text-muted)]">Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {/* Nav bar */}
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
            {PRIMARY_NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[10px] font-medium transition-all duration-150 ${
                    active ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {active && <span className="h-0.5 w-4 rounded-full bg-[var(--accent)]" />}
                </Link>
              );
            })}

            {/* More */}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[10px] font-medium transition-all duration-150 ${
                isMoreActive || moreOpen ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <LayoutGrid size={22} strokeWidth={1.6} />
              <span>More</span>
              {(isMoreActive || moreOpen) && <span className="h-0.5 w-4 rounded-full bg-[var(--accent)]" />}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
