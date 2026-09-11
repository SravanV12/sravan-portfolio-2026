"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, type ShaderMaterial } from "three";
import { scrollState } from "@/lib/scroll-state";

/**
 * A grid floor and ceiling, receding to nothing.
 *
 * Added underneath the existing scene rather than in place of any of it. The
 * system graph, the motes and the field all float in space with no ground, so
 * nothing in the frame told the eye how far away anything was — depth was
 * carried entirely by parallax between layers. A ruled plane converging towards
 * a vanishing point is the oldest and cheapest depth cue there is, and it turns
 * the same objects into a place with a floor under them.
 *
 * Two of them make a corridor, which is what gives the page its sense of moving
 * *through* something as it scrolls rather than past it.
 *
 * One draw call each, no geometry beyond a single quad, and everything — the
 * ruling, the travel, the pool of light — computed in the fragment stage.
 */

const gridVertex = /* glsl */ `
  varying vec2 vCoord;
  varying float vDist;

  void main() {
    // Local plane coordinates. The plane is rotated flat, so these read as
    // ground coordinates without any world-space arithmetic.
    vCoord = position.xy;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Distance from the lens, used to fade and to widen the lines.
    vDist = -mv.z;

    gl_Position = projectionMatrix * mv;
  }
`;

const gridFragment = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uFg;
  uniform float uOffset;
  uniform float uScale;
  uniform float uEnergy;
  uniform float uShock;
  uniform float uFade;
  uniform vec2 uPool;

  varying vec2 vCoord;
  varying float vDist;

  void main() {
    vec2 c = vec2(vCoord.x, vCoord.y + uOffset) / uScale;

    vec2 minorGap = abs(fract(c) - 0.5);
    // Lines widen with distance. Derivatives would be the textbook answer, but
    // they need an extension under the GLSL version Three compiles to here, and
    // a plain distance term is enough to keep the far ruling from aliasing into
    // moire before the falloff has hidden it.
    float w = 0.02 + vDist * 0.0011;
    float minor = 1.0 - smoothstep(0.0, w, min(minorGap.x, minorGap.y));

    // Every eighth line is brighter, so the plane has a readable rhythm rather
    // than reading as one undifferentiated mesh.
    vec2 majorGap = abs(fract(c / 8.0) - 0.5);
    float major = 1.0 - smoothstep(0.0, w * 0.16, min(majorGap.x, majorGap.y));

    float line = minor * 0.34 + major * 0.9;

    // The plane has edges. These two terms are what hide them: it fades out
    // before the far rim and before the near rim passes the camera.
    float far = 1.0 - smoothstep(26.0, 72.0, vDist);
    float near = smoothstep(1.5, 10.0, vDist);

    // A pool of light tracking the pointer — the one directional cue in the
    // scene, and what stops the ruling reading as a flat printed texture.
    float pool = 1.0 - smoothstep(0.0, 18.0, length(vCoord - uPool));
    pool *= pool;

    vec3 colour = mix(uFg, uAccent, 0.3 + pool * 0.55);
    float alpha =
      line * far * near * uFade *
      (0.13 + pool * 0.55 + uEnergy * 0.12 + uShock * 0.3);

    // Most of this plane is empty space between lines. Discarding it early is
    // most of what makes a full-screen additive pass affordable.
    if (alpha < 0.003) discard;

    // Colour unpremultiplied, with alpha carrying the whole modulation.
    // Three additive blending is (srcAlpha, one), so it already multiplies by
    // alpha once — premultiplying here as well would square it, and at these
    // alphas that is the difference between a visible floor and nothing.
    gl_FragColor = vec4(colour, alpha);
  }
`;

function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

function GridPlane({
  height,
  facing,
  fade,
}: {
  /** Where the plane sits on Y, in world units. */
  height: number;
  /** -1 for a floor seen from above, 1 for a ceiling seen from below. */
  facing: -1 | 1;
  /** Overall strength. The ceiling is quieter than the floor. */
  fade: number;
}) {
  const materialRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uFg: { value: tokenColour("--color-fg", "#edede9") },
      uOffset: { value: 0 },
      uScale: { value: 2.6 },
      uEnergy: { value: 0 },
      uShock: { value: 0 },
      uFade: { value: fade },
      uPool: { value: new Float32Array([0, -24]) },
    }),
    [fade],
  );

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const u = material.uniforms;
    const ease = Math.min(delta * 3, 1);

    // Travel. The ruling slides towards the reader as the page descends, which
    // is what turns scrolling into forward motion instead of a pan.
    u.uOffset.value += (scrollState.progress * 46 - u.uOffset.value) * ease;
    u.uEnergy.value += (scrollState.energy - u.uEnergy.value) * ease;
    u.uShock.value = scrollState.shock * scrollState.shock;

    // The pool follows the pointer across the plane and runs ahead of the
    // camera as the page descends.
    const pool = u.uPool.value as Float32Array;
    // Local plane Y runs away from the camera, so the band actually on
    // screen is roughly 6 to 32. Centring the pool outside that put it behind
    // the lens, where it lit nothing.
    const targetX = (scrollState.pointerX - 0.5) * 40;
    const targetY = 6 + scrollState.pointerY * 26;
    pool[0] += (targetX - pool[0]) * ease;
    pool[1] += (targetY - pool[1]) * ease;
  });

  return (
    <mesh
      position={[0, height, -22]}
      rotation={[facing * (Math.PI / 2), 0, 0]}
      // Repositioned by nothing and larger than the frustum, so a stale
      // bounding sphere could cull it at the edge of a camera move.
      frustumCulled={false}
      // Behind the motes and the graph, in front of the backdrop.
      renderOrder={-1}
    >
      <planeGeometry args={[240, 240]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={gridVertex}
        fragmentShader={gridFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

export function GridPlanes({ ceiling }: { ceiling: boolean }) {
  return (
    <>
      <GridPlane height={-7} facing={-1} fade={1} />
      {/* The ceiling is what closes the corridor, but it is half the strength
          of the floor: two equally bright planes read as a tube and start
          competing with the content between them. */}
      {ceiling ? <GridPlane height={9} facing={1} fade={0.45} /> : null}
    </>
  );
}
