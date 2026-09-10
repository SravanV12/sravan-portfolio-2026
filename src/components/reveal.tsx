"use client";

import type { ComponentType, ReactNode, Ref } from "react";
import { useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  DURATION,
  EASE,
  fromState,
  type RevealVariant,
  TO_STATE,
  TRIGGER_START,
} from "@/lib/motion";

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

/**
 * The props the rendered tag actually receives.
 *
 * The tag is cast to this rather than left as a general `ElementType`. Two
 * things force it: the WebGL layer augments the global JSX namespace with
 * Three's elements, which makes an unconstrained ElementType resolve its
 * children to `never`; and widening to every HTML tag instead produces a union
 * TypeScript reports as "too complex to represent". Runtime is unaffected —
 * React renders a string tag the same either way.
 */
type TagProps = {
  ref?: Ref<HTMLElement>;
  className?: string;
  "data-reveal"?: string;
  children?: ReactNode;
};

type RevealProps = {
  as?: string;
  /**
   * How it arrives. `depth` uses real perspective — the element comes from
   * behind the page plane and rotates flat — so it is the one to reach for at
   * the moments that should feel dimensional, not for every block.
   */
  variant?: RevealVariant;
  /** Seconds before the animation starts. */
  delay?: number;
  /** Seconds between children. Set it to animate children instead of the box. */
  stagger?: number;
  /** Overrides the shared duration for the rare element that needs it. */
  duration?: number;
  className?: string;
  children: ReactNode;
};

export function Reveal({
  as = "div",
  variant = "slide-up",
  delay = 0,
  stagger,
  duration = DURATION.base,
  className,
  children,
}: RevealProps) {
  const Tag = as as unknown as ComponentType<TagProps>;
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

          // Distances scale with the viewport: the same 32px slide is a small
          // gesture on a desktop and a large one on a phone.
          const from = fromState(variant, window.innerWidth);

          // Take over the hidden state as an inline style before releasing the
          // CSS one, so there is no frame where content flashes into view.
          gsap.set(targets, from);
          node.removeAttribute("data-reveal");

          // Perspective has to live on the parent for a Z translation to read
          // as depth rather than as a plain scale.
          if (variant === "depth" && node.parentElement) {
            node.parentElement.style.perspective = "1200px";
          }

          gsap.to(targets, {
            ...TO_STATE,
            duration,
            ease: EASE.enter,
            delay,
            stagger: stagger ?? 0,
            scrollTrigger: {
              trigger: node,
              start: TRIGGER_START,
              once: true,
            },
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
  }, [reducedMotion, variant, delay, stagger, duration]);

  return (
    <Tag ref={ref} data-reveal="" className={className}>
      {children}
    </Tag>
  );
}
