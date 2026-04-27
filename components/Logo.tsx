export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect width="36" height="36" rx="9" fill="#059669" />
      {/* Growth arrow — upward trajectory from a stable base */}
      <path
        d="M18 26V13M18 13L13 18M18 13L23 18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 26H24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
