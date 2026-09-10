"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  type Points,
  type ShaderMaterial,
} from "three";
import { scrollState } from "@/lib/scroll-state";

/**
 * A field of drifting motes at varying depths.
 *
 * This is what sells travel: near particles sweep past quickly while far ones
 * barely move, so scrolling reads as movement through a volume rather than a
 * background sliding by. Depth is baked into an attribute rather than derived
 * from z, so a single draw call covers the whole field.
 *
 * Points are cheap, but they are still overdraw on a full-screen additive
 * pass — the count is tuned for effect, not density, and drops on lower
 * quality tiers.
 */

const vertexShader = /* glsl */ `
  attribute float aDepth;   // 0 = far, 1 = near
  attribute float aSeed;

  uniform float uTime;
  uniform float uScroll;
  uniform float uVelocity;
  uniform vec2  uPointer;
  uniform float uSize;

  varying float vDepth;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Parallax: near motes travel far, distant ones hold station. The camera
    // rig supplies perspective parallax on top of this.
    float parallax = mix(0.3, 2.4, aDepth);
    pos.y += uScroll * parallax * 14.0;
    pos.x += sin(uTime * 0.12 + aSeed * 6.28) * 0.35 * aDepth;

    // The pointer nudges the near layers only, which reads as depth.
    pos.xy += (uPointer - 0.5) * aDepth * 1.4;

    // Wrap so the field is endless rather than running out.
    pos.y = mod(pos.y + 12.0, 24.0) - 12.0;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Near motes are larger, and everything grows slightly with speed.
    //
    // Sized in pixels directly, with a hard ceiling. Scaling by 1/-mv.z the
    // way a perspective sprite normally would produced points up to ~720px
    // across here, and 700 of those blended additively turned the whole page
    // white. A mote is a few pixels; it never needs to be more.
    float size = uSize * mix(0.8, 2.6, aDepth) * (1.0 + uVelocity * 0.6);
    gl_PointSize = clamp(size, 1.0, 5.0);

    vDepth = aDepth;
    // Faint. This is an additive pass over the whole viewport, so alpha here
    // accumulates fast — motes should read as specks of light, not snow.
    vAlpha = mix(0.06, 0.30, aDepth);
  }
`;

const fragmentShader = /* glsl */ `
  // Precision is left to Three, so it matches the vertex stage. Declaring it
  // by hand here risks a varying-precision mismatch and a link failure.
  uniform vec3 uAccent;
  uniform vec3 uFg;

  varying float vDepth;
  varying float vAlpha;

  void main() {
    // Round, soft-edged mote. Discarding early keeps the fill rate sane.
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;

    float falloff = smoothstep(0.25, 0.0, d);

    // Near motes pick up the accent, far ones stay neutral, so the field has
    // colour depth instead of one flat tint.
    vec3 colour = mix(uFg, uAccent, vDepth * 0.8);

    gl_FragColor = vec4(colour, falloff * vAlpha);
  }
`;

/**
 * Deterministic PRNG (mulberry32).
 *
 * `Math.random()` during render is impure — React's lint rules reject it, and
 * rightly: the same render would produce a different field each time. A fixed
 * seed also means the layout is identical on every load, so the scene is
 * reproducible when something looks wrong.
 */
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

export function Dust({ count }: { count: number }) {
  const pointsRef = useRef<Points>(null);
  const materialRef = useRef<ShaderMaterial>(null);


  const { positions, depths, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const depths = new Float32Array(count);
    const seeds = new Float32Array(count);

    const random = makeRandom(0x5eed);

    for (let i = 0; i < count; i++) {
      // Spread through real depth between the lens and the backdrop, so the
      // camera rig produces genuine parallax rather than a flat sheet sliding.
      positions[i * 3] = (random() - 0.5) * 30;
      positions[i * 3 + 1] = (random() - 0.5) * 24;
      positions[i * 3 + 2] = -1 - random() * 20;
      // Biased towards the far field, so the near layer stays sparse and the
      // effect never turns into confetti.
      depths[i] = Math.pow(random(), 1.7);
      seeds[i] = random();
    }

    return { positions, depths, seeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uVelocity: { value: 0 },
      uPointer: { value: new Float32Array([0.5, 0.5]) },
      uSize: { value: 2.0 },
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

    const ease = Math.min(delta * 3.5, 1);
    u.uScroll.value += (scrollState.progress - u.uScroll.value) * ease;
    u.uVelocity.value += (scrollState.velocity - u.uVelocity.value) * ease;
    u.uPointer.value[0] +=
      (scrollState.pointerX - u.uPointer.value[0]) * ease;
    u.uPointer.value[1] +=
      (scrollState.pointerY - u.uPointer.value[1]) * ease;
  });

  return (
    <points
      ref={pointsRef}
      // World units now, not viewport-relative: the motes occupy actual space
      // between the camera and the backdrop.
      frustumCulled={false}
      // Drawn after the field and without depth testing, so the motes always
      // sit in front of it. Their sense of depth comes from the parallax
      // attribute, not from where they actually are in Z.
      renderOrder={1}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute attach="attributes-aDepth" args={[depths, 1]} />
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
