"use client";

import { useRouter } from "next/navigation";
import { CreditCard, TrendingUp, Target, FileText, RefreshCw, Settings, Plug, BarChart2, LogOut, ChevronRight, BookOpen, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

const SECTIONS = [
  {
    title: "Tools",
    items: [
      { label: "Card",     href: "/card",           icon: <CreditCard size={18} strokeWidth={1.6} /> },
      { label: "Calendar", href: "/more/calendar",  icon: <Calendar   size={18} strokeWidth={1.6} /> },
      { label: "Forecast", href: "/decide",          icon: <TrendingUp size={18} strokeWidth={1.6} /> },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Goals",         href: "/goals",         icon: <Target size={18} strokeWidth={1.6} /> },
      { label: "Bills",         href: "/bills",         icon: <FileText size={18} strokeWidth={1.6} /> },
      { label: "Subscriptions", href: "/subscriptions", icon: <RefreshCw size={18} strokeWidth={1.6} /> },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings",     href: "/settings",            icon: <Settings  size={18} strokeWidth={1.6} /> },
      { label: "Integrations", href: "/more/integrations",   icon: <Plug      size={18} strokeWidth={1.6} /> },
      { label: "Memory",       href: "/more/memory",         icon: <BookOpen  size={18} strokeWidth={1.6} /> },
      { label: "API Usage",    href: "/more/usage",          icon: <BarChart2 size={18} strokeWidth={1.6} /> },
    ],
  },
];

export default function MorePage() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="px-4 pb-10 pt-6 md:px-8 md:pt-8 max-w-lg">
      <h1 className="text-2xl font-semibold text-[var(--text-1)] mb-6">More</h1>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] px-1">
              {section.title}
            </p>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              {section.items.map((item, i) => (
                <button
                  key={item.href + item.label}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)] ${
                    i < section.items.length - 1 ? "border-b border-[var(--border)]" : ""
                  }`}
                  style={{ minHeight: 56 }}
                >
                  <span className="text-[var(--text-3)]">{item.icon}</span>
                  <span className="flex-1 text-sm font-medium text-[var(--text-1)]">{item.label}</span>
                  <ChevronRight size={16} strokeWidth={1.6} className="text-[var(--text-3)]" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Bank sync note */}
        <p className="px-1 text-xs text-[var(--text-3)] leading-relaxed">
          New transactions can take a few hours to appear from your bank. Steward syncs as fast as your bank allows — most transactions appear within 1–4 hours of posting.
        </p>

        {/* Appearance + Sign out */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] px-1">
            Appearance
          </p>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <div className="flex w-full items-center gap-3 px-4 border-b border-[var(--border)]" style={{ minHeight: 56 }}>
              <span className="flex-1 text-sm font-medium text-[var(--text-1)]">Theme</span>
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
              style={{ minHeight: 56 }}
            >
              <LogOut size={18} strokeWidth={1.6} className="text-red-400" />
              <span className="flex-1 text-sm font-medium text-red-400">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
