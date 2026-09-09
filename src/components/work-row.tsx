"use client";

import Link from "next/link";
import { useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { CaseStudyCard } from "@/sanity/types";

/**
 * One row of the work index.
 *
 * On a fine pointer the row tilts fractionally towards the cursor and a light
 * follows it across the surface, so the list has depth without becoming a grid
 * of cards. The tilt is deliberately tiny — a degree and a half — because the
 * row is a link before it is an effect, and text that swings around is harder
 * to read and harder to click.
 *
 * Everything here is additive. With no JavaScript, reduced motion, or a touch
 * device, this is exactly the anchor and text it was before.
 */

type Props = {
  item: CaseStudyCard;
  index: number;
};

function ordinal(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function WorkRow({ item, index }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
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

        const rotX = gsap.quickTo(node, "rotationX", {
          duration: 0.6,
          ease: "power3.out",
        });
        const rotY = gsap.quickTo(node, "rotationY", {
          duration: 0.6,
          ease: "power3.out",
        });

        const onMove = (event: PointerEvent) => {
          const box = node.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width;
          const py = (event.clientY - box.top) / box.height;
          rotY((px - 0.5) * 3);
          rotX((0.5 - py) * 1.5);
          // Drives the light sweep in CSS, so the paint stays on the compositor.
          node.style.setProperty("--x", `${px * 100}%`);
          node.style.setProperty("--y", `${py * 100}%`);
        };

        const onLeave = () => {
          rotX(0);
          rotY(0);
        };

        node.addEventListener("pointermove", onMove);
        node.addEventListener("pointerleave", onLeave);
        node.addEventListener("blur", onLeave, true);

        cleanup = () => {
          node.removeEventListener("pointermove", onMove);
          node.removeEventListener("pointerleave", onLeave);
          node.removeEventListener("blur", onLeave, true);
          gsap.set(node, { rotationX: 0, rotationY: 0 });
        };
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion, finePointer]);

  return (
    <Link
      ref={ref}
      href={`/work/${item.slug}`}
      className="group work-row relative grid gap-4 py-10 transition-colors sm:py-12 lg:grid-cols-12 lg:gap-8"
    >
      <span className="text-mono text-muted lg:col-span-1">
        {ordinal(index)}
      </span>

      <div className="lg:col-span-7">
        <h3 className="text-h2 group-hover:text-accent transition-colors">
          {item.title}
        </h3>
        {item.summary ? (
          <p className="text-body text-muted mt-4 max-w-[52ch]">
            {item.summary}
          </p>
        ) : null}
      </div>

      <div className="lg:col-span-4 lg:text-right">
        <p className="text-mono text-muted uppercase">{item.timeframe}</p>
        {item.stack?.length ? (
          <p className="text-mono text-muted mt-3 wrap-break-word">
            {item.stack.slice(0, 4).join(" · ")}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
