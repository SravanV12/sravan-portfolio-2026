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
import { PointerProbe } from "@/components/environment/pointer-probe";
import { scrollState } from "@/lib/scroll-state";

/**
 * A distributed system, running.
 *
 * Nodes are services. The lines between them are connections. The bright motes
 * travelling those lines are messages in flight.
 *
 * Three things drive it:
 *   - scroll turns the graph and pushes traffic faster
 *   - the pointer leans it, and swells whichever nodes are nearest
 *   - pointing at a case study lights that cluster and floods it with traffic
 *
 * The last one is what matters: the background answers the content rather than
 * running beside it. Sync engines, microservices and retrieval pipelines are
 * what the case studies describe, so the environment says the same thing the
 * writing does.
 *
 * Cost is bounded deliberately. Nodes are one instanced draw call, edges one
 * LineSegments, packets one Points — three draw calls for the whole system,
 * with packet motion computed on the GPU from a per-packet seed so nothing is
 * animated on the main thread.
 */

const edgeVertex = /* glsl */ `
  attribute float aT;
  attribute float aOrder;
  attribute float aCluster;

  uniform float uBoot;
  uniform float uFocus;
  uniform float uRipple;
  uniform float uShock;

  varying float vFade;
  varying float vHot;
  varying float vRipple;

  void main() {
    // Boot: connections are drawn in sequence rather than appearing at once,
    // so arriving on the page reads as a system coming online.
    vFade = smoothstep(aOrder - 0.12, aOrder + 0.02, uBoot);
    vHot = (uFocus >= 0.0 && abs(aCluster - uFocus) < 0.5) ? 1.0 : 0.0;

    // A band of brightness sweeping the same order the boot used. Driven once
    // per section change, so moving through the page re-traces the wiring
    // instead of just sliding it sideways.
    vRipple = uRipple < 0.0
      ? 0.0
      : (1.0 - smoothstep(0.0, 0.16, abs(aOrder - uRipple)));

    // A press ripples outward from the middle of the system: the wires stretch
    // a little before settling, which is what makes the graph feel like a
    // physical thing rather than a picture of one.
    vec3 pos = position + normalize(position + 1e-4) * uShock * 0.28;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const edgeFragment = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uFg;
  uniform float uScroll;
  uniform float uEnergy;
  uniform float uShock;

  varying float vFade;
  varying float vHot;
  varying float vRipple;

  void main() {
    // The wiring carries the structure; the nodes just mark it.
    vec3 colour = mix(uFg, uAccent, 0.45 + vHot * 0.4 - vRipple * 0.3);
    float alpha = (0.30 + uScroll * 0.10 + vHot * uEnergy * 0.40
                 + vRipple * 0.5 + uShock * 0.25) * vFade;
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;

const packetVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aSeed;
  attribute float aCluster;

  uniform float uTime;
  uniform float uVelocity;
  uniform float uSize;
  uniform float uBoot;
  uniform float uFocus;
  uniform float uEnergy;
  uniform float uShock;

  varying float vFade;
  varying float vHot;

  void main() {
    float hot = (uFocus >= 0.0 && abs(aCluster - uFocus) < 0.5) ? 1.0 : 0.0;
    vHot = hot;

    // Position along the wire, entirely GPU-side: no per-frame CPU work for
    // any number of packets. A focused cluster runs markedly faster, which is
    // what makes pointing at a row feel like putting load through that service.
    float speed = 0.12 + aSeed * 0.10 + uVelocity * 0.55 + hot * uEnergy * 0.9
                + uShock * 0.7;
    float t = fract(uTime * speed + aSeed);

    // Ride the same outward shock the wiring does, so traffic stays on its
    // wire while the system is flexing.
    vec3 pos = mix(aStart, aEnd, t);
    pos += normalize(pos + 1e-4) * uShock * 0.28;

    // Fade in and out at the ends so packets arrive and depart rather than
    // popping into existence mid-wire. Multiplied by boot, so traffic only
    // starts once the wiring it travels on exists.
    vFade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.88, 1.0, t))
          * smoothstep(0.55, 1.0, uBoot);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Perspective size, clamped: nearer packets are bigger, but never so big
    // that a handful of them wash out the screen.
    float size = uSize * (14.0 / max(-mv.z, 1.0)) * (1.0 + hot * uEnergy * 0.8);
    gl_PointSize = clamp(size, 1.0, 7.0) * (1.0 + uVelocity);
  }
`;

const packetFragment = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uFg;

  varying float vFade;
  varying float vHot;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float falloff = smoothstep(0.25, 0.0, d);
    // Focused traffic runs hotter, towards white, so it reads as a surge.
    vec3 colour = mix(uAccent, uFg, vHot * 0.45);
    gl_FragColor = vec4(colour * falloff * vFade, falloff * vFade * 0.9);
  }
`;

/**
 * Where the system sits while each section is being read, in world units.
 *
 * Indexed by section: hero, work, about, contact. Positive X is the right of
 * the frame. The values track this page's grid — the hero and the work list
 * are left-aligned, so the system stays right of them; About and Contact put
 * only a short label in the left column, so it can cross to that side.
 */
// Work is the awkward one: its rows run the full width of the page — title on
// the left, meta on the right — so there is no horizontal space to move into.
// Depth is the only free axis there, which is why it sits so much further back
// than the rest rather than simply further across.
const SECTION_FRAMING = [
  { x: 3.6, z: -2 }, // Hero: type occupies the left half.
  { x: 5.2, z: -8.5 }, // Work: see the note above.
  { x: -4.6, z: -3.5 }, // About: body copy is in the right nine columns.
  { x: -4.4, z: -4 }, // Contact: same grid as About.
];

function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

export function NetworkScene({
  nodeCount,
  probe,
}: {
  nodeCount: number;
  /** Whether to wire the pointer into the graph. Off on the cheapest tier. */
  probe: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const nodesRef = useRef<InstancedMesh>(null);
  const edgeMaterialRef = useRef<ShaderMaterial>(null);
  const packetMaterialRef = useRef<ShaderMaterial>(null);

  const topology = useMemo(() => buildTopology(nodeCount), [nodeCount]);

  // Scratch objects, reused every frame so the loop allocates nothing.
  const dummy = useMemo(() => new Object3D(), []);
  const cursor = useMemo(() => new Vector3(), []);
  const nodePos = useMemo(() => new Vector3(), []);
  const outward = useMemo(() => new Vector3(), []);
  const boot = useRef(0);
  const energy = useRef(0);
  const focus = useRef(-1);
  // -1 when idle; otherwise 0..1, the position of the sweeping band.
  const ripple = useRef(-1);
  const lastSection = useRef(-1);
  const shock = useRef(0);

  const edgeUniforms = useMemo(
    () => ({
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uFg: { value: tokenColour("--color-fg", "#edede9") },
      uScroll: { value: 0 },
      uBoot: { value: 0 },
      uFocus: { value: -1 },
      uEnergy: { value: 0 },
      uRipple: { value: -1 },
      uShock: { value: 0 },
    }),
    [],
  );

  const packetUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVelocity: { value: 0 },
      uSize: { value: 2.4 },
      uBoot: { value: 0 },
      uFocus: { value: -1 },
      uEnergy: { value: 0 },
      uShock: { value: 0 },
      uAccent: { value: tokenColour("--color-accent", "#ff5c36") },
      uFg: { value: tokenColour("--color-fg", "#edede9") },
    }),
    [],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    const mesh = nodesRef.current;
    if (!group || !mesh) return;

    const ease = Math.min(delta * 3, 1);

    // Boot runs once, over about two and a half seconds.
    boot.current = Math.min(boot.current + delta / 2.5, 1);

    // Energy rises while a row is focused and falls back when it is released,
    // so the surge has a shape rather than switching on and off.
    const wantEnergy = scrollState.focus === null ? 0 : 1;
    energy.current += (wantEnergy - energy.current) * Math.min(delta * 4, 1);
    if (scrollState.focus !== null) focus.current = scrollState.focus;
    scrollState.energy = energy.current;

    // A press anywhere sends a wave outward, which then settles. Consumed here
    // so the flag cannot fire twice for one gesture.
    if (scrollState.impulse > 0) {
      shock.current = 1;
      scrollState.impulse = 0;
    }
    shock.current = Math.max(shock.current - delta * 1.8, 0);
    // Published so the layers added around this one — embers, camera kick,
    // grid flare — answer the same press on the same curve.
    scrollState.shock = shock.current;
    // Eased rather than linear, so the wave leaves fast and settles slowly.
    const shockEased = shock.current * shock.current;

    // Arriving in a new section re-traces the wiring in the order it was first
    // drawn. Only after boot, so the two never run over one another.
    if (boot.current >= 1 && scrollState.section !== lastSection.current) {
      lastSection.current = scrollState.section;
      ripple.current = 0;
    }
    if (ripple.current >= 0) {
      ripple.current += delta / 1.1;
      if (ripple.current > 1.2) ripple.current = -1;
    }

    if (packetMaterialRef.current) {
      const u = packetMaterialRef.current.uniforms;
      u.uTime.value += delta;
      u.uVelocity.value += (scrollState.velocity - u.uVelocity.value) * ease;
      u.uBoot.value = boot.current;
      u.uFocus.value = focus.current;
      u.uEnergy.value = energy.current;
      u.uShock.value = shockEased;
    }
    if (edgeMaterialRef.current) {
      const u = edgeMaterialRef.current.uniforms;
      u.uScroll.value += (scrollState.progress - u.uScroll.value) * ease;
      u.uBoot.value = boot.current;
      u.uFocus.value = focus.current;
      u.uEnergy.value = energy.current;
      u.uRipple.value = ripple.current;
      u.uShock.value = shockEased;
    }

    // The whole system turns slowly as the page descends, so different parts
    // of the topology face the reader at different points in the journey.
    group.rotation.y += (scrollState.progress * 0.9 - group.rotation.y) * ease;
    group.rotation.x +=
      ((scrollState.pointerY - 0.5) * 0.18 - group.rotation.x) * ease;
    group.position.y += (scrollState.progress * 5.5 - group.position.y) * ease;

    // Each section gets its own framing of the same system, so moving between
    // them reads as the view repositioning rather than the background sliding.
    //
    // The framing is a table rather than arithmetic on the section index, and
    // that is the whole point: it has to match where the text actually sits.
    // Alternating sides by parity put the graph on the left through the work
    // list, which is exactly where the case-study titles are — nodes landed on
    // top of the words. Every entry below keeps the system clear of the column
    // that section reads in, and the work list, whose rows span the full width,
    // is pushed furthest back because nothing there is safe.
    const framing = SECTION_FRAMING[
      Math.min(scrollState.section, SECTION_FRAMING.length - 1)
    ];

    // Focus pushes the system further out and lets the camera do the leaning
    // in. Moving it towards the reader instead would crowd the column at the
    // precise moment they are reading a row.
    const lean = energy.current * 0.9 * Math.sign(framing.x);

    // Eased far more slowly than the pointer response: a section change should
    // feel like a considered move, not a snap.
    const settle = Math.min(delta * 0.9, 1);
    group.position.x += (framing.x + lean - group.position.x) * settle;
    group.position.z += (framing.z - group.position.z) * settle;

    // Where the cursor is pointing, roughly, in the graph's own space.
    cursor.set(
      (scrollState.pointerX - 0.5) * 16,
      (scrollState.pointerY - 0.5) * 10,
      -6,
    );

    const time = packetMaterialRef.current?.uniforms.uTime.value ?? 0;

    for (let i = 0; i < nodeCount; i++) {
      nodePos.set(
        topology.nodes[i * 3],
        topology.nodes[i * 3 + 1],
        topology.nodes[i * 3 + 2],
      );

      const pulse =
        0.85 + Math.sin(time * 1.6 + topology.seeds[i] * 6.28) * 0.15;
      const proximity = 1 - Math.min(nodePos.distanceTo(cursor) / 7, 1);
      const hot =
        focus.current >= 0 && topology.clusters[i] === focus.current ? 1 : 0;

      // Nodes arrive in roughly the order their wiring does.
      const appear = Math.min(
        Math.max((boot.current - topology.seeds[i] * 0.5) / 0.5, 0),
        1,
      );

      // Nodes swell as the sweep passes them, using the same ordering the
      // wiring does, so the band reads as one thing crossing the system.
      const swept =
        ripple.current < 0
          ? 0
          : Math.max(1 - Math.abs(topology.seeds[i] - ripple.current) / 0.16, 0);

      const scale =
        (0.035 + topology.tiers[i] * 0.03) *
        pulse *
        // Modest next to the proximity term. A focused cluster sits over the meta
        // column in the work section, so it says "this one" by brightening its
        // wiring and traffic rather than by growing large enough to read through.
        (1 + proximity * 2.2 + hot * energy.current * 1.6 + swept * 1.4) *
        appear;

      // Ride the shockwave with the wires they sit on. The displacement is the
      // same expression the edge shader uses, so the two cannot drift apart.
      outward.copy(nodePos).normalize();
      dummy.position.copy(nodePos).addScaledVector(outward, shockEased * 0.28);
      dummy.rotation.set(time * 0.2 + i, time * 0.15 + i, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    // Starts in the hero's framing. Every later position comes from the same
    // table, so the system is never placed by two different rules.
    <group
      ref={groupRef}
      position={[SECTION_FRAMING[0].x, 0, SECTION_FRAMING[0].z]}
    >
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
          <bufferAttribute
            attach="attributes-aOrder"
            args={[topology.edgeOrder, 1]}
          />
          <bufferAttribute
            attach="attributes-aCluster"
            args={[topology.edgeCluster, 1]}
          />
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
          {/* Position is unused by the shader — a packet's real location is
              interpolated from its endpoints — but three needs the attribute
              to size the draw. */}
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
          <bufferAttribute
            attach="attributes-aCluster"
            args={[topology.packetCluster, 1]}
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

      {/* Inside the group on purpose: the probe wires the pointer into this
          topology, so it has to share the transform the topology is drawn
          with or its lines would miss the nodes they are reaching for. */}
      {probe ? <PointerProbe topology={topology} /> : null}
    </group>
  );
}
