"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, type ShaderMaterial } from "three";
import { scrollState } from "@/lib/scroll-state";

/**
 * A burst of embers thrown out wherever the reader presses.
 *
 * The graph already answers a press with a shockwave through its wiring; this
 * answers it at the point of contact, so the gesture has a source as well as a
 * consequence. The two are driven by the same decaying value, which is what
 * keeps them reading as one event rather than two effects that happen together.
 *
 * Entirely GPU-driven: each particle carries a direction and a seed, and its
 * whole life is a function of one uniform. Nothing is simulated on the main
 * thread and nothing is allocated per frame, so the cost is one draw call
 * whether the burst is running or idle.
 */

const vertexShader = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSeed;

  uniform float uProgress;
  uniform float uActive;
  uniform vec3 uOrigin;

  varying float vFade;
  varying float vSeed;

  void main() {
    float t = clamp(uProgress, 0.0, 1.0);

    // Fast out, then coasting. A linear reach reads as an expanding ring;
    // this reads as something thrown.
    float eased = 1.0 - pow(1.0 - t, 3.0);
    // Throw distance. Deliberately short: at the distance this sits from the
    // lens, a few world units is already most of the screen, and a wider throw
    // scattered the embers so far apart that the burst stopped reading as one
    // event and just looked like flecks appearing across the whole frame.
    vec3 pos = uOrigin + aDir * eased * (1.1 + aSeed * 2.4);

    // A little fall, so they are embers rather than a diagram of an explosion.
    pos.y -= t * t * (0.5 + aSeed * 0.9);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Shrinking as they go, and clamped for the same reason every other point
    // sprite here is: this pass is additive and full-screen, so a handful of
    // large sprites is all it takes to wash the page out.
    float size = (46.0 / max(-mv.z, 1.0)) * (1.0 - t * 0.5);
    gl_PointSize = clamp(size, 1.0, 7.0);

    vFade = (1.0 - smoothstep(0.3, 1.0, t)) * uActive;
    vSeed = aSeed;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uFg;

  varying float vFade;
  varying float vSeed;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    if (vFade <= 0.001) discard;

    float falloff = smoothstep(0.25, 0.0, d);
    // The hottest few run towards white, which is what makes a burst read as
    // having a temperature rather than being one flat colour.
    vec3 colour = mix(uAccent, uFg, smoothstep(0.75, 1.0, vSeed));

    // See the note in the grid shader: additive blending multiplies by
    // alpha, so the colour must not be premultiplied here as well.
    gl_FragColor = vec4(colour, falloff * vFade);
  }
`;

/** Deterministic PRNG (mulberry32) — see the note in `dust.tsx`. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

/** How long a burst lives, in seconds. */
const LIFETIME = 1.1;

export function Sparks({ count }: { count: number }) {
  const materialRef = useRef<ShaderMaterial>(null);
  const progress = useRef(1);
  const previousShock = useRef(0);

  const { positions, directions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const directions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const random = makeRandom(0x5a4b1c);

    for (let i = 0; i < count; i++) {
      // Evenly distributed on a sphere. Using two uniform angles instead would
      // bunch the directions at the poles and the burst would look combed.
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(Math.max(1 - z * z, 0));

      directions[i * 3] = Math.cos(angle) * radius;
      directions[i * 3 + 1] = Math.sin(angle) * radius;
      directions[i * 3 + 2] = z * 0.6;

      seeds[i] = random();
    }

    return { positions, directions, seeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 1 },
      uActive: { value: 0 },
      uOrigin: { value: new Float32Array([0, 0, -4]) },
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uFg: { value: tokenColour("--color-fg", "#edede9") },
    }),
    [],
  );

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const u = material.uniforms;

    // The shared shock only ever rises when a press starts, so a rise is the
    // press. Reading it rather than consuming it leaves the flag alone for the
    // graph, which owns it.
    const shock = scrollState.shock;
    if (shock > previousShock.current + 0.01) {
      progress.current = 0;
      const origin = u.uOrigin.value as Float32Array;
      // Roughly where the pointer is, pushed into the scene. It does not need
      // to be an exact unprojection — it needs to be where the eye was.
      origin[0] = (scrollState.pointerX - 0.5) * 13;
      origin[1] = (scrollState.pointerY - 0.5) * 7.5;
      origin[2] = -4.5;
    }
    previousShock.current = shock;

    if (progress.current < 1) progress.current += delta / LIFETIME;
    u.uProgress.value = progress.current;
    u.uActive.value = progress.current < 1 ? 1 : 0;
  });

  return (
    <points frustumCulled={false} renderOrder={3}>
      <bufferGeometry>
        {/* Unused by the shader — a spark's position is derived entirely from
            its direction and the progress uniform — but three needs the
            attribute present to size the draw. */}
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aDir" args={[directions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
