"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps a failure in the environment from taking the page down with it.
 *
 * The scene is decorative. It is already allowed to be absent on a phone, with
 * reduced motion, without WebGL, or before its chunk arrives, and the page is
 * required to read identically either way. A crash inside it should therefore
 * be one more way for it to be absent, not a reason for a reader to be shown an
 * error page instead of the work.
 *
 * That is not hypothetical. A stale array index left behind when a lookup table
 * became a keyed object threw on the first frame the graph rendered, and
 * because nothing caught it the whole site rendered as "This page couldn't
 * load" for anyone with a working GPU. The underlying mistake is fixed, but the
 * shape of the failure is the point: everything in here runs only on hardware
 * the build machine may not have, so it needs a floor under it.
 *
 * A class, because an error boundary can only be a class. Once tripped it stays
 * tripped: the failure is almost certainly deterministic, and remounting a
 * scene that has already thrown would just throw again on the next frame.
 */
export class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Reported, not swallowed. Nobody reading the page needs to know, but
    // anyone with the console open should be able to see what happened.
    console.error("Environment layer disabled after an error:", error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
