/**
 * Shared scroll and pointer state, read every frame by the WebGL layer.
 *
 * A plain mutable object rather than React state on purpose: this updates on
 * every scroll frame, and putting it through React would re-render the tree
 * sixty times a second to move a background.
 */
export const scrollState = {
  /** 0 at the top of the document, 1 at the bottom. */
  progress: 0,
  /** Recent scroll speed, normalised and smoothed. Drives motion blur-ish drift. */
  velocity: 0,
  /** Pointer position in 0..1, defaulting to the centre so it starts calm. */
  pointerX: 0.5,
  pointerY: 0.5,
  /** Index of the section currently filling most of the viewport. */
  section: 0,
};

export type ScrollState = typeof scrollState;
