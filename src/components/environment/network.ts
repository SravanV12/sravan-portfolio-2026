/**
 * Topology for the network scene.
 *
 * Built once, deterministically. The layout is a system diagram rather than a
 * cloud of dots: nodes sit in loose tiers along Z, and edges prefer near
 * neighbours, so the result reads as services wired together instead of
 * random confetti.
 *
 * Deterministic because `Math.random()` during render is impure, and because a
 * fixed graph is reproducible when something looks wrong.
 */

export type Topology = {
  /** Node positions, flat xyz triples. */
  nodes: Float32Array;
  /** Per-node tier, 0..1 — drives size and colour. */
  tiers: Float32Array;
  /** Per-node phase offset so pulses are not synchronised. */
  seeds: Float32Array;
  /** Edge endpoints, flat xyz pairs, ready for LineSegments. */
  edgePositions: Float32Array;
  /** Per-edge-vertex position along its edge, 0 at the start and 1 at the end. */
  edgeT: Float32Array;
  /** Packet start points, one per packet. */
  packetStart: Float32Array;
  packetEnd: Float32Array;
  packetSeed: Float32Array;
  edgeCount: number;
};

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

export function buildTopology(nodeCount: number, linksPerNode = 2): Topology {
  const random = makeRandom(0x51573a);
  const nodes = new Float32Array(nodeCount * 3);
  const tiers = new Float32Array(nodeCount);
  const seeds = new Float32Array(nodeCount);

  // Loose tiers along Z: a front rank, a middle, and a distant one. Real
  // architecture diagrams have layers, and the depth is what makes the camera
  // move feel like it is moving through something.
  for (let i = 0; i < nodeCount; i++) {
    const tier = Math.floor(random() * 3);
    // Clustered, not spread across the whole frame. Scattering nodes evenly
    // reads as confetti; a tighter cloud reads as one system with a shape.
    const spreadX = 7 + tier * 2.5;
    const spreadY = 5 + tier * 1.5;

    nodes[i * 3] = (random() - 0.5) * spreadX;
    nodes[i * 3 + 1] = (random() - 0.5) * spreadY;
    nodes[i * 3 + 2] = -4 - tier * 4 - random() * 2.5;

    tiers[i] = tier / 2;
    seeds[i] = random();
  }

  // Connect each node to its nearest neighbours, skipping pairs already
  // joined. Nearest-neighbour wiring is what gives the graph structure — a
  // random pairing looks like string, not a system.
  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodeCount; i++) {
    const distances: Array<{ index: number; d: number }> = [];
    for (let j = 0; j < nodeCount; j++) {
      if (i === j) continue;
      const dx = nodes[i * 3] - nodes[j * 3];
      const dy = nodes[i * 3 + 1] - nodes[j * 3 + 1];
      const dz = nodes[i * 3 + 2] - nodes[j * 3 + 2];
      distances.push({ index: j, d: dx * dx + dy * dy + dz * dz });
    }
    distances.sort((a, b) => a.d - b.d);

    for (let k = 0; k < linksPerNode && k < distances.length; k++) {
      const j = distances[k].index;
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([i, j]);
    }
  }

  const edgeCount = pairs.length;
  const edgePositions = new Float32Array(edgeCount * 6);
  const edgeT = new Float32Array(edgeCount * 2);
  const packetStart = new Float32Array(edgeCount * 3);
  const packetEnd = new Float32Array(edgeCount * 3);
  const packetSeed = new Float32Array(edgeCount);

  pairs.forEach(([a, b], e) => {
    for (let axis = 0; axis < 3; axis++) {
      edgePositions[e * 6 + axis] = nodes[a * 3 + axis];
      edgePositions[e * 6 + 3 + axis] = nodes[b * 3 + axis];
      packetStart[e * 3 + axis] = nodes[a * 3 + axis];
      packetEnd[e * 3 + axis] = nodes[b * 3 + axis];
    }
    edgeT[e * 2] = 0;
    edgeT[e * 2 + 1] = 1;
    packetSeed[e] = random();
  });

  return {
    nodes,
    tiers,
    seeds,
    edgePositions,
    edgeT,
    packetStart,
    packetEnd,
    packetSeed,
    edgeCount,
  };
}
