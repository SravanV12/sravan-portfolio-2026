/**
 * Shared scroll, pointer and interaction state, read every frame by the WebGL
 * layer.
 *
 * A plain mutable object rather than React state on purpose: this updates on
 * every scroll frame, and putting it through React would re-render the tree
 * sixty times a second to move a background.
 */
export const scrollState = {
  /** 0 at the top of the document, 1 at the bottom. */
  progress: 0,
  /** Recent scroll speed, normalised and smoothed. Drives motion-blur-ish drift. */
  velocity: 0,
  /** Pointer position in 0..1, defaulting to the centre so it starts calm. */
  pointerX: 0.5,
  pointerY: 0.5,
  /** Index of the section currently filling most of the viewport. */
  section: 0,
  /**
   * Which case study the reader is pointing at, or null.
   *
   * This is what ties the content to the environment: hovering a row lights up
   * a cluster of the graph and pushes traffic through it, so the background is
   * responding to the work rather than running beside it.
   */
  focus: null as number | null,
  /** 0..1, rises while something is focused. Smoothed on the GPU side. */
  energy: 0,
  /**
   * Set to 1 when the reader presses anywhere on the page, then decayed by the
   * scene. Drives a shockwave through the graph, so a click is answered by the
   * environment even when it lands on something that does nothing else.
   */
  impulse: 0,
  /**
   * The live shockwave, 1 at the moment of a press and decaying to 0.
   *
   * Published by the graph, which owns the decay, and read by the layers that
   * answer the same press — the embers, the camera kick, the grid flare. One
   * value driving all of them is what makes a click read as a single event
   * rather than as several effects that happen to fire together.
   */
  shock: 0,
};

export type ScrollState = typeof scrollState;
