"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  type Group,
  type InstancedMesh,
  Object3D,
  type ShaderMaterial,
  Vector3,
} from "three";
import { buildTopology } from "@/components/environment/network";
import { scrollState } from "@/lib/scroll-state";

/**
 * A distributed system, running.
 *
 * Nodes are services. The lines between them are connections. The bright motes
 * travelling those lines are messages in flight — they accelerate when the
 * page is scrolled quickly, and the whole graph leans towards the cursor.
 *
 * This is the portfolio's subject rendered as its background: sync engines,
 * microservices and retrieval pipelines are what the case studies describe, so
 * the environment says the same thing the writing does rather than being
 * decoration that happens to sit behind it.
 *
 * Cost is bounded deliberately. Nodes are one instanced draw call, edges are
 * one LineSegments, packets are one Points — three draw calls for the whole
 * system, with the packet motion computed on the GPU from a per-packet seed so
 * nothing is animated on the main thread.
 */

const edgeVertex = /* glsl */ `
  attribute float aT;
  varying float vT;

  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeFragment = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uFg;
  uniform float uScroll;

  varying float vT;

  void main() {
    // The wiring is the point. At 0.10 alpha it was invisible against
    // near-black and the scene read as loose dots rather than a system, so
    // the connections now carry the structure and the nodes just mark it.
    vec3 colour = mix(uFg, uAccent, 0.45);
    float alpha = 0.30 + uScroll * 0.10;
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;

const packetVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aSeed;

  uniform float uTime;
  uniform float uVelocity;
  uniform float uSize;

  varying float vFade;

  void main() {
    // Position along the wire, entirely GPU-side: no per-frame CPU work for
    // any number of packets.
    float speed = 0.12 + aSeed * 0.10 + uVelocity * 0.55;
    float t = fract(uTime * speed + aSeed);

    vec3 pos = mix(aStart, aEnd, t);

    // Fade in and out at the ends so packets arrive and depart rather than
    // popping into existence mid-wire.
    vFade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.88, 1.0, t));

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Perspective size, clamped: nearer packets are bigger, but never so big
    // that a handful of them wash out the screen.
    float size = uSize * (14.0 / max(-mv.z, 1.0));
    gl_PointSize = clamp(size, 1.0, 6.0) * (1.0 + uVelocity);
  }
`;

const packetFragment = /* glsl */ `
  uniform vec3 uAccent;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float falloff = smoothstep(0.25, 0.0, d);
    gl_FragColor = vec4(uAccent * falloff * vFade, falloff * vFade * 0.9);
  }
`;

function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

export function NetworkScene({ nodeCount }: { nodeCount: number }) {
  const groupRef = useRef<Group>(null);
  const nodesRef = useRef<InstancedMesh>(null);
  const edgeMaterialRef = useRef<ShaderMaterial>(null);
  const packetMaterialRef = useRef<ShaderMaterial>(null);

  const topology = useMemo(() => buildTopology(nodeCount), [nodeCount]);

  // Scratch objects, reused every frame so the loop allocates nothing.
  const dummy = useMemo(() => new Object3D(), []);
  const cursor = useMemo(() => new Vector3(), []);
  const nodePos = useMemo(() => new Vector3(), []);

  const edgeUniforms = useMemo(
    () => ({
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uFg: { value: tokenColour("--color-fg", "#edede9") },
      uScroll: { value: 0 },
    }),
    [],
  );

  const packetUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVelocity: { value: 0 },
      uSize: { value: 2.4 },
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
    }),
    [],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    const mesh = nodesRef.current;
    if (!group || !mesh) return;

    const ease = Math.min(delta * 3, 1);

    if (packetMaterialRef.current) {
      const u = packetMaterialRef.current.uniforms;
      u.uTime.value += delta;
      u.uVelocity.value += (scrollState.velocity - u.uVelocity.value) * ease;
    }
    if (edgeMaterialRef.current) {
      const u = edgeMaterialRef.current.uniforms;
      u.uScroll.value += (scrollState.progress - u.uScroll.value) * ease;
    }

    // The whole system turns slowly as the page descends, so different parts
    // of the topology face the reader at different points in the journey.
    group.rotation.y += (scrollState.progress * 0.9 - group.rotation.y) * ease;
    group.rotation.x +=
      ((scrollState.pointerY - 0.5) * 0.18 - group.rotation.x) * ease;
    group.position.y += (scrollState.progress * 5.5 - group.position.y) * ease;
    group.position.x += (3.4 - group.position.x) * ease;

    // Where the cursor is pointing, roughly, in the graph's own space.
    cursor.set(
      (scrollState.pointerX - 0.5) * 16,
      (scrollState.pointerY - 0.5) * 10,
      -6,
    );

    // Nodes pulse, and swell when the cursor is near them. Sixty matrix
    // updates a frame is nothing, and it keeps the interaction on the CPU
    // where the proximity test is trivial.
    const time = packetMaterialRef.current?.uniforms.uTime.value ?? 0;

    for (let i = 0; i < nodeCount; i++) {
      nodePos.set(
        topology.nodes[i * 3],
        topology.nodes[i * 3 + 1],
        topology.nodes[i * 3 + 2],
      );

      const pulse = 0.85 + Math.sin(time * 1.6 + topology.seeds[i] * 6.28) * 0.15;
      const proximity = 1 - Math.min(nodePos.distanceTo(cursor) / 7, 1);
      // Small. Nodes are markers on the wiring, not the subject — oversized
      // they turn the graph back into scattered specks.
      const scale =
        (0.035 + topology.tiers[i] * 0.03) * pulse * (1 + proximity * 2.2);

      dummy.position.copy(nodePos);
      dummy.rotation.set(time * 0.2 + i, time * 0.15 + i, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    // Offset to the right and set back, so the system sits beside the writing
    // rather than behind it. Text legibility comes first.
    <group ref={groupRef} position={[3.4, 0, -2]}>
      <instancedMesh
        ref={nodesRef}
        args={[undefined, undefined, nodeCount]}
        frustumCulled={false}
      >
        {/* Octahedra, not spheres: facets catch the light differently as they
            turn, which reads as machined rather than organic. */}
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color={tokenColour("--color-accent", "#ff5c36")}
          transparent
          opacity={0.85}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[topology.edgePositions, 3]}
          />
          <bufferAttribute attach="attributes-aT" args={[topology.edgeT, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={edgeMaterialRef}
          vertexShader={edgeVertex}
          fragmentShader={edgeFragment}
          uniforms={edgeUniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </lineSegments>

      <points frustumCulled={false}>
        <bufferGeometry>
          {/* Position is unused by the shader — the packet's real location is
              interpolated from its endpoints — but three requires the
              attribute to size the draw. */}
          <bufferAttribute
            attach="attributes-position"
            args={[topology.packetStart, 3]}
          />
          <bufferAttribute
            attach="attributes-aStart"
            args={[topology.packetStart, 3]}
          />
          <bufferAttribute
            attach="attributes-aEnd"
            args={[topology.packetEnd, 3]}
          />
          <bufferAttribute
            attach="attributes-aSeed"
            args={[topology.packetSeed, 1]}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={packetMaterialRef}
          vertexShader={packetVertex}
          fragmentShader={packetFragment}
          uniforms={packetUniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}
