"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { scrollState } from "@/lib/scroll-state";

/**
 * Decides whether the environment runs at all, and keeps the shared scroll and
 * pointer state fed while it does.
 *
 * The scene is a background. It is allowed to be absent — on a phone, with
 * reduced motion, without WebGL, or before the chunk arrives — and the page
 * must read exactly the same either way. Nothing here is content.
 */

const Scene = dynamic(
  () => import("@/components/environment/scene").then((m) => m.Scene),
  { ssr: false },
);

/** Cheap capability probe. Some devices report a context and then fail. */
function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

export function EnvironmentLayer() {
  const reducedMotion = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  // Only ever set from the idle callback, never synchronously in an effect.
  // Whether the scene should run is derived, so a change to the motion
  // preference or the viewport takes effect without another state write.
  const [capable, setCapable] = useState(false);
  const wanted = !reducedMotion && isDesktop;
  const enabled = capable && wanted;

  // Feed scroll and pointer state whenever the page is capable of using it.
  useEffect(() => {
    if (reducedMotion) return;

    let frame = 0;
    let lastY = window.scrollY;
    let velocity = 0;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      scrollState.progress = max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0;

      // Normalised against the viewport so it behaves the same on any screen.
      const delta = Math.abs(y - lastY) / window.innerHeight;
      velocity = Math.min(velocity * 0.8 + delta, 1);
      scrollState.velocity = velocity;
      lastY = y;
    };

    const onPointerMove = (event: PointerEvent) => {
      scrollState.pointerX = event.clientX / window.innerWidth;
      scrollState.pointerY = 1 - event.clientY / window.innerHeight;
    };

    // Decay velocity even when scrolling stops, so the field settles.
    const decay = () => {
      velocity *= 0.94;
      scrollState.velocity = velocity;
      frame = requestAnimationFrame(decay);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    frame = requestAnimationFrame(decay);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!wanted || capable) return;

    // Wait for the browser to go quiet before pulling in a WebGL bundle, so
    // the environment can never compete with first paint.
    const start = () => {
      if (hasWebGL()) setCapable(true);
    };
    const idle = window.requestIdleCallback?.(start, { timeout: 2000 });
    const timer = idle === undefined ? window.setTimeout(start, 900) : 0;

    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      else window.clearTimeout(timer);
    };
  }, [wanted, capable]);

  if (!enabled) return null;

  return (
    <div
      // Decorative: never announced, never focusable, never clickable.
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 select-none"
    >
      <Scene quality={coarsePointer ? "low" : "high"} />
    </div>
  );
}
