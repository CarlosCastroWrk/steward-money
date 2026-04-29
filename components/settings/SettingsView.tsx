"use client";

import { useState } from "react";
import { ProfileSection } from "./ProfileSection";
import { GivingSection } from "./GivingSection";
import { BufferSection } from "./BufferSection";
import { SavingsSection } from "./SavingsSection";
import { TradingSection } from "./TradingSection";
import { NeedsSection } from "./NeedsSection";
import { IncomeSection } from "./IncomeSection";
import { PrioritySection } from "./PrioritySection";
import { AccountsSection } from "./AccountsSection";
import type { UserSettingsData, IncomeSourceRow, AccountRow, PriorityRow } from "./types";

type Tab = "profile" | "rules" | "income" | "priorities" | "accounts";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile",    label: "Profile"     },
  { id: "rules",      label: "Budget Rules" },
  { id: "income",     label: "Income"      },
  { id: "priorities", label: "Priorities"  },
  { id: "accounts",   label: "Accounts"    },
];

interface Props {
  settings: UserSettingsData | null;
  incomeSources: IncomeSourceRow[];
  accounts: AccountRow[];
  priorities: PriorityRow[];
}

export function SettingsView({ settings, incomeSources, accounts, priorities }: Props) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">Your financial rules and preferences.</p>
        </div>

        {/* Tab row */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 rounded-xl px-4 py-2 text-[13px] font-medium transition-all duration-150 ${
                tab === t.id
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-4">
          {tab === "profile" && (
            <ProfileSection initialData={settings} />
          )}
          {tab === "rules" && (
            <>
              <GivingSection initialData={settings} />
              <BufferSection initialData={settings} />
              <SavingsSection initialData={settings} />
              <TradingSection initialData={settings} />
              <NeedsSection initialData={settings} />
            </>
          )}
          {tab === "income" && (
            <IncomeSection initialSources={incomeSources} />
          )}
          {tab === "priorities" && (
            <PrioritySection initialPriorities={priorities} />
          )}
          {tab === "accounts" && (
            <AccountsSection initialAccounts={accounts} />
          )}
        </div>

      </div>
    </section>
  );
}
