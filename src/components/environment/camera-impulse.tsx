"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { scrollState } from "@/lib/scroll-state";

/**
 * Handheld feel, layered on top of the camera rig rather than replacing it.
 *
 * Two additions. A slow, irregular drift so the lens is never perfectly still —
 * a locked-off camera is the thing that most reliably makes a 3D scene read as
 * a screensaver. And a kick when the reader presses, so the frame itself
 * reacts, not only the things inside it.
 *
 * This must be mounted *after* `CameraRig` in the tree. Frame callbacks at the
 * same priority run in registration order, so the rig positions the camera and
 * aims it, and this adds to the result afterwards. Rotation is the right place
 * to add: the rig finishes with `lookAt`, which overwrites the whole rotation,
 * so anything written before it would be discarded — and nudging position
 * instead would be eased away by the rig on the following frame, because the
 * rig treats wherever the camera is as the value to ease from.
 *
 * Deliberately small. Camera shake is the effect most likely to make a page
 * unpleasant to read, and the content still has to be legible while it runs.
 */
export function CameraImpulse() {
  const time = useRef(0);

  useFrame((state, delta) => {
    const { camera } = state;
    time.current += delta;
    const t = time.current;

    // Squared, so the kick leaves hard and settles soft — the same shaping the
    // graph's shockwave uses, so the two land as one event.
    const kick = scrollState.shock * scrollState.shock;

    // Incommensurate frequencies, so the drift never visibly repeats.
    const driftX = Math.sin(t * 0.21) * 0.0016 + Math.sin(t * 0.53) * 0.0009;
    const driftY = Math.cos(t * 0.17) * 0.0014 + Math.cos(t * 0.47) * 0.0007;

    // The shake is fast where the drift is slow, so they never read as the
    // same motion at different amplitudes.
    camera.rotation.x += driftY + Math.sin(t * 38) * kick * 0.006;
    camera.rotation.y += driftX + Math.cos(t * 31) * kick * 0.006;
    camera.rotation.z += Math.sin(t * 26) * kick * 0.004;
  });

  return null;
}
