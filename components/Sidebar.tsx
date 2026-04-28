"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

function Icon({ path, path2 }: { path: string; path2?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 flex-shrink-0"
    >
      <path d={path} />
      {path2 && <path d={path2} />}
    </svg>
  );
}

const PRIMARY_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <Icon path="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125A1.125 1.125 0 005.625 21H9.75v-4.875A1.125 1.125 0 0110.875 15h2.25A1.125 1.125 0 0114.25 16.125V21h4.125A1.125 1.125 0 0019.5 19.875V9.75" />,
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: <Icon path="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />,
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: <Icon path="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />,
  },
  {
    label: "Bills",
    href: "/bills",
    icon: <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
  },
  {
    label: "Subscriptions",
    href: "/subscriptions",
    icon: <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />,
  },
  {
    label: "Goals",
    href: "/goals",
    icon: <Icon path="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />,
  },
  {
    label: "Forecast",
    href: "/forecast",
    icon: <Icon path="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />,
  },
  {
    label: "Decide",
    href: "/decide",
    icon: <Icon path="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />,
  },
];

const SETTINGS_NAV: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: (
    <Icon
      path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      path2="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  ),
};

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
        isActive
          ? "bg-zinc-800 text-zinc-100 font-medium"
          : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
      }`}
    >
      <span className={isActive ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-400"}>
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
    <aside className="fixed left-0 top-0 hidden h-screen w-[240px] flex-col border-r border-zinc-800/60 bg-zinc-900 md:flex">
      {/* Logo + Bell */}
      <div className="flex items-center gap-3 px-4 py-5">
        <LogoMark size={32} />
        <div className="flex-1 leading-tight">
          <p className="text-[15px] font-semibold text-zinc-100 tracking-tight">Steward</p>
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Money</p>
        </div>
        <NotificationBell align="right" />
      </div>

      <div className="mx-4 h-px bg-zinc-800/60" />

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </nav>

      {/* Settings pinned at bottom */}
      <div className="mx-4 h-px bg-zinc-800/60" />
      <div className="px-3 py-4">
        <NavLink item={SETTINGS_NAV} isActive={isActive(SETTINGS_NAV.href)} />
      </div>
    </aside>
  );
}
