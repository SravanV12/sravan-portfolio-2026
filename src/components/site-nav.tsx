"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The site's only navigation.
 *
 * Three things in one small bar: where you are, how far through you are, and
 * how to get somewhere else. It is deliberately minimal — a portfolio with a
 * heavy chrome competes with the work it is presenting.
 *
 * The active marker is a single element that slides between labels rather than
 * a class toggled on each one. That is what makes the indicator read as one
 * object moving, and it is animated with a transform so it never triggers
 * layout.
 *
 * Everything degrades: with JavaScript off the links are plain anchors, the
 * progress line simply sits at zero, and the marker parks under the first
 * item. With reduced motion nothing slides — the marker jumps.
 */

const SECTIONS = [
  { id: "work", label: "Work" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const reducedMotion = useReducedMotion();

  const listRef = useRef<HTMLUListElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<string | null>(null);

  // Scroll progress, written straight to a transform rather than through
  // React: it changes continuously, and a re-render per frame to move a 1px
  // line would be absurd.
  //
  // Driven by the scroll event, NOT a standing requestAnimationFrame loop. The
  // loop version ran every frame forever, whether or not anything had moved,
  // and cost 260ms of main-thread blocking for a line that was usually still.
  useIsomorphicLayoutEffect(() => {
    // Measured once and on resize. Reading scrollHeight inside the handler
    // would force layout on every scroll event.
    let max = 0;
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
    };

    const update = () => {
      const bar = progressRef.current;
      if (!bar) return;
      const ratio = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    };

    measure();
    update();

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Which section is in view. Its own observer rather than the one feeding the
  // WebGL layer, because navigation has to work when motion is switched off.
  useIsomorphicLayoutEffect(() => {
    if (!onHome) {
      setActive(null);
      return;
    }

    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [onHome]);

  // Move the marker under whichever label is current.
  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    const marker = markerRef.current;
    if (!list || !marker) return;

    const index = SECTIONS.findIndex((s) => s.id === active);
    // Query the items, not the children: the marker is itself a child of this
    // list, so indexing children put the underline one place to the left of
    // wherever it belonged.
    const items = list.querySelectorAll("li");
    const item = items[index === -1 ? 0 : index];
    if (!item) return;

    marker.style.transition = reducedMotion
      ? "none"
      : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), width 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease";
    marker.style.width = `${item.offsetWidth}px`;
    marker.style.transform = `translateX(${item.offsetLeft}px)`;
    marker.style.opacity = active ? "1" : "0";
  }, [active, reducedMotion]);

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 top-0 z-40 pointer-events-none"
    >
      {/* Progress. Scaled on the X axis from the left edge, so it costs a
          compositor operation and nothing else. */}
      <span
        aria-hidden="true"
        className="bg-line/60 absolute inset-x-0 top-0 block h-px"
      >
        <span
          ref={progressRef}
          className="bg-accent block h-px origin-left scale-x-0"
        />
      </span>

      <div className="mx-auto flex max-w-page items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="text-mono hover:text-accent pointer-events-auto inline-block py-2 uppercase tracking-[0.12em] transition-colors"
        >
          Sravan V
        </Link>

        {onHome ? (
          <ul
            ref={listRef}
            className="text-mono pointer-events-auto relative hidden gap-8 uppercase sm:flex"
          >
            {/* One marker for the whole list. */}
            <span
              ref={markerRef}
              aria-hidden="true"
              className="bg-accent absolute -bottom-1 left-0 h-px w-0 opacity-0"
            />
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <Link
                  href={`/#${section.id}`}
                  aria-current={active === section.id ? "true" : undefined}
                  className={
                    active === section.id
                      ? "text-fg py-1 transition-colors"
                      : "text-muted hover:text-fg py-1 transition-colors"
                  }
                >
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Link
            href="/#work"
            className="text-mono text-muted hover:text-accent pointer-events-auto inline-block py-2 uppercase transition-colors"
          >
            ← Work
          </Link>
        )}
      </div>
    </nav>
  );
}
