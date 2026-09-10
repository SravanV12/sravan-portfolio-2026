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

/**
 * Whether this machine should run the environment at all.
 *
 * Two questions, not one. WebGL being *available* is not the same as it being
 * *fast*: browsers fall back to a software rasteriser when there is no usable
 * GPU, and a full-screen animated shader on the CPU is ruinous — measured
 * here at 2.5–4 seconds of main-thread blocking, with the performance score
 * falling from 99 to below 70.
 *
 * The frame-rate guard inside the scene catches this too, but only after a few
 * seconds, by which point the damage to loading is done. Reading the renderer
 * string costs nothing and decides before anything is mounted.
 */
function shouldRunWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;

    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) {
      const renderer = String(
        gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? "",
      ).toLowerCase();
      // SwiftShader (Chrome), llvmpipe (Mesa), and anything self-describing as
      // software or emulated: all CPU rasterisers.
      if (
        renderer.includes("swiftshader") ||
        renderer.includes("llvmpipe") ||
        renderer.includes("software") ||
        renderer.includes("microsoft basic")
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * How much scene this device should be asked to draw.
 *
 * Phones are not excluded — they get a cheaper tier rather than a blank
 * background. What is excluded is hardware that reports too few cores or too
 * little memory to run a full-screen shader without stealing frames from
 * scrolling, which matters far more than atmosphere does.
 */
function deviceTier(isWide: boolean, isMedium: boolean): "high" | "medium" | "low" | "none" {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;

  if (memory <= 2 || cores <= 2) return "none";
  if (isWide && memory >= 8 && cores >= 8) return "high";
  if (isMedium) return "medium";
  return "low";
}

export function EnvironmentLayer() {
  const reducedMotion = useReducedMotion();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const isMedium = useMediaQuery("(min-width: 768px)");
  // Only ever set from the idle callback, never synchronously in an effect.
  // Whether the scene should run is derived, so a change to the motion
  // preference or the viewport takes effect without another state write.
  const [capable, setCapable] = useState(false);
  // Set once the scene reports it cannot hold a usable frame rate. Never
  // reset: a device that struggled once will struggle again, and flickering
  // the background in and out is worse than not having it.
  const [tooSlow, setTooSlow] = useState(false);
  const [tier, setTier] = useState<"high" | "medium" | "low">("low");
  // Phones now run the scene too, at a lower tier — only reduced motion and
  // genuinely underpowered hardware opt out entirely.
  const wanted = !reducedMotion && !tooSlow;
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
      const chosen = deviceTier(isWide, isMedium);
      if (chosen === "none" || !shouldRunWebGL()) return;
      setTier(chosen);
      setCapable(true);
    };
    const idle = window.requestIdleCallback?.(start, { timeout: 2000 });
    const timer = idle === undefined ? window.setTimeout(start, 900) : 0;

    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      else window.clearTimeout(timer);
    };
  }, [wanted, capable, isWide, isMedium]);

  if (!enabled) return null;

  return (
    <div
      // Decorative: never announced, never focusable, never clickable.
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 select-none"
    >
      <Scene
        quality={tier}
        onSlow={() => setTooSlow(true)}
      />
    </div>
  );
}
