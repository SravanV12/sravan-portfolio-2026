"use client";

import type { ComponentType, ReactNode, Ref } from "react";
import { useRef } from "react";
import { useIsHydrated } from "@/hooks/useIsHydrated";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Animated headings, split into words and characters.
 *
 * Two modes, and the difference between them is a performance rule, not a
 * taste one:
 *
 * - `mask` slides characters up from behind a clipped edge. The text is
 *   invisible until it animates, so this may only be used below the fold.
 *   Using it on the LCP element is what pushed LCP from 2.3s to 2.9s in
 *   step 07.
 * - `focus` starts fully painted and resolves from blurred to sharp. The
 *   browser records the paint immediately, so LCP is unaffected. This is the
 *   mode for anything above the fold.
 *
 * Accessibility: the plain string is what renders on the server and what
 * survives with JavaScript off. Once split, the wrapper carries an aria-label
 * with the original text and the character spans are hidden from assistive
 * technology, so nothing is ever announced letter by letter.
 */

type TagProps = {
  ref?: Ref<HTMLElement>;
  className?: string;
  "aria-label"?: string;
  children?: ReactNode;
};

type KineticTextProps = {
  text: string;
  as?: string;
  className?: string;
  mode?: "mask" | "focus";
  delay?: number;
  /** Seconds between characters. */
  stagger?: number;
};

export function KineticText({
  text,
  as = "span",
  className,
  mode = "mask",
  delay = 0,
  stagger = 0.018,
}: KineticTextProps) {
  const Tag = as as unknown as ComponentType<TagProps>;
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  // Split only after hydration, so the server output stays a plain string and
  // the text is intact with JavaScript disabled.
  const split = useIsHydrated() && !reducedMotion;

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element || !split || reducedMotion) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    import("@/lib/gsap")
      .then(({ gsap }) => {
        if (cancelled || !ref.current) return;
        const node = ref.current;
        const chars = node.querySelectorAll("[data-char]");
        if (chars.length === 0) return;

        context = gsap.context(() => {
          if (mode === "focus") {
            // Starts visible: painted immediately, then resolves.
            gsap.fromTo(
              chars,
              { filter: "blur(12px)", opacity: 0.35, y: 6 },
              {
                filter: "blur(0px)",
                opacity: 1,
                y: 0,
                duration: 1.1,
                ease: "power3.out",
                delay,
                stagger,
              },
            );
            return;
          }

          gsap.fromTo(
            chars,
            { yPercent: 115 },
            {
              yPercent: 0,
              duration: 0.85,
              ease: "power3.out",
              delay,
              stagger,
              scrollTrigger: { trigger: node, start: "top 85%", once: true },
            },
          );
        }, ref);
      })
      .catch(() => {
        // Animation is optional; the split text is already legible.
      });

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [split, reducedMotion, mode, delay, stagger]);

  if (!split) {
    return <Tag ref={ref} className={className}>{text}</Tag>;
  }

  return (
    <Tag ref={ref} className={className}>
      {/*
        The real text, for assistive technology, kept out of sight. An
        aria-label would be simpler but is prohibited on generic elements like
        <p>, which fails an audit rather than helping anyone. This works on any
        tag, and the split spans below are hidden so nothing is read twice.
      */}
      <span className="sr-only">{text}</span>
      {text.split(" ").map((word, wordIndex, words) => (
        <span
          key={`${word}-${wordIndex}`}
          aria-hidden="true"
          // Words stay whole so the line never breaks mid-word, and the mask
          // clips per word rather than across the whole line.
          className={
            mode === "mask"
              ? "inline-block overflow-hidden align-bottom"
              : "inline-block"
          }
        >
          {word.split("").map((char, charIndex) => (
            <span
              key={`${char}-${charIndex}`}
              data-char=""
              className="inline-block will-change-transform"
            >
              {char}
            </span>
          ))}
          {wordIndex < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}
