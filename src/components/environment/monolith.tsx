"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  FrontSide,
  Color,
  type Mesh,
  type ShaderMaterial,
} from "three";
import { scrollState } from "@/lib/scroll-state";

/**
 * The form the page travels past.
 *
 * A sphere whose surface is displaced by noise, so it reads as something
 * between a planet and an energy field rather than as an obvious primitive.
 * It rotates slowly, breathes, and tightens or unravels as the page scrolls —
 * the same journey the colour temperature makes.
 *
 * Deliberately not a model: no asset to load, no likeness, and the geometry
 * cost is a knob (subdivision) rather than a fixed download. It is lit by a
 * rim term rather than real lights, which costs nothing and gives the hard
 * edge-glow that reads as futuristic.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uVelocity;

  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  // Cheap 3D value noise. Three octaves is plenty at this scale.
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), u.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x), u.y),
      u.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 pos = position;

    // Scrolling drives the surface from calm to agitated and back, so the
    // form is visibly different at the top and the middle of the page.
    float agitation = 0.35 + sin(uScroll * 3.14159) * 0.55 + uVelocity * 0.4;

    float n = fbm(normalize(pos) * 1.9 + vec3(0.0, uTime * 0.09, uScroll * 2.4));
    vNoise = n;

    pos += normal * (n - 0.5) * agitation;

    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vView = normalize(-mv.xyz);

    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  // No precision qualifier here on purpose. Three injects one that matches the
  // vertex stage; declaring mediump by hand while the vertex stage defaults to
  // highp makes the varyings disagree, and the program fails to link with
  // "VALIDATE_STATUS false" — a silent blank scene, not a visible error.
  uniform vec3 uAccent;
  uniform vec3 uFg;
  uniform float uScroll;

  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  void main() {
    // Rim light: bright where the surface turns away from the viewer, which
    // is what makes a dark form read as glowing rather than as a silhouette.
    float rim = 1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0);
    rim = pow(rim, 2.6);

    vec3 colour = mix(uAccent, uFg, 0.25) * rim;
    // Crests of the displacement catch a little extra light.
    colour += uAccent * smoothstep(0.55, 0.95, vNoise) * 0.35;

    // Fades back as the page descends, so it recedes rather than following
    // the reader all the way down.
    float presence = 0.85 - uScroll * 0.35;

    gl_FragColor = vec4(colour * presence, rim * presence);
  }
`;

function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

export function Monolith({ detail }: { detail: number }) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uVelocity: { value: 0 },
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uFg: { value: tokenColour("--color-fg", "#edede9") },
    }),
    [],
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const u = material.uniforms;
    u.uTime.value += delta;

    const ease = Math.min(delta * 3, 1);
    u.uScroll.value += (scrollState.progress - u.uScroll.value) * ease;
    u.uVelocity.value += (scrollState.velocity - u.uVelocity.value) * ease;

    // Slow tumble, plus a lean towards the pointer so it feels aware.
    mesh.rotation.y += delta * 0.06;
    mesh.rotation.x += delta * 0.021;

    const targetX = (scrollState.pointerX - 0.5) * 0.5;
    const targetY = (scrollState.pointerY - 0.5) * 0.4;
    mesh.rotation.z += (targetX * 0.3 - mesh.rotation.z) * ease;

    // Travels across and away as the page descends: the reader passes it.
    mesh.position.x += (3.1 + targetX - mesh.position.x) * ease;
    mesh.position.y +=
      (-1.2 + scrollState.progress * 6.5 + targetY - mesh.position.y) * ease;
    mesh.position.z += (-7 - scrollState.progress * 5 - mesh.position.z) * ease;
  });

  return (
    <mesh ref={meshRef} position={[3.1, -1.2, -7]}>
      <icosahedronGeometry args={[1.9, detail]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        // Front faces, not back. With BackSide the surface normals point away
        // from the camera, so the rim term saturated to 1 across the whole
        // shape and it rendered as a flat opaque disc instead of a glowing
        // edge. The rim only reads as light when it can fall off.
        side={FrontSide}
      />
    </mesh>
  );
}
