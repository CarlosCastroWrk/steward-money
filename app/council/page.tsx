import { Metadata } from "next";
import { CouncilView } from "@/components/council/CouncilView";

export const metadata: Metadata = {
  title: "Council",
};

export default function CouncilPage() {
  return <CouncilView />;
}
