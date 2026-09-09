"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a media query.
 *
 * `useSyncExternalStore` rather than state-plus-effect: matchMedia is external
 * state React does not own, and copying it into state on mount causes a second
 * render every time.
 *
 * The server snapshot is `serverValue`, which callers should set to whichever
 * answer is safe to render first. For a min-width query that means `false` —
 * mobile-first, so the simpler layout is what renders before we know.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
