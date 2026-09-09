"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The one place ScrollTrigger is registered. Importing it anywhere else risks
 * registering twice, which silently duplicates its listeners.
 *
 * `gsap.registerPlugin` is idempotent, but keeping a single module means there
 * is one obvious answer to "where does this get set up".
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);

  // Development only, stripped from production builds. Makes
  // `ScrollTrigger.getAll().length` readable from the console, which is how
  // you check for leaked triggers after navigating around.
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as Record<string, unknown>).ScrollTrigger =
      ScrollTrigger;
    (window as unknown as Record<string, unknown>).gsap = gsap;
  }
}

export { gsap, ScrollTrigger };
