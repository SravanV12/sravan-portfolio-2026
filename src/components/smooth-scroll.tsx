"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Smooth scrolling, wrapped around the app.
 *
 * Renders nothing. It exists for the side effect, so the pages it wraps stay
 * server components and their content stays in the HTML.
 *
 * Lenis and GSAP are imported dynamically, inside the effect. Bundling them
 * with the first load put them in front of the webfont and pushed LCP from
 * 2.3s to 2.6s — nothing above the fold needs either library, so neither
 * belongs in the critical path.
 *
 * When reduced motion is on, they are never fetched at all. That setting then
 * costs nothing to honour: no download, no parse, no execution.
 */
export function SmoothScroll() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    void (async () => {
      const [{ default: Lenis }, { gsap, ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("@/lib/gsap"),
      ]);
      if (cancelled) return;

      const lenis = new Lenis({
        lerp: 0.1,
        // Native scrolling on touch. Smoothing there fights the OS and makes a
        // phone feel like it is lagging.
        syncTouch: false,
      });

      // ScrollTrigger measures against scroll position, so it has to be told
      // whenever Lenis moves rather than waiting for a native scroll event.
      lenis.on("scroll", ScrollTrigger.update);

      // One RAF loop, owned by GSAP. Running Lenis's own would mean two clocks
      // stepping the same frame, and jitter wherever they disagree.
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      teardown = () => {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [reducedMotion]);

  return null;
}
