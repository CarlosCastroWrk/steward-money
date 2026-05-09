"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ROUTES = ["/", "/pulse", "/transactions", "/accounts", "/more"];

const SWIPE_DISABLED_PREFIXES = [
  "/merchant/",
  "/category/",
  "/settings",
  "/onboarding",
  "/login",
  "/signup",
  "/auth/",
  "/more/usage",
  "/more/integrations",
  "/pulse/", // agent detail pages use fixed overlay — disable swipe to avoid transform conflict
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%" }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%" }),
};

export function SwipeableNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [direction, setDirection] = useState(0);
  const [mounted, setMounted] = useState(false);

  const swipeDisabled = SWIPE_DISABLED_PREFIXES.some((p) => pathname.startsWith(p));
  const currentIndex = NAV_ROUTES.findIndex((r) =>
    r === "/" ? pathname === "/" : pathname.startsWith(r)
  );
  const inPrimaryNav = currentIndex !== -1;

  useEffect(() => {
    setMounted(true);
    function onNavDirection(e: Event) {
      setDirection((e as CustomEvent<{ direction: number }>).detail.direction);
    }
    window.addEventListener("nav:direction", onNavDirection);
    return () => window.removeEventListener("nav:direction", onNavDirection);
  }, []);

  function handlePanEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    if (swipeDisabled || !inPrimaryNav) return;
    const { x: dx } = info.offset;
    const { x: vx } = info.velocity;
    if (Math.abs(dx) < 80 && Math.abs(vx) < 600) return;

    if (dx < 0 && currentIndex < NAV_ROUTES.length - 1) {
      setDirection(1);
      router.push(NAV_ROUTES[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      setDirection(-1);
      router.push(NAV_ROUTES[currentIndex - 1]);
    }
  }

  if (swipeDisabled || !inPrimaryNav) return <>{children}</>;

  if (!mounted) {
    return (
      <div style={{ display: "grid", overflow: "hidden", width: "100%" }}>
        <div style={{ gridColumn: 1, gridRow: 1, touchAction: "pan-y", minWidth: 0, width: "100%" }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", overflow: "hidden", width: "100%" }}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
          onPanEnd={handlePanEnd}
          style={{ gridColumn: 1, gridRow: 1, touchAction: "pan-y", minWidth: 0, width: "100%" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
