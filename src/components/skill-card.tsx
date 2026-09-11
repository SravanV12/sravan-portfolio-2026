"use client";

import { useRef } from "react";
import { useTilt } from "@/hooks/useTilt";
import type { SkillGroup } from "@/sanity/types";

/**
 * One group of skills, tilting towards the pointer.
 *
 * Uses the same tilt hook as the work rows, at a smaller amplitude: these are
 * supporting detail rather than a primary target, and matching the rows exactly
 * would give them more presence than they have earned. Sharing the hook is what
 * keeps the two reading as the same system rather than two effects that happen
 * to look similar.
 */
export function SkillCard({ group }: { group: SkillGroup }) {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref, { maxY: 5, maxX: 3, lift: 10 });

  return (
    <div ref={ref} className="skill-card">
      <dt className="text-mono text-muted uppercase">{group.label}</dt>
      <dd className="text-body mt-4">{group.items?.join(", ")}</dd>
    </div>
  );
}
