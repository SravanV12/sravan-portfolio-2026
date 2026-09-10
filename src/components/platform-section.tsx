"use client";

import { useRef } from "react";
import { DeviceFrame, frameKindFor } from "@/components/device-frame";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { Platform } from "@/sanity/types";

/**
 * One product, three surfaces — pinned while the reader scrolls through them.
 *
 * Pinning is used only where it behaves: desktop widths, motion allowed.
 * Below 1024px it is a plain stack. Mobile browsers resize the viewport as
 * their chrome hides and shows, which moves the ground under a pinned element
 * and makes it stutter — not worth fighting for a scroll effect.
 *
 * The pinning is `position: sticky`, NOT ScrollTrigger's `pin`. That is a
 * deliberate departure from the step 08 instructions, forced by a crash:
 * ScrollTrigger's pin reparents the element it pins, and React does not know
 * its nodes have moved. Resizing across the 1024px breakpoint while pinned
 * made React unmount a subtree whose nodes GSAP had relocated, which threw
 * `NotFoundError: Failed to execute 'removeChild'` and took the whole page
 * down with "This page couldn't load".
 *
 * Sticky gives the same effect with none of that: the browser does the
 * pinning, GSAP only animates opacity, and no DOM is ever moved. The scroll
 * length is reserved in CSS (`height: N * 100svh`), so nothing shifts either.
 */

type Props = {
  platforms: Platform[];
};

export function PlatformSection({ platforms }: Props) {
  const reducedMotion = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const wrapRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const animated = isDesktop && !reducedMotion && platforms.length > 1;

  useIsomorphicLayoutEffect(() => {
    if (!animated) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    import("@/lib/gsap")
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;

        context = gsap.context(() => {
          const panels = gsap.utils.toArray<HTMLElement>("[data-panel]");
          const dots = gsap.utils.toArray<HTMLElement>("[data-dot]");
          if (panels.length === 0) return;

          gsap.set(dots.slice(1), { opacity: 0.3 });

          const track = trackRef.current;
          if (!track) return;

          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: wrap,
              start: "top top",
              // The sticky child holds position for the wrapper's full height,
              // so the track traverses over exactly that range.
              end: "bottom bottom",
              scrub: 1,
            },
          });

          // The track is N panels wide and slides left by N-1 of them, so
          // scrolling down walks sideways through the platforms. The document
          // itself never scrolls horizontally — this is a transform inside a
          // clipped box, which is what keeps the page's overflow guarantee.
          timeline.to(
            track,
            {
              xPercent: (-100 * (panels.length - 1)) / panels.length,
              ease: "none",
              duration: panels.length - 1,
            },
            0,
          );

          // Indicator follows the same clock.
          for (let i = 1; i < panels.length; i++) {
            timeline
              .to(dots[i - 1], { opacity: 0.3, duration: 1 }, i - 1)
              .to(dots[i], { opacity: 1, duration: 1 }, i - 1);
          }

          // Fonts change line heights, which changes where the pin should
          // start. Re-measure once they have settled.
          void document.fonts?.ready.then(() => ScrollTrigger.refresh());
        }, wrapRef);
      })
      .catch(() => {
        // Leave the stacked layout in place; the content is all still there.
      });

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [animated, platforms.length]);

  if (platforms.length === 0) return null;

  // Static stack: mobile, reduced motion, or a single platform.
  if (!animated) {
    return (
      <section className="border-line mt-16 border-t pt-8">
        <h2 className="text-mono text-muted uppercase">Platforms</h2>
        <div className="mt-8 grid gap-12 sm:grid-cols-2">
          {platforms.map((platform) => (
            <div key={platform._key}>
              {/* No fixed height. The frames size themselves from their width
                  and aspect ratio, so pinning a height here meant they spilled
                  out and landed on the heading below — measured at +53px on a
                  414px screen. */}
              <div className="mb-6 w-full max-w-[20rem]">
                <DeviceFrame kind={frameKindFor(platform.label)} />
              </div>
              <h3 className="text-h3">{platform.label}</h3>
              <p className="text-body text-muted mt-3">
                {platform.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="border-line mt-16 border-t pt-8">
      <h2 className="text-mono text-muted uppercase">Platforms</h2>

      {/* Reserves the scroll distance up front. */}
      <div
        ref={wrapRef}
        className="relative mt-8"
        style={{ height: `${platforms.length * 100}svh` }}
      >
        <div
          ref={pinRef}
          className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden"
        >
          {/*
            A horizontal track: N panels laid side by side, slid left as the
            page is scrolled down. The panels sit in normal flow rather than
            stacked absolutely, so each one sizes itself and the tallest can no
            longer spill past a shorter neighbour.
          */}
          <div
            ref={trackRef}
            className="flex"
            style={{ width: `${platforms.length * 100}%` }}
          >
            {platforms.map((platform, index) => (
              <div
                key={platform._key}
                data-panel=""
                className="grid min-h-80 shrink-0 grid-cols-1 items-center gap-12 lg:grid-cols-2"
                style={{ width: `${100 / platforms.length}%` }}
              >
                <div className="flex items-center justify-center">
                  <DeviceFrame kind={frameKindFor(platform.label)} />
                </div>
                <div>
                  <p className="text-mono text-muted uppercase">
                    {String(index + 1).padStart(2, "0")} / {platforms.length}
                  </p>
                  <h3 className="text-h2 mt-4">{platform.label}</h3>
                  {/* No character-based max width here. Each panel is one
                      viewport wide and split in two, so the grid column is
                      already the measure — a 42ch cap was wider than the
                      column and the text was being clipped mid-word. */}
                  <p className="text-body text-muted mt-6">
                    {platform.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress indicator. */}
          <ul className="mt-12 flex gap-3" aria-hidden="true">
            {platforms.map((platform) => (
              <li
                key={platform._key}
                data-dot=""
                className="bg-fg h-0.5 w-12 rounded-full"
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
