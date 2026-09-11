"use client";

import type { RefObject } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type TiltOptions = {
  /** Maximum rotation about the Y axis, in degrees. */
  maxY?: number;
  /** Maximum rotation about the X axis, in degrees. */
  maxX?: number;
  /** How far the element lifts towards the viewer, in pixels. */
  lift?: number;
  /** Called with the pointer position in 0..1, for anything else that needs it. */
  onMove?: (x: number, y: number) => void;
  onEnter?: () => void;
  onLeave?: () => void;
};

/**
 * Tilts an element towards the pointer, and lifts it slightly off the page.
 *
 * Shared rather than reimplemented per component: the work rows and the skill
 * cards should move by the same rules, and a single place to tune them is what
 * keeps the motion reading as one system.
 *
 * Skipped entirely on coarse pointers — there is no hover on a touchscreen, so
 * the listeners would be dead weight — and under reduced motion.
 */
export function useTilt(
  ref: RefObject<HTMLElement | null>,
  { maxY = 7, maxX = 4, lift = 18, onMove, onEnter, onLeave }: TiltOptions = {},
) {
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

        // quickTo keeps one tween per property alive rather than creating a new
        // one on every pointer event, which is the difference between smooth
        // and a garbage-collection stutter.
        const rotX = gsap.quickTo(node, "rotationX", {
          duration: 0.55,
          ease: "power3.out",
        });
        const rotY = gsap.quickTo(node, "rotationY", {
          duration: 0.55,
          ease: "power3.out",
        });
        const moveZ = gsap.quickTo(node, "z", {
          duration: 0.55,
          ease: "power3.out",
        });

        const handleMove = (event: PointerEvent) => {
          const box = node.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width;
          const py = (event.clientY - box.top) / box.height;
          rotY((px - 0.5) * maxY);
          rotX((0.5 - py) * maxX);
          moveZ(lift);
          onMove?.(px, py);
        };

        const handleEnter = () => onEnter?.();

        const handleLeave = () => {
          rotX(0);
          rotY(0);
          moveZ(0);
          onLeave?.();
        };

        node.addEventListener("pointermove", handleMove);
        node.addEventListener("pointerenter", handleEnter);
        node.addEventListener("pointerleave", handleLeave);
        // Keyboard users never fire pointerleave; without this the element
        // would stay stuck off-axis after being tabbed past.
        node.addEventListener("blur", handleLeave, true);
        node.addEventListener("focus", handleEnter, true);

        cleanup = () => {
          node.removeEventListener("pointermove", handleMove);
          node.removeEventListener("pointerenter", handleEnter);
          node.removeEventListener("pointerleave", handleLeave);
          node.removeEventListener("blur", handleLeave, true);
          node.removeEventListener("focus", handleEnter, true);
          gsap.set(node, { rotationX: 0, rotationY: 0, z: 0 });
        };
      })
      .catch(() => {
        // No tilt; the element still works exactly as it did.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [ref, reducedMotion, finePointer, maxY, maxX, lift, onMove, onEnter, onLeave]);
}
