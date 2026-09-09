"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial, Vector2 } from "three";
import { Dust } from "@/components/environment/dust";
import {
  fragmentShader,
  vertexShader,
} from "@/components/environment/field-material";
import { scrollState } from "@/lib/scroll-state";

/**
 * Reads a colour straight out of the CSS design tokens, so the scene cannot
 * drift away from the palette. Falls back to the token's own value if the
 * property is missing for any reason.
 */
function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

function Field() {
  const materialRef = useRef<ShaderMaterial>(null);
  const { viewport, size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uVelocity: { value: 0 },
      uPointer: { value: new Vector2(0.5, 0.5) },
      uResolution: { value: new Vector2(1, 1) },
      uBg: { value: tokenColour("--color-bg", "#0a0a0b") },
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uFg: { value: tokenColour("--color-fg", "#edede9") },
    }),
    [],
  );

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;

    const u = material.uniforms;
    u.uTime.value += delta;
    u.uResolution.value.set(size.width, size.height);

    // Ease towards the live values rather than snapping, so the field always
    // moves smoothly even when scroll events arrive in bursts.
    const ease = Math.min(delta * 4, 1);
    u.uScroll.value += (scrollState.progress - u.uScroll.value) * ease;
    u.uVelocity.value += (scrollState.velocity - u.uVelocity.value) * ease;
    u.uPointer.value.x += (scrollState.pointerX - u.uPointer.value.x) * ease;
    u.uPointer.value.y += (scrollState.pointerY - u.uPointer.value.y) * ease;
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/**
 * The WebGL environment. Rendered behind everything, never interactive.
 *
 * Resolution is capped well below the device pixel ratio: this is a soft,
 * out-of-focus field, so rendering it at full retina resolution would cost a
 * great deal to produce a picture nobody can tell apart.
 */
/**
 * Watches the frame rate and gives up if the device cannot keep pace.
 *
 * A background is never worth a janky page. Software rendering, an old
 * integrated GPU, a laptop on battery saver — any of them can turn this from
 * atmosphere into a stutter, and none of them announce themselves in advance.
 * The first second is ignored so shader compilation is not mistaken for slow
 * hardware.
 */
function PerformanceGuard({ onSlow }: { onSlow: () => void }) {
  const frames = useRef(0);
  const elapsed = useRef(0);
  const settled = useRef(0);

  useFrame((_, delta) => {
    settled.current += delta;
    if (settled.current < 1) return;

    frames.current += 1;
    elapsed.current += delta;

    if (elapsed.current >= 2) {
      const fps = frames.current / elapsed.current;
      if (fps < 24) onSlow();
      frames.current = 0;
      elapsed.current = 0;
    }
  });

  return null;
}

export function Scene({
  quality,
  onSlow,
}: {
  quality: "high" | "low";
  onSlow: () => void;
}) {
  return (
    <Canvas
      // Rendered well below device resolution. This is a soft, out-of-focus
      // field — at full retina resolution it costs several times as much to
      // produce a picture nobody can tell apart.
      dpr={quality === "high" ? [0.75, 1] : 0.6}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        // Nothing reads pixels back, so the browser can discard the buffer.
        preserveDrawingBuffer: false,
      }}
      camera={{ position: [0, 0, 1], fov: 50 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <PerformanceGuard onSlow={onSlow} />
      <Field />
      {/* Fewer motes on the low tier: this pass is additive and full-screen,
          so the count is the main thing driving its cost. */}
      <Dust count={quality === "high" ? 400 : 180} />
    </Canvas>
  );
}
