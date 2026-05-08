"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";

// Primary bottom nav routes in order. "More" is a modal button, not a route.
const NAV_ROUTES = ["/", "/pulse", "/transactions", "/accounts"];

// Routes where nav-swipe should be disabled (detail pages, modals, etc.)
const SWIPE_DISABLED_PREFIXES = [
  "/merchant/",
  "/category/",
  "/settings",
  "/onboarding",
  "/login",
  "/signup",
  "/auth/",
];

export function SwipeableNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const swipeDisabled = SWIPE_DISABLED_PREFIXES.some((p) => pathname.startsWith(p));

  const currentIndex = NAV_ROUTES.findIndex((r) =>
    r === "/" ? pathname === "/" : pathname.startsWith(r)
  );

  // Not in primary nav (e.g. /goals, /bills, /card) — still allow content, no nav swipe
  const inPrimaryNav = currentIndex !== -1;

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    if (swipeDisabled || !inPrimaryNav) return;

    const SWIPE_THRESHOLD = 80;
    const VELOCITY_THRESHOLD = 600;
    const { x: dx } = info.offset;
    const { x: vx } = info.velocity;

    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(vx) < VELOCITY_THRESHOLD) return;

    if (dx < 0 && currentIndex < NAV_ROUTES.length - 1) {
      router.push(NAV_ROUTES[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      router.push(NAV_ROUTES[currentIndex - 1]);
    }
  }

  if (swipeDisabled || !inPrimaryNav) {
    return <>{children}</>;
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      style={{ touchAction: "pan-y" }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
