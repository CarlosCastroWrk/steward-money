export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect width="36" height="36" rx="10" fill="#7857ff" />
      <path
        d="M18 7 L27 12.5 L27 23.5 L18 29 L9 23.5 L9 12.5 Z"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M18 14 L18 24 M14 17.5 L18 14 L22 17.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
