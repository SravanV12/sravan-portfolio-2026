"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Mesh, type ShaderMaterial, Vector2 } from "three";
import { Atmosphere } from "@/components/environment/atmosphere";
import { CameraImpulse } from "@/components/environment/camera-impulse";
import { CameraRig } from "@/components/environment/camera-rig";
import { Dust } from "@/components/environment/dust";
import { GridPlanes } from "@/components/environment/grid-planes";
import { NetworkScene } from "@/components/environment/network-scene";
import { Sparks } from "@/components/environment/sparks";
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
 * Node count for the system graph. Edges and packets scale with it, so this
 * one number sets the whole scene's cost.
 */
const NODES: Record<Quality, number> = {
  high: 64,
  medium: 40,
  low: 24,
};

/** Embers in a click burst. */
const SPARKS: Record<Quality, number> = {
  high: 140,
  medium: 90,
  low: 0,
};

/**
 * Which of the added layers each tier gets.
 *
 * The grid floor and the lens are on everywhere: the floor is what gives the
 * scene a sense of depth at all, and the lens is a single quad whose vignette
 * makes the type over it easier to read, not harder. What the lower tiers lose
 * is the second grid plane, the embers and the pointer wiring — the parts that
 * are pure ornament, and the parts that cost either another full-screen
 * additive pass or per-frame work on the main thread.
 */
const LAYERS: Record<Quality, { ceiling: boolean; probe: boolean }> = {
  high: { ceiling: true, probe: true },
  medium: { ceiling: true, probe: false },
  low: { ceiling: false, probe: false },
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
      {/* Strictly after the rig. Frame callbacks run in mount order, and this
          adds drift and shake on top of the rotation the rig has just set. */}
      <CameraImpulse />
      <Field />
      {/* The ground the rest of the scene stands on. Drawn before everything
          so the motes and the graph read as being in front of it. */}
      <GridPlanes ceiling={LAYERS[quality].ceiling} />
      {/* Fewer motes on lower tiers: this pass is additive and full-screen,
          so the count is the main thing driving its cost. */}
      <Dust count={DUST[quality]} />
      <NetworkScene nodeCount={NODES[quality]} probe={LAYERS[quality].probe} />
      {SPARKS[quality] > 0 ? <Sparks count={SPARKS[quality]} /> : null}
      {/* Last. This is the lens, so it is applied over a finished frame. */}
      <Atmosphere />
    </Canvas>
  );
}
