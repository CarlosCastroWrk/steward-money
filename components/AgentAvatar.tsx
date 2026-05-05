type Agent = "luka" | "solomon" | "argus" | "silas" | "kairos";

const CONFIG: Record<Agent, { bg: string; label: string }> = {
  luka:    { bg: "bg-purple-600",  label: "L" },
  solomon: { bg: "bg-amber-500",   label: "S" },
  argus:   { bg: "bg-blue-600",    label: "A" },
  silas:   { bg: "bg-teal-600",    label: "S" },
  kairos:  { bg: "bg-green-600",   label: "K" },
};

export function AgentAvatar({ agent, size = "sm" }: { agent: Agent; size?: "sm" | "md" }) {
  const { bg, label } = CONFIG[agent];
  const dim = size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs";
  return (
    <div className={`${dim} ${bg} flex items-center justify-center rounded-full font-semibold text-white flex-shrink-0`}>
      {label}
    </div>
  );
}
