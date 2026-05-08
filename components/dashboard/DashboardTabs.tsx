"use client";

import { useState, useRef, useCallback } from "react";
import { TabPills } from "@/components/ui/TabPills";
import { CashFlowView } from "./CashFlowView";
import { CategoriesView } from "./CategoriesView";
import { ComingUpWidget } from "./ComingUpWidget";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "categories", label: "Categories" },
  { id: "coming-up", label: "Coming Up" },
];

export function DashboardTabs({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState("overview");
  const [mounted, setMounted] = useState<Set<string>>(new Set(["overview"]));
  const swipeRef = useRef({ x: 0, y: 0 });

  function goTo(id: string) {
    setMounted((prev) => new Set([...prev, id]));
    setActive(id);
  }

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeRef.current.y;
    // Only handle horizontal swipes that are more horizontal than vertical
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    const idx = TABS.findIndex((t) => t.id === active);
    if (dx < 0 && idx < TABS.length - 1) goTo(TABS[idx + 1].id);
    else if (dx > 0 && idx > 0) goTo(TABS[idx - 1].id);
  }, [active]);

  return (
    <div>
      <TabPills tabs={TABS} active={active} onChange={goTo} />
      <div className="mt-5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Overview — always keep mounted, show/hide via CSS */}
        <div className={active === "overview" ? "block" : "hidden"}>
          {children}
        </div>
        {/* Other tabs — lazy-mount on first access */}
        {mounted.has("cashflow") && (
          <div className={active === "cashflow" ? "block" : "hidden"}>
            <CashFlowView />
          </div>
        )}
        {mounted.has("categories") && (
          <div className={active === "categories" ? "block" : "hidden"}>
            <CategoriesView />
          </div>
        )}
        {mounted.has("coming-up") && (
          <div className={active === "coming-up" ? "block" : "hidden"}>
            <ComingUpWidget />
          </div>
        )}
      </div>
    </div>
  );
}
