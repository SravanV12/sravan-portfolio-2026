"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * Reveals need to set their starting state before the browser paints, which is
 * what useLayoutEffect is for. React warns when it runs during SSR, where
 * there is no layout to read — so fall back there.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
