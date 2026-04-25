"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AddSubscriptionModal } from "./AddSubscriptionModal";
import type { Subscription, AccountOption } from "./types";

type Props = { subscriptions: Subscription[]; accounts: AccountOption[] };

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

const statusBadge: Record<string, string> = {
  keep: "bg-emerald-900/50 text-emerald-400",
  cancel: "bg-red-900/50 text-red-400",
  evaluating: "bg-amber-900/50 text-amber-400",
};

async function patchStatus(
  id: string,
  status: Subscription["status"],
  router: ReturnType<typeof useRouter>
) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("subscriptions").update({ status }).eq("id", id).eq("user_id", user.id);
  router.refresh();
}

export function SubscriptionsView({ subscriptions, accounts }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthlyTotal = subscriptions.reduce((s, sub) => s + Number(sub.amount), 0);
  const keepTotal = subscriptions
    .filter((s) => s.status === "keep")
    .reduce((s, sub) => s + Number(sub.amount), 0);
  const cancelTotal = subscriptions
    .filter((s) => s.status === "cancel")
    .reduce((s, sub) => s + Number(sub.amount), 0);

  async function deleteSub(id: string) {
    if (!confirm("Delete this subscription?")) return;
    setDeletingId(id);
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) { setDeletingId(null); return; }
    await supabase.from("subscriptions").delete().eq("id", id).eq("user_id", user.id);
    setDeletingId(null);
    router.refresh();
  }

  // Sort: cancel first (so you see what to cut), then evaluating, then keep
  const statusOrder = { cancel: 0, evaluating: 1, keep: 2 };
  const sorted = [...subscriptions].sort(
    (a, b) => (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2)
  );

  return (
    <section className="min-h-screen p-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-white">Subscriptions</h1>
            <p className="mt-1 text-sm text-zinc-400">Review, keep, or cut recurring services</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Add subscription
          </button>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Monthly total</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatUSD(monthlyTotal)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Annual total</p>
            <p className="mt-2 text-xl font-semibold text-zinc-300">{formatUSD(monthlyTotal * 12)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Keeping</p>
            <p className="mt-2 text-xl font-semibold text-emerald-400">{formatUSD(keepTotal)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">To cancel</p>
            <p className="mt-2 text-xl font-semibold text-red-400">{formatUSD(cancelTotal)}</p>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          {subscriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center">
              <p className="text-zinc-500">No subscriptions yet. Add your first one.</p>
            </div>
          ) : (
            sorted.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-100">{sub.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[sub.status]}`}>
                        {sub.status}
                      </span>
                      {sub.value_score !== null && (
                        <span className="text-xs text-zinc-500">
                          value: {sub.value_score}/10
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      {sub.category && <span>{sub.category}</span>}
                      {sub.billing_day && (
                        <>
                          {sub.category && <span>·</span>}
                          <span>bills on the {sub.billing_day}{ordinalSuffix(sub.billing_day)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="mr-1 text-sm font-semibold text-zinc-100">
                    {formatUSD(Number(sub.amount))}/mo
                  </p>
                  {/* Quick status cycle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next =
                        sub.status === "keep"
                          ? "evaluating"
                          : sub.status === "evaluating"
                          ? "cancel"
                          : "keep";
                      patchStatus(sub.id, next, router);
                    }}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Change status
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditing(sub); setModalOpen(true); }}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSub(sub.id)}
                    disabled={deletingId === sub.id}
                    className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-900 hover:text-red-400 disabled:opacity-40"
                  >
                    {deletingId === sub.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddSubscriptionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        accounts={accounts}
        subscription={editing}
      />
    </section>
  );
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
