import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CalendarSection } from "@/components/settings/CalendarSection";
import { PlaidDiagnosticSection } from "@/components/settings/PlaidDiagnosticSection";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <div className="px-4 pb-10 pt-5 md:px-8 md:pt-8 max-w-lg">
      <Link href="/more" className="flex items-center gap-1 text-sm text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors mb-5">
        <ChevronLeft size={16} strokeWidth={2} />
        More
      </Link>

      <h1 className="text-2xl font-semibold text-[var(--text-1)] mb-6">Integrations</h1>

      <div className="space-y-8">
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Google Calendar</p>
          <CalendarSection />
        </div>
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Plaid — Bank Connections</p>
          <PlaidDiagnosticSection />
        </div>
      </div>
    </div>
  );
}
