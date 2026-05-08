import { Metadata } from "next";
import { CouncilView } from "@/components/council/CouncilView";
import { BackButton } from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Council",
};

export default function CouncilPage() {
  return (
    <>
      <div className="px-4 pt-4 md:px-8 md:pt-8"><BackButton /></div>
      <CouncilView />
    </>
  );
}
