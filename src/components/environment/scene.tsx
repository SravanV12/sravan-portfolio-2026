"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial, Vector2 } from "three";
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
export function Scene({ quality }: { quality: "high" | "low" }) {
  return (
    <Canvas
      dpr={quality === "high" ? [1, 1.5] : 1}
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
      <Field />
    </Canvas>
  );
}
