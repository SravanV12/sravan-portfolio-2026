import type { DiagramEdge, DiagramNode } from "@/sanity/types";

/**
 * Turns the CMS's grid coordinates into SVG geometry.
 *
 * Kept apart from the component on purpose. The editor positions a node by
 * column and row — never in pixels — so all the arithmetic that turns those
 * into a drawing lives in one place, and the component is left to do nothing
 * but render what it is handed.
 *
 * There are two arrangements of the same diagram, not one drawing that shrinks.
 * A diagram has a size below which its labels stop being readable, and an SVG
 * scaled to fit a phone crosses that line immediately — so on a narrow screen
 * the same nodes are re-laid-out into a single column and the edges are
 * recomputed to match. Nothing is clipped and nothing is scrolled sideways.
 */

/** Cell and box sizes, in user units of the SVG's own coordinate space. */
const COL_WIDTH = 245;
const ROW_HEIGHT = 130;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 76;
const PADDING = 16;

/**
 * Stacked diagrams are laid out in a much wider box for the same one column.
 *
 * The SVG scales to whatever width it is given, so the ratio between the
 * viewBox and the node is what sets the rendered text size. A narrow viewBox
 * stretched across a phone would magnify a 16-unit label into a 28px one.
 */
const STACK_NODE_WIDTH = 320;
const STACK_ROW_HEIGHT = 124;

/**
 * The widest a diagram may be and still be drawn in its authored grid.
 *
 * Three, and the number is forced rather than chosen. The column pitch has to
 * leave a gap wide enough for an edge label to sit in without running under
 * the next box; that pitch times four columns is wider than the column the
 * figure lives in, so the SVG would scale down far enough to put the sublabels
 * under the 12px floor. A wider diagram stacks on every screen instead of
 * rendering at a size nobody can read.
 */
const MAX_INLINE_COLUMNS = 3;

export type LaidOutNode = {
  key: string;
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LaidOutEdge = {
  key: string;
  from: string;
  to: string;
  label?: string;
  bidirectional: boolean;
  /** The curve, as an SVG path `d` attribute. */
  path: string;
  /** Where an edge label sits, if there is one. */
  labelX: number;
  labelY: number;
};

export type Layout = {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
  stacked: boolean;
};

/**
 * Where a connection leaves or meets a box.
 *
 * Edges attach to whichever side actually faces the other node, so a
 * left-to-right flow leaves the right edge and a stacked pair joins top to
 * bottom. Picking a fixed side instead is what makes a diagram look like the
 * lines are passing through the boxes.
 */
function anchor(node: LaidOutNode, towards: LaidOutNode) {
  const dx = towards.x - node.x;
  const dy = towards.y - node.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { x: node.x + node.width, y: node.y + node.height / 2, out: 1, vertical: false }
      : { x: node.x, y: node.y + node.height / 2, out: -1, vertical: false };
  }

  return dy > 0
    ? { x: node.x + node.width / 2, y: node.y + node.height, out: 1, vertical: true }
    : { x: node.x + node.width / 2, y: node.y, out: -1, vertical: true };
}

/** Whether this diagram must stack regardless of how wide the screen is. */
export function alwaysStacks(rawNodes: DiagramNode[] = []) {
  const columns = new Set(rawNodes.map((node) => node.column ?? 0));
  return columns.size > MAX_INLINE_COLUMNS;
}

export function layoutDiagram(
  rawNodes: DiagramNode[] = [],
  rawEdges: DiagramEdge[] = [],
  stacked = false,
): Layout {
  const usable = rawNodes.filter((node) => node.id && node.label);

  // Stacking follows the authored grid in reading order — down each row, then
  // across — so the sequence a reader sees is the one the editor laid out.
  const ordered = stacked
    ? [...usable].sort(
        (a, b) =>
          (a.row ?? 0) - (b.row ?? 0) || (a.column ?? 0) - (b.column ?? 0),
      )
    : usable;

  const nodes: LaidOutNode[] = ordered.map((node, index) => ({
    key: node._key,
    id: node.id as string,
    label: node.label as string,
    sublabel: node.sublabel,
    x: stacked ? PADDING : PADDING + (node.column ?? 0) * COL_WIDTH,
    y: stacked
      ? PADDING + index * STACK_ROW_HEIGHT
      : PADDING + (node.row ?? 0) * ROW_HEIGHT,
    width: stacked ? STACK_NODE_WIDTH : NODE_WIDTH,
    height: NODE_HEIGHT,
  }));

  const byId = new Map(nodes.map((node) => [node.id, node]));

  const edges: LaidOutEdge[] = [];
  for (const edge of rawEdges) {
    const from = edge.from ? byId.get(edge.from) : undefined;
    const to = edge.to ? byId.get(edge.to) : undefined;
    // An edge naming a node that is not in the diagram is an editing mistake.
    // Dropping it silently is right: half a line pointing at nothing is worse
    // than a missing line, and the text alternative still describes the system.
    if (!from || !to || from === to) continue;

    const a = anchor(from, to);
    const b = anchor(to, from);

    // Control points pushed out along whichever axis the connection leaves on,
    // so the curve departs perpendicular to the box and reads as routed rather
    // than as a straight line between two corners.
    const reach = a.vertical
      ? Math.abs(b.y - a.y) * 0.45
      : Math.abs(b.x - a.x) * 0.45;
    const span = Math.max(reach, 28);

    const c1x = a.vertical ? a.x : a.x + a.out * span;
    const c1y = a.vertical ? a.y + a.out * span : a.y;
    const c2x = b.vertical ? b.x : b.x + b.out * span;
    const c2y = b.vertical ? b.y + b.out * span : b.y;

    edges.push({
      key: edge._key,
      from: from.id,
      to: to.id,
      label: edge.label,
      bidirectional: Boolean(edge.bidirectional),
      path: `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`,
      // The midpoint of a cubic with these control points, which is close
      // enough to the visual middle of the curve for a label.
      labelX: (a.x + 3 * c1x + 3 * c2x + b.x) / 8,
      labelY: (a.y + 3 * c1y + 3 * c2y + b.y) / 8,
    });
  }

  const width = nodes.length
    ? Math.max(...nodes.map((n) => n.x + n.width)) + PADDING
    : 0;
  const height = nodes.length
    ? Math.max(...nodes.map((n) => n.y + n.height)) + PADDING
    : 0;

  return { nodes, edges, width, height, stacked };
}

/** Which nodes and edges a given node touches, for the hover highlight. */
export function neighboursOf(layout: Layout, id: string) {
  const nodes = new Set<string>([id]);
  const edges = new Set<string>();

  for (const edge of layout.edges) {
    if (edge.from === id || edge.to === id) {
      edges.add(edge.key);
      nodes.add(edge.from);
      nodes.add(edge.to);
    }
  }

  return { nodes, edges };
}

/**
 * The diagram in words, for the visually-hidden description.
 *
 * Built from the same data the drawing uses so the two cannot disagree. The
 * editor's own alt text says what the system *is*; this says what is connected
 * to what, which is the part a picture carries and a sentence usually does not.
 */
export function describeDiagram(layout: Layout) {
  const names = new Map(layout.nodes.map((node) => [node.id, node.label]));

  return layout.edges.map((edge) => {
    const from = names.get(edge.from) ?? edge.from;
    const to = names.get(edge.to) ?? edge.to;
    const link = edge.bidirectional ? "is connected both ways to" : "connects to";
    return edge.label
      ? `${from} ${link} ${to} — ${edge.label}.`
      : `${from} ${link} ${to}.`;
  });
}
