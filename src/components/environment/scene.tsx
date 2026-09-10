"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Mesh, type ShaderMaterial, Vector2 } from "three";
import { CameraRig } from "@/components/environment/camera-rig";
import { Dust } from "@/components/environment/dust";
import { Monolith } from "@/components/environment/monolith";
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

/** How far in front of the camera the backdrop sits, in world units. */
const BACKDROP_DISTANCE = 26;

function Field() {
  const materialRef = useRef<ShaderMaterial>(null);
  const meshRef = useRef<Mesh>(null);
  const { size, camera } = useThree();

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

    // Ride with the camera so the backdrop always fills the frame however the
    // rig moves. Everything else in the scene sits between here and the lens,
    // which is what gives them parallax against it.
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.copy(camera.position);
    mesh.quaternion.copy(camera.quaternion);
    mesh.translateZ(-BACKDROP_DISTANCE);

    const perspective = camera as typeof camera & { fov?: number };
    const fov = perspective.fov ?? 45;
    const height =
      2 * Math.tan((fov * Math.PI) / 360) * BACKDROP_DISTANCE;
    mesh.scale.set(height * (size.width / Math.max(size.height, 1)), height, 1);
  });

  return (
    // Never culled: it is repositioned every frame, and a stale bounding
    // sphere would flicker it out at the edges of camera movement.
    <mesh ref={meshRef} frustumCulled={false}>
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

export type Quality = "high" | "medium" | "low";

/**
 * Resolution per tier. Rendered well below device pixel ratio throughout —
 * this is a soft, out-of-focus field, so full retina resolution costs several
 * times as much to produce a picture nobody can tell apart. Phones get the
 * lowest setting, which is what makes running it there affordable at all.
 */
const DPR: Record<Quality, number | [number, number]> = {
  high: [0.75, 1],
  medium: 0.7,
  low: 0.5,
};

const DUST: Record<Quality, number> = {
  high: 400,
  medium: 260,
  low: 140,
};

/**
 * Subdivision of the travelling form. Each step up roughly quadruples the
 * vertex count, and the vertex shader runs noise per vertex — so this is the
 * single biggest lever on what the form costs.
 */
const DETAIL: Record<Quality, number> = {
  high: 4,
  medium: 3,
  low: 2,
};

export function Scene({
  quality,
  onSlow,
}: {
  quality: Quality;
  onSlow: () => void;
}) {
  return (
    <Canvas
      dpr={DPR[quality]}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        // Nothing reads pixels back, so the browser can discard the buffer.
        preserveDrawingBuffer: false,
      }}
      camera={{ position: [0, 0, 5], fov: 45, near: 0.1, far: 60 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <PerformanceGuard onSlow={onSlow} />
      <CameraRig />
      <Field />
      {/* Fewer motes on lower tiers: this pass is additive and full-screen,
          so the count is the main thing driving its cost. */}
      <Dust count={DUST[quality]} />
      <Monolith detail={DETAIL[quality]} />
    </Canvas>
  );
}
