"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { useTilt } from "@/hooks/useTilt";
import { scrollState } from "@/lib/scroll-state";
import {
  caseStudyTransitionName,
  withViewTransition,
} from "@/lib/view-transition";
import type { CaseStudyCard } from "@/sanity/types";

/**
 * One row of the work index.
 *
 * Pointing at a row does two things: the row itself tilts and lifts towards
 * the cursor, and the system graph behind the page lights up and pushes
 * traffic through it. That second part is the point — the environment is
 * reacting to the work rather than running independently of it.
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
  const router = useRouter();

  // Drives the light sweep in CSS, so that paint stays on the compositor.
  const handleMove = useCallback((x: number, y: number) => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--x", `${x * 100}%`);
    node.style.setProperty("--y", `${y * 100}%`);
  }, []);

  const handleEnter = useCallback(() => {
    scrollState.focus = index;
  }, [index]);

  const handleLeave = useCallback(() => {
    // Only clear if this row is still the one holding focus: moving between
    // adjacent rows fires the leave of one after the enter of the next.
    if (scrollState.focus === index) scrollState.focus = null;
  }, [index]);

  useTilt(ref, {
    maxY: 7,
    maxX: 4,
    lift: 22,
    onMove: handleMove,
    onEnter: handleEnter,
    onLeave: handleLeave,
  });

  return (
    <Link
      ref={ref}
      href={`/work/${item.slug}`}
      onClick={(event) => {
        // Let modified clicks (new tab, background tab) behave normally.
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }
        const handled = withViewTransition(() => {
          router.push(`/work/${item.slug}`);
        });
        if (handled) event.preventDefault();
      }}
      className="group work-row relative grid gap-4 py-10 transition-colors sm:py-12 lg:grid-cols-12 lg:gap-8"
    >
      <span className="text-mono text-muted lg:col-span-1">
        {ordinal(index)}
      </span>

      <div className="lg:col-span-7">
        {/* The browser pairs this with the heading on the case study page and
            animates between the two positions itself. */}
        <h3
          className="text-h2 group-hover:text-accent transition-colors"
          style={{
            viewTransitionName: item.slug
              ? caseStudyTransitionName(item.slug)
              : undefined,
          }}
        >
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
