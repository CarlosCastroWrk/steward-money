"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const PRIMARY_NAV = [
  {
    label: "Home",
    href: "/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125A1.125 1.125 0 005.625 21H9.75v-4.875A1.125 1.125 0 0110.875 15h2.25A1.125 1.125 0 0114.25 16.125V21h4.125A1.125 1.125 0 0019.5 19.875V9.75" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  },
  {
    label: "Bills",
    href: "/bills",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
];

const MORE_NAV = [
  { label: "Goals", href: "/goals" },
  { label: "Subscriptions", href: "/subscriptions" },
  { label: "Forecast", href: "/forecast" },
  { label: "Decide", href: "/decide" },
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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute left-3 right-3 overflow-hidden rounded-2xl border border-[#ffffff08] bg-[#13131f] px-4 pb-4 pt-3 shadow-2xl shadow-black/60"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 h-1 w-10 rounded-full bg-zinc-700 mx-auto" />
            <div className="grid grid-cols-2 gap-2">
              {MORE_NAV.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-400"
                        : "border-[#ffffff06] bg-[#1a1a28] text-zinc-300 hover:border-[#ffffff10]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating glass nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div
          className="mx-3 overflow-hidden rounded-2xl border border-[#ffffff08] bg-[#13131f]/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
          style={{ marginBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <div className="flex items-stretch px-1 py-1">
            {PRIMARY_NAV.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="h-0.5 w-4 rounded-full bg-emerald-400" />
                  )}
                </Link>
              );
            })}

            {/* More button */}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[10px] font-medium transition-colors ${
                isMoreActive || moreOpen ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span>More</span>
              {(isMoreActive || moreOpen) && (
                <span className="h-0.5 w-4 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
