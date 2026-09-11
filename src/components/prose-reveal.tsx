"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Resolves a block of prose line by line as it is scrolled into view.
 *
 * Done with a soft mask sweeping down the block rather than by splitting the
 * text into per-line elements, and the reason is the content: this wraps CMS
 * rich text, which contains links, bold runs and inline code. A line splitter
 * has to cut the DOM at line boundaries, and those boundaries fall in the
 * middle of those elements — so splitting would either break the markup or
 * need to rebuild it, and would have to redo the whole thing on every resize
 * because the line boxes move.
 *
 * The mask has none of those problems. The markup is untouched, so links stay
 * clickable and the text stays selectable and announced as one passage; it
 * costs no measurement; and it follows re-wrapping for free, because the
 * gradient is expressed in percentages of the block's own height.
 *
 * The class that applies the mask is added here, after hydration, so prose is
 * never hidden by CSS that JavaScript then has to undo. With script off or
 * reduced motion on, this renders its children and does nothing else.
 */
export function ProseReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    import("@/lib/gsap")
      .then(({ gsap }) => {
        if (cancelled || !ref.current) return;
        const node = ref.current;

        context = gsap.context(() => {
          // Masked only once we know we can animate it back off again.
          node.style.setProperty("--sweep", "0");
          node.classList.add("prose-sweep");

          gsap.to(node, {
            "--sweep": 1,
            duration: 1.4,
            ease: "none",
            scrollTrigger: { trigger: node, start: "top 80%", once: true },
            // The mask is only needed while it is moving. Removing it at the
            // end means the finished state is ordinary text with no filter
            // over it, which matters for subpixel antialiasing.
            onComplete: () => node.classList.remove("prose-sweep"),
          });
        }, ref);
      })
      .catch(() => {
        // The prose was never hidden, so a failed import costs nothing.
      });

    return () => {
      cancelled = true;
      context?.revert();
      ref.current?.classList.remove("prose-sweep");
    };
  }, [reducedMotion]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
