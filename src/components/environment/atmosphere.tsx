"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Color,
  type Mesh,
  NormalBlending,
  type ShaderMaterial,
  Vector2,
} from "three";
import { scrollState } from "@/lib/scroll-state";

/**
 * The lens the scene is viewed through.
 *
 * A single quad riding just in front of the camera, drawn last, carrying the
 * three things that make the frame feel photographed rather than rendered: a
 * vignette, a little grain, and a band of light that crosses the frame when the
 * reader moves between sections.
 *
 * It darkens and brightens in the same pass. With normal blending the output is
 * `src * a + dst * (1 - a)`, so a near-black source with a low alpha dims what
 * is behind it and an accent source with a low alpha lifts it — which means the
 * vignette and the sweep can share one draw call instead of needing two passes
 * with opposite blend modes.
 *
 * Worth noting for legibility: this sits behind the DOM, so it never touches
 * the type. Darkening the edges of the backdrop only ever helps the text that
 * is laid over them.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBg;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uSweep;
  uniform float uFlash;
  uniform float uVelocity;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 p = vUv - 0.5;

    // Wider than it is tall, so it frames the picture rather than tunnelling
    // it. The content column sits left of centre and this has to stay clear
    // of it at every viewport ratio.
    float r = length(p * vec2(1.04, 1.28));
    float vignette = smoothstep(0.36, 0.86, r);

    // Grain. Only the positive half is used, so it can add texture without
    // ever lifting the ground off black.
    float grain = max(hash(vUv * 860.0 + fract(uTime) * 97.3) - 0.5, 0.0);

    // A band of light crossing the frame on a section change. Travels bottom
    // to top, against the direction of reading, so it registers as the view
    // moving rather than as content sliding.
    float band = uSweep < 0.0
      ? 0.0
      : 1.0 - smoothstep(0.0, 0.26, abs(vUv.y - (1.0 - uSweep)));
    band *= band;

    float bright = band * 0.15 + uFlash * 0.09;
    // Fast scrolling closes the frame down slightly, the way a lens does when
    // it is being swung.
    float dark = vignette * (0.52 + uVelocity * 0.14) + grain * 0.05;

    float alpha = clamp(dark + bright, 0.0, 0.92);
    // The colour is the weighted average of the two contributions, which is
    // what lets one alpha carry both a darkening and a brightening term.
    vec3 colour = mix(uBg, uAccent, bright / max(alpha, 0.0001));

    gl_FragColor = vec4(colour, alpha);
  }
`;

/** How far in front of the lens the overlay sits, in world units. */
const LENS_DISTANCE = 0.6;

function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

export function Atmosphere() {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);

  // -1 when idle, otherwise 0..1 as the band crosses.
  const sweep = useRef(-1);
  const lastSection = useRef(-1);
  const size = useMemo(() => new Vector2(), []);

  const uniforms = useMemo(
    () => ({
      uBg: { value: tokenColour("--color-bg", "#0a0a0b") },
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uTime: { value: 0 },
      uSweep: { value: -1 },
      uFlash: { value: 0 },
      uVelocity: { value: 0 },
    }),
    [],
  );

  useFrame((state, delta) => {
    const material = materialRef.current;
    const mesh = meshRef.current;
    if (!material || !mesh) return;

    const u = material.uniforms;
    u.uTime.value += delta;
    u.uVelocity.value +=
      (scrollState.velocity - u.uVelocity.value) * Math.min(delta * 3, 1);
    u.uFlash.value = scrollState.shock;

    // Tracked here rather than shared, so this layer answers a section change
    // on its own terms and on its own timing.
    if (scrollState.section !== lastSection.current) {
      lastSection.current = scrollState.section;
      sweep.current = 0;
    }
    if (sweep.current >= 0) {
      sweep.current += delta / 0.85;
      if (sweep.current > 1.3) sweep.current = -1;
    }
    u.uSweep.value = sweep.current;

    // Ride the lens exactly, so it is always square to the frame however the
    // rig is moving.
    const { camera } = state;
    mesh.position.copy(camera.position);
    mesh.quaternion.copy(camera.quaternion);
    mesh.translateZ(-LENS_DISTANCE);

    const perspective = camera as typeof camera & { fov?: number };
    const fov = perspective.fov ?? 45;
    const height = 2 * Math.tan((fov * Math.PI) / 360) * LENS_DISTANCE;
    size.set(state.size.width, state.size.height);
    mesh.scale.set(height * (size.x / Math.max(size.y, 1)), height, 1);
  });

  return (
    <mesh
      ref={meshRef}
      frustumCulled={false}
      // Last of everything. This is the lens, so it has to be applied over a
      // finished frame rather than into the middle of one.
      renderOrder={20}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={NormalBlending}
      />
    </mesh>
  );
}
