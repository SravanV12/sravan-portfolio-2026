"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Pulls its child a little way towards the pointer, and lets go when the
 * pointer leaves.
 *
 * This is a magnetic *element*, not a magnetic cursor — the real pointer is
 * never hidden or replaced, which is the thing the project rules exclude. The
 * element still sits exactly where it was for hit-testing purposes at rest,
 * and the pull is small enough that a click never misses.
 *
 * Skipped entirely on coarse pointers: there is no hover on a touchscreen, so
 * the listeners would be dead weight.
 */

type MagneticProps = {
  children: ReactNode;
  /** Maximum pull in pixels. */
  strength?: number;
  className?: string;
};

export function Magnetic({
  children,
  strength = 14,
  className,
}: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion || !finePointer) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("@/lib/gsap")
      .then(({ gsap }) => {
        if (cancelled || !ref.current) return;
        const node = ref.current;
        const moveX = gsap.quickTo(node, "x", {
          duration: 0.5,
          ease: "power3.out",
        });
        const moveY = gsap.quickTo(node, "y", {
          duration: 0.5,
          ease: "power3.out",
        });

        const onMove = (event: PointerEvent) => {
          const box = node.getBoundingClientRect();
          const dx = event.clientX - (box.left + box.width / 2);
          const dy = event.clientY - (box.top + box.height / 2);
          // Normalised by the element's own size, so a wide button and a small
          // one feel the same rather than the wide one lagging behind.
          moveX(gsap.utils.clamp(-1, 1, dx / box.width) * strength);
          moveY(gsap.utils.clamp(-1, 1, dy / box.height) * strength);
        };

        const onLeave = () => {
          moveX(0);
          moveY(0);
        };

        node.addEventListener("pointermove", onMove);
        node.addEventListener("pointerleave", onLeave);
        // Releasing on blur matters for keyboard users, who never fire
        // pointerleave and would otherwise leave it stuck off-centre.
        node.addEventListener("blur", onLeave, true);

        cleanup = () => {
          node.removeEventListener("pointermove", onMove);
          node.removeEventListener("pointerleave", onLeave);
          node.removeEventListener("blur", onLeave, true);
          gsap.set(node, { x: 0, y: 0 });
        };
      })
      .catch(() => {
        // No pull; the element still works exactly as it did.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion, finePointer, strength]);

  return (
    <span ref={ref} className={`inline-block ${className ?? ""}`.trimEnd()}>
      {children}
    </span>
  );
}
