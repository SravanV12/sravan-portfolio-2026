"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { DURATION, EASE } from "@/lib/motion";

/**
 * Content arrives through depth when the route changes.
 *
 * The environment lives in the layout, not here, so it is never unmounted by a
 * navigation — the field, the graph and the camera carry straight on while the
 * content changes in front of them. That continuity is what makes moving
 * between pages feel like moving within one place rather than loading another.
 *
 * Two things it deliberately does not do:
 *
 * - It never animates the first load. Starting the page at opacity 0 would put
 *   the LCP element behind a JavaScript-dependent fade, which is the exact
 *   mistake that cost 0.6s of LCP earlier in this build.
 * - It never waits for GSAP to hide anything. The starting state is applied
 *   synchronously through a class, before paint, so a navigation cannot flash
 *   the new page in and then out again.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  const reducedMotion = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // First render of the session: nothing to transition from.
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;

    if (reducedMotion) return;

    // Applied before paint so the incoming page is never briefly visible in
    // its final position.
    element.classList.add("route-entering");

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    import("@/lib/gsap")
      .then(({ gsap }) => {
        if (cancelled || !ref.current) return;
        const node = ref.current;

        context = gsap.context(() => {
          gsap.fromTo(
            node,
            { opacity: 0, y: 28, z: -120, rotateX: 4 },
            {
              opacity: 1,
              y: 0,
              z: 0,
              rotateX: 0,
              duration: DURATION.base,
              ease: EASE.enter,
              // The class only exists to cover the gap before this runs.
              onStart: () => node.classList.remove("route-entering"),
            },
          );
        }, ref);
      })
      .catch(() => {
        // If the chunk never arrives the page must still be visible.
        element.classList.remove("route-entering");
      });

    return () => {
      cancelled = true;
      element.classList.remove("route-entering");
      context?.revert();
    };
  }, [pathname, reducedMotion]);

  return (
    // Perspective on the wrapper is what makes the Z translation above read as
    // depth rather than as a scale.
    <div
      ref={ref}
      className="route-stage relative z-10 flex min-h-full flex-col"
    >
      {children}
    </div>
  );
}
