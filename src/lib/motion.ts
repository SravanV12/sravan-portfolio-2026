/**
 * The motion vocabulary. One place for how things move, so the site reads as
 * a single system rather than a pile of independently tuned effects.
 *
 * Nothing here imports GSAP — these are plain values, so the module is free to
 * use anywhere without pulling the animation engine into a bundle.
 */

/**
 * Easings.
 *
 * `enter` is the workhorse: fast out of the gate, long settle, which is what
 * makes an element feel like it arrives rather than slides. `emphasis`
 * overshoots very slightly for the few moments that deserve it.
 */
export const EASE = {
  enter: "power3.out",
  exit: "power2.in",
  emphasis: "back.out(1.4)",
  linear: "none",
} as const;

/**
 * Durations, in seconds. Step sizes rather than a continuum — three lengths
 * used consistently look deliberate; a dozen arbitrary ones look accidental.
 */
export const DURATION = {
  fast: 0.4,
  base: 0.7,
  slow: 1.1,
} as const;

/** Seconds between staggered children, by how many there are to get through. */
export const STAGGER = {
  tight: 0.04,
  base: 0.07,
  loose: 0.12,
} as const;

export type RevealVariant =
  | "fade"
  | "slide-up"
  | "slide-left"
  | "slide-right"
  | "scale"
  | "depth";

/**
 * Travel distances, in pixels, before the responsive scale below is applied.
 *
 * Deliberately small. A 24px lift reads as weight; a 120px one reads as a
 * slide-in effect, and starts pushing content around on small screens.
 */
const DISTANCE: Record<RevealVariant, number> = {
  fade: 0,
  "slide-up": 24,
  "slide-left": 32,
  "slide-right": 32,
  scale: 0,
  depth: 40,
};

/**
 * How far a reveal should travel at a given viewport width.
 *
 * Phones get roughly half the distance: the same 32px slide occupies a much
 * larger fraction of a 390px screen, so matching the number would not match
 * the feel. Ultrawide gets a little more so movement stays legible across a
 * very wide frame.
 */
export function travelFor(variant: RevealVariant, viewportWidth: number) {
  const base = DISTANCE[variant];
  if (viewportWidth < 640) return base * 0.55;
  if (viewportWidth < 1024) return base * 0.8;
  if (viewportWidth > 1920) return base * 1.15;
  return base;
}

/** The starting state for each variant, as GSAP tween vars. */
export function fromState(
  variant: RevealVariant,
  viewportWidth: number,
): Record<string, number> {
  const travel = travelFor(variant, viewportWidth);

  switch (variant) {
    case "fade":
      return { opacity: 0 };
    case "slide-up":
      return { opacity: 0, y: travel };
    case "slide-left":
      return { opacity: 0, x: travel };
    case "slide-right":
      return { opacity: 0, x: -travel };
    case "scale":
      return { opacity: 0, scale: 0.94 };
    case "depth":
      // Real perspective: the element arrives from behind the page plane and
      // rotates flat, rather than sliding in two dimensions.
      return { opacity: 0, z: -travel * 4, rotateX: 8, y: travel * 0.4 };
  }
}

/** The resting state. Explicit, so nothing is left mid-transform. */
export const TO_STATE = {
  opacity: 1,
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rotateX: 0,
} as const;

/** Where in the viewport a reveal should trigger. */
export const TRIGGER_START = "top 85%";
