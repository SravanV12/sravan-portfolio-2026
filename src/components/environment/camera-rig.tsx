"use client";

import { useFrame } from "@react-three/fiber";
import { scrollState } from "@/lib/scroll-state";

/**
 * Moves the camera, which is what turns a set of layers into a place.
 *
 * Three inputs, all small:
 *   - scroll dollies the camera forward and lifts it, so descending the page
 *     is descending through the scene
 *   - the pointer shifts it laterally, giving true parallax between the near
 *     motes, the form and the far field
 *   - scroll speed adds a touch of roll, so fast movement banks slightly
 *
 * The amounts are deliberately restrained. Camera motion is the effect most
 * likely to make a page feel seasick, and the content still has to be read.
 */
export function CameraRig() {
  // The camera comes from the frame state rather than from useThree: mutating
  // a value returned by a hook is disallowed, and the per-frame state is the
  // supported place to drive it from.
  useFrame((state, delta) => {
    const { camera } = state;
    const ease = Math.min(delta * 2.2, 1);

    const targetX = (scrollState.pointerX - 0.5) * 1.1;
    const targetY = (scrollState.pointerY - 0.5) * 0.7 + scrollState.progress * 1.6;
    const targetZ = 5 - scrollState.progress * 2.2;

    camera.position.x += (targetX - camera.position.x) * ease;
    camera.position.y += (targetY - camera.position.y) * ease;
    camera.position.z += (targetZ - camera.position.z) * ease;

    // Bank into fast scrolling, then settle.
    const targetRoll = -scrollState.velocity * 0.05;
    camera.rotation.z += (targetRoll - camera.rotation.z) * ease;

    // Always looking slightly ahead of where the reader is, rather than
    // locked dead centre.
    camera.lookAt(targetX * 0.25, targetY * 0.35 - 0.2, -8);
    camera.rotation.z += targetRoll * 0.5;
  });

  return null;
}
