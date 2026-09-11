"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  type BufferAttribute,
  type BufferGeometry,
  Color,
  type LineSegments,
  type ShaderMaterial,
  Vector3,
} from "three";
import type { Topology } from "@/components/environment/network";
import { scrollState } from "@/lib/scroll-state";

/**
 * Connections reaching from the pointer to whichever services are nearest.
 *
 * The graph already swells the nodes near the cursor. This goes a step further
 * and wires the cursor into the system: the reader is not looking at the
 * topology, they are a temporary node in it. It is the one part of the scene
 * that responds to where the pointer *is* rather than to how it is moving, and
 * that difference is what makes it feel like a response rather than an effect.
 *
 * Rendered inside the graph's own group, so it inherits the same transform and
 * the lines land on the nodes exactly wherever the system has been moved to.
 *
 * The geometry is a fixed, small number of segments, rewritten in place every
 * frame. Nothing is allocated and nothing is re-created — the same buffer is
 * uploaded with new numbers in it.
 */

const vertexShader = /* glsl */ `
  attribute float aAlpha;

  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uAccent;

  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.002) discard;
    gl_FragColor = vec4(uAccent, vAlpha);
  }
`;

function tokenColour(name: string, fallback: string) {
  if (typeof window === "undefined") return new Color(fallback);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

/** How many services the pointer may be wired to at once. */
const LINKS = 5;

/** Beyond this, in graph units, a node is too far to be worth reaching for. */
const RANGE = 7.5;

/**
 * How far down the pointer ray the reader is taken to be pointing, in world
 * units from the lens. Roughly the middle of the graph, so the links land on
 * the nodes nearest to what is under the cursor on screen.
 */
const REACH = 13;

export function PointerProbe({ topology }: { topology: Topology }) {
  const geometryRef = useRef<BufferGeometry>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const objectRef = useRef<LineSegments>(null);

  // The initial contents of the two buffers. Two vertices per link: one at the
  // cursor, one at the node.
  //
  // These are handed to Three once and never touched again from here. The
  // per-frame writes go through the geometry's own attributes instead, which is
  // both the documented way to animate a BufferAttribute and the honest one —
  // after construction the buffer belongs to the geometry, not to this
  // component, and React is right to refuse mutation of a value a hook returned.
  const initial = useMemo(
    () => ({
      positions: new Float32Array(LINKS * 2 * 3),
      alphas: new Float32Array(LINKS * 2),
    }),
    [],
  );

  // Scratch for the nearest-node search. A ref, because it is rewritten every
  // frame and never read during render.
  const nearest = useRef(
    Array.from({ length: LINKS }, () => ({ index: -1, distance: Infinity })),
  );

  const cursor = useRef({ x: 0, y: 0, z: -6 });
  // Scratch for the unprojection, so the per-frame conversion allocates nothing.
  const point = useMemo(() => new Vector3(), []);

  const uniforms = useMemo(
    () => ({ uAccent: { value: tokenColour("--color-accent", "#ff5c36") } }),
    [],
  );

  useFrame((state, delta) => {
    const geometry = geometryRef.current;
    const object = objectRef.current;
    if (!geometry || !object) return;

    const positionAttribute = geometry.getAttribute(
      "position",
    ) as BufferAttribute;
    const alphaAttribute = geometry.getAttribute("aAlpha") as BufferAttribute;
    if (!positionAttribute || !alphaAttribute) return;

    const positions = positionAttribute.array as Float32Array;
    const alphas = alphaAttribute.array as Float32Array;
    const slots = nearest.current;

    // Where the reader is actually pointing, in this graph own space.
    //
    // Both conversions matter. Unprojecting rather than scaling the pointer by
    // hand keeps the links under the cursor however the camera rig has moved
    // and banked; converting into the group space is what fixes the links
    // appearing to radiate from a point well to the side of the cursor, since
    // the graph is offset several units across and rotates as the page
    // descends, and a cursor computed in its local frame inherits all of that.
    const { camera } = state;
    point
      .set(scrollState.pointerX * 2 - 1, scrollState.pointerY * 2 - 1, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize()
      .multiplyScalar(REACH)
      .add(camera.position);

    const parent = object.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(point);
    }

    const ease = Math.min(delta * 6, 1);
    // Eased towards the pointer rather than snapping to it, so the lines trail
    // slightly behind a fast movement instead of teleporting.
    cursor.current.x += (point.x - cursor.current.x) * ease;
    cursor.current.y += (point.y - cursor.current.y) * ease;
    cursor.current.z += (point.z - cursor.current.z) * ease;

    const nodeCount = topology.seeds.length;

    for (const slot of slots) {
      slot.index = -1;
      slot.distance = Infinity;
    }

    // A partial selection rather than a sort: only the few nearest matter, and
    // sorting every node each frame to find five of them would be the most
    // expensive thing in the scene.
    for (let i = 0; i < nodeCount; i++) {
      const dx = topology.nodes[i * 3] - cursor.current.x;
      const dy = topology.nodes[i * 3 + 1] - cursor.current.y;
      const dz = topology.nodes[i * 3 + 2] - cursor.current.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance > RANGE * RANGE) continue;

      for (let slot = 0; slot < LINKS; slot++) {
        if (distance >= slots[slot].distance) continue;
        // Shuffle the rest down; the list is five long, so this is cheaper
        // than any structure that would avoid it.
        for (let back = LINKS - 1; back > slot; back--) {
          slots[back].index = slots[back - 1].index;
          slots[back].distance = slots[back - 1].distance;
        }
        slots[slot].index = i;
        slots[slot].distance = distance;
        break;
      }
    }

    for (let link = 0; link < LINKS; link++) {
      const { index, distance } = slots[link];
      const head = link * 6;
      const alphaHead = link * 2;

      if (index < 0) {
        alphas[alphaHead] = 0;
        alphas[alphaHead + 1] = 0;
        continue;
      }

      positions[head] = cursor.current.x;
      positions[head + 1] = cursor.current.y;
      positions[head + 2] = cursor.current.z;
      positions[head + 3] = topology.nodes[index * 3];
      positions[head + 4] = topology.nodes[index * 3 + 1];
      positions[head + 5] = topology.nodes[index * 3 + 2];

      // Fades out as the node approaches the edge of range, so links appear
      // and disappear gradually instead of blinking on.
      const reach = 1 - Math.sqrt(distance) / RANGE;
      const strength = Math.max(reach, 0) ** 1.5 * 0.55;

      // Brightest at the cursor, dimmest at the node: the line reads as
      // coming *from* the reader.
      alphas[alphaHead] = strength;
      alphas[alphaHead + 1] = strength * 0.25;
    }

    positionAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
  });

  return (
    <lineSegments ref={objectRef} frustumCulled={false} renderOrder={2}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[initial.positions, 3]}
        />
        <bufferAttribute attach="attributes-aAlpha" args={[initial.alphas, 1]} />
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
    </lineSegments>
  );
}
