"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Accounts", href: "/accounts" },
  { label: "Transactions", href: "/transactions" },
  { label: "Bills", href: "/bills" },
  { label: "Subscriptions", href: "/subscriptions" },
  { label: "Goals", href: "/goals" },
  { label: "Forecast", href: "/forecast" },
  { label: "Decide", href: "/decide" },
  { label: "Settings", href: "/settings" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-[220px] border-r border-zinc-800 bg-zinc-900 text-zinc-100 md:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-zinc-800 px-5 py-6">
          <p className="text-sm text-zinc-400">Personal Finance</p>
          <h1 className="text-lg font-semibold">Steward Money</h1>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-zinc-950 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-600"}`}
                  aria-hidden
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
