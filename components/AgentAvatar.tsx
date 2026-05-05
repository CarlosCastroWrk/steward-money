type Agent = "luka" | "solomon" | "argus" | "silas" | "kairos" | "eden" | "iron" | "nova" | "echo" | "manna";

const CONFIG: Record<Agent, { bg: string; label: string }> = {
  luka:    { bg: "#7857ff", label: "L" },
  solomon: { bg: "#d4a857", label: "S" },
  argus:   { bg: "#4da6ff", label: "A" },
  silas:   { bg: "#00d4aa", label: "S" },
  kairos:  { bg: "#00ff87", label: "K" },
  eden:    { bg: "#ff6bda", label: "E" },
  iron:    { bg: "#ff6b8a", label: "I" },
  nova:    { bg: "#b57fff", label: "N" },
  echo:    { bg: "#8899aa", label: "E" },
  manna:   { bg: "#ffcc44", label: "M" },
};

export function AgentAvatar({ agent, size = "sm" }: { agent: Agent; size?: "sm" | "md" | "lg" }) {
  const { bg, label } = CONFIG[agent];
  const dim = size === "lg" ? "h-9 w-9 text-sm" : size === "md" ? "h-7 w-7 text-xs" : "h-6 w-6 text-[10px]";
  return (
    <div
      className={`${dim} flex items-center justify-center rounded-full font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {label}
    </div>
  );
}
