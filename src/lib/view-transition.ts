/**
 * Shared-element navigation, using the browser's own View Transitions API.
 *
 * The case study title on the index and the heading on the case study page
 * carry the same `view-transition-name`, so the browser treats them as one
 * object and animates between the two positions itself. No library, no
 * measuring, no cloned nodes — and in a browser without support the
 * navigation simply happens, which is the correct fallback.
 */

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>;
  };
};

/**
 * Set while a shared-element transition is running, so the route-level fade
 * does not also play. Two transitions over the same navigation read as a
 * stutter rather than as one considered move.
 */
let sharedTransitionRunning = false;

export function isSharedTransitionRunning() {
  return sharedTransitionRunning;
}

export function clearSharedTransition() {
  sharedTransitionRunning = false;
}

/** A stable name for one case study, used on both ends of the navigation. */
export function caseStudyTransitionName(slug: string) {
  // Names must be valid custom idents, so anything unusual in a slug is
  // flattened rather than trusted.
  return `case-${slug.replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

/**
 * Runs `navigate` inside a view transition where the browser supports one.
 *
 * Returns true if it took over, false if the caller should navigate normally.
 */
export function withViewTransition(navigate: () => void): boolean {
  if (typeof document === "undefined") return false;

  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== "function") return false;

  // The setting is honoured explicitly rather than left to the browser, which
  // still cross-fades under reduced motion in some versions.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  sharedTransitionRunning = true;
  const transition = doc.startViewTransition(() => {
    navigate();
  });

  void transition.finished.finally(() => {
    sharedTransitionRunning = false;
  });

  return true;
}
