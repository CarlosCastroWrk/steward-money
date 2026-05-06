"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import {
  Home,
  CreditCard,
  ArrowLeftRight,
  FileText,
  Activity,
  Target,
  Scale,
  Layers,
  Users,
  Settings,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/",             icon: <Home size={16} strokeWidth={1.6} /> },
  { label: "Pulse",     href: "/pulse",        icon: <Activity size={16} strokeWidth={1.6} /> },
  { label: "Accounts",  href: "/accounts",     icon: <CreditCard size={16} strokeWidth={1.6} /> },
  { label: "Activity",  href: "/transactions", icon: <ArrowLeftRight size={16} strokeWidth={1.6} /> },
  { label: "Expenses",  href: "/bills",        icon: <FileText size={16} strokeWidth={1.6} /> },
  { label: "Goals",     href: "/goals",        icon: <Target size={16} strokeWidth={1.6} /> },
  { label: "Decide",    href: "/decide",       icon: <Scale size={16} strokeWidth={1.6} /> },
  { label: "Card",      href: "/card",         icon: <Layers size={16} strokeWidth={1.6} /> },
  { label: "Council",   href: "/council",      icon: <Users size={16} strokeWidth={1.6} /> },
];

const SETTINGS_NAV: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: <Settings size={16} strokeWidth={1.6} />,
};

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-2.5 rounded-r-xl px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
        isActive
          ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]/60 hover:text-[var(--text-secondary)]"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
      )}
      <span className={isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-[220px] flex-col border-r border-[var(--border-subtle)] bg-[var(--sidebar-bg)] md:flex">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <LogoMark size={28} />
        <div className="flex-1 leading-tight">
          <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Steward</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">Money</p>
        </div>
        <NotificationBell align="right" />
      </div>

      <div className="mx-3 h-px bg-[var(--border-subtle)]" />

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto py-3 pr-3">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </nav>

      <div className="mx-3 h-px bg-[var(--border-subtle)]" />

      {/* Bottom: Settings + theme */}
      <div className="space-y-1 py-3 pr-3">
        <NavLink item={SETTINGS_NAV} isActive={isActive(SETTINGS_NAV.href)} />
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[11px] text-[var(--text-muted)]">Appearance</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
