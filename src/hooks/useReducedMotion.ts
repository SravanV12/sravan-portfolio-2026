"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * On the server there is no media query to read. Assume motion is reduced:
 * getting it the other way round would render the animated version first and
 * show a frame of movement to someone who asked for none.
 */
function getServerSnapshot() {
  return true;
}

/**
 * Whether the visitor has asked their OS to reduce motion.
 *
 * `useSyncExternalStore` rather than state-plus-effect: matchMedia is external
 * state React does not own, and reading it into state in an effect causes a
 * second render on every mount. Toggling the OS setting updates live.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
