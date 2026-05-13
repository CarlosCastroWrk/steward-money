"use client";

import { useState } from "react";
import { TabPills } from "@/components/ui/TabPills";
import { CashFlowView } from "./CashFlowView";
import { CategoriesView } from "./CategoriesView";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "categories", label: "Categories" },
];

export function DashboardTabs({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState("overview");
  const [mounted, setMounted] = useState<Set<string>>(new Set(["overview"]));

  function goTo(id: string) {
    setMounted((prev) => new Set([...prev, id]));
    setActive(id);
  }

  return (
    <div>
      <TabPills tabs={TABS} active={active} onChange={goTo} />
      <div className="mt-5">
        <div className={active === "overview" ? "block" : "hidden"}>
          {children}
        </div>
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

      </div>
    </div>
  );
}
