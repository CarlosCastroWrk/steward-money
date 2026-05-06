import { Metadata } from "next";
export const metadata: Metadata = { title: "Pulse" };

import { PulseView } from "@/components/pulse/PulseView";

export default function PulsePage() {
  return <PulseView />;
}
