"use client";

import type { ElementType, ReactNode } from "react";
import { useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The only reveal mechanism in the codebase. Anything that needs to enter on
 * scroll goes through this — variants get a prop, not a second implementation.
 *
 * Two things here are deliberate and easy to undo by accident:
 *
 * 1. Content is never hidden by CSS alone. The `.motion-js` class that hides
 *    `[data-reveal]` is added by an inline script that runs only when script
 *    is available and motion is allowed. With JS off, or reduced motion on,
 *    that class never appears and everything renders as authored.
 *
 * 2. GSAP is imported dynamically. Keeping it out of the first load is what
 *    holds LCP down. If the import fails, the element is shown rather than
 *    left hidden — a missing animation is a far smaller problem than missing
 *    content.
 *
 * Nothing above the fold should use this. A reveal on the LCP element makes
 * first paint wait for JavaScript; measured, that cost 0.3s of LCP.
 */

type RevealProps = {
  as?: ElementType;
  /** Seconds before the animation starts. */
  delay?: number;
  /** Seconds between children. Set it to animate children instead of the box. */
  stagger?: number;
  className?: string;
  children: ReactNode;
};

export function Reveal({
  as: Tag = "div",
  delay = 0,
  stagger,
  className,
  children,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Reduced motion: no ScrollTrigger is created, and GSAP is never fetched.
    if (reducedMotion) {
      element.removeAttribute("data-reveal");
      return;
    }

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    import("@/lib/gsap")
      .then(({ gsap }) => {
        if (cancelled || !ref.current) return;
        const node = ref.current;

        context = gsap.context(() => {
          const targets =
            stagger === undefined ? [node] : Array.from(node.children);

          if (targets.length === 0) {
            node.removeAttribute("data-reveal");
            return;
          }

          // Take over the hidden state as an inline style before releasing the
          // CSS one, so there is no frame where content flashes into view.
          gsap.set(targets, { opacity: 0, y: 16 });
          node.removeAttribute("data-reveal");

          gsap.to(targets, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            delay,
            stagger: stagger ?? 0,
            scrollTrigger: { trigger: node, start: "top 85%", once: true },
          });
        }, ref);
      })
      .catch(() => {
        // Never leave content stranded because a chunk failed to load.
        element.removeAttribute("data-reveal");
      });

    return () => {
      cancelled = true;
      // Kills the tween, its ScrollTrigger and every inline style it set.
      context?.revert();
    };
  }, [reducedMotion, delay, stagger]);

  return (
    <Tag ref={ref} data-reveal="" className={className}>
      {children}
    </Tag>
  );
}
