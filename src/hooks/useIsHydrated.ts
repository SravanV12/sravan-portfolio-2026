"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to — the value is constant on each side. */
const noopSubscribe = () => () => {};

/**
 * False during server rendering and the hydration pass, true afterwards.
 *
 * Used where the client renders something the server cannot — splitting a
 * heading into per-character spans, for instance, where the server must emit
 * the plain string so the text survives with JavaScript disabled.
 *
 * `useSyncExternalStore` rather than a state-plus-effect flag: setting state
 * synchronously inside an effect triggers a second render pass, which the
 * React 19 lint rules correctly reject.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
