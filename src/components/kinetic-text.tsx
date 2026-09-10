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
        // In focus mode the element itself is the target — there are no
        // character spans, by design.
        const targets = mode === "focus" ? [node] : Array.from(chars);
        if (targets.length === 0) return;

        context = gsap.context(() => {
          if (mode === "focus") {
            // Starts visible: painted immediately, then resolves.
            gsap.fromTo(
              targets,
              { filter: "blur(12px)", opacity: 0.35, y: 6 },
              {
                filter: "blur(0px)",
                opacity: 1,
                y: 0,
                duration: 1.1,
                ease: "power3.out",
                delay,
                stagger: mode === "focus" ? 0 : stagger,
              },
            );
            return;
          }

          gsap.fromTo(
            targets,
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

  // `focus` mode never splits. Blurring the whole block is visually identical
  // to blurring each character, and splitting meant carrying a duplicate copy
  // of the text for assistive technology — which also duplicated it on copy
  // and paste. One copy of the words, always.
  if (!split || mode === "focus") {
    return (
      <Tag ref={ref} className={className}>
        {text}
      </Tag>
    );
  }

  return (
    // `mask` mode is for headings, where aria-label is valid. The split
    // characters are hidden from assistive technology and the label carries
    // the real text — no second copy in the DOM.
    <Tag ref={ref} className={className} aria-label={text}>
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
