"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  alwaysStacks,
  describeDiagram,
  layoutDiagram,
  neighboursOf,
} from "@/lib/architecture-layout";
import type { ArchitectureDiagram } from "@/sanity/types";

/**
 * The animated architecture diagram.
 *
 * This is what carries the case studies visually. The work is under NDA, so
 * there are no screenshots, and the system drawing has to do the job a product
 * shot would normally do.
 *
 * It is a client component, but the SVG is complete in the server-rendered
 * HTML: every box, line and label is present before any script runs, so with
 * JavaScript off the diagram is a finished static drawing rather than an empty
 * frame. Script adds three things on top — the lines draw themselves in,
 * traffic runs along them, and pointing at a box dims everything it does not
 * touch.
 */
export function ArchitectureFigure({
  diagram,
}: {
  diagram: ArchitectureDiagram;
}) {
  // `false` on the server, which is the mobile-first answer: the stacked
  // arrangement is the one that is safe to render before the width is known,
  // and it is also the one that survives with script disabled.
  const isWide = useMediaQuery("(min-width: 768px)");
  const stacked = !isWide || alwaysStacks(diagram.nodes);

  const layout = useMemo(
    () => layoutDiagram(diagram.nodes, diagram.edges, stacked),
    [diagram.nodes, diagram.edges, stacked],
  );

  const description = useMemo(() => describeDiagram(layout), [layout]);

  const ref = useRef<SVGSVGElement>(null);
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  // Markers are referenced by URL, so two diagrams on one page would otherwise
  // share — and fight over — the same definition.
  const arrowId = `${useId()}-arrow`;
  const describedById = `${useId()}-desc`;

  const highlight = useMemo(
    () => (active ? neighboursOf(layout, active) : null),
    [active, layout],
  );

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion || layout.nodes.length === 0) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    import("@/lib/gsap")
      .then(({ gsap }) => {
        if (cancelled || !ref.current) return;
        const node = ref.current;

        context = gsap.context(() => {
          const boxes = node.querySelectorAll("[data-node]");
          const edgeGroups = node.querySelectorAll("[data-edge]");
          const wires = Array.from(
            node.querySelectorAll<SVGPathElement>("[data-wire]"),
          );
          const packets = Array.from(
            node.querySelectorAll<SVGCircleElement>("[data-packet]"),
          );

          const timeline = gsap.timeline({
            scrollTrigger: { trigger: node, start: "top 75%", once: true },
          });

          // Boxes first, then the wiring between them: a system is built before
          // it is connected, and animating it in that order is what makes the
          // drawing read as assembling rather than fading in.
          //
          // The whole sequence is held to about 1.2s. Both parts stagger as one
          // tween rather than chaining per wire, which is what keeps a diagram
          // with a dozen connections the same length as one with three.
          //
          // Every one of these tweens clears the opacity it set when it
          // finishes. The hover highlight dims a group through a CSS class,
          // and an inline opacity left behind by GSAP outranks a stylesheet —
          // so without this the diagram would animate in correctly and then
          // refuse to dim for the rest of the page's life.
          timeline.fromTo(
            boxes,
            { opacity: 0, scale: 0.92, transformOrigin: "center" },
            {
              opacity: 1,
              scale: 1,
              duration: 0.45,
              ease: "back.out(1.6)",
              stagger: { each: 0.05, amount: Math.min(boxes.length * 0.05, 0.4) },
              clearProps: "opacity",
            },
          );

          for (const wire of wires) {
            const length = wire.getTotalLength();
            // Set here rather than in CSS, so a wire is only ever hidden once
            // we know we are able to draw it back in.
            gsap.set(wire, { strokeDasharray: length, strokeDashoffset: length });
          }

          // The whole edge group fades, not just the path. Arrowheads are SVG
          // markers and markers ignore stroke-dasharray, so a fully dashed-out
          // wire still paints its arrows — which left disembodied arrowheads
          // and edge labels floating over an empty diagram until it scrolled
          // into view.
          gsap.set(edgeGroups, { opacity: 0 });

          timeline.to(
            edgeGroups,
            {
              opacity: 1,
              duration: 0.35,
              ease: "none",
              stagger: { amount: Math.min(wires.length * 0.06, 0.45) },
              clearProps: "opacity",
            },
            "-=0.25",
          );

          timeline.to(
            wires,
            {
              strokeDashoffset: 0,
              duration: 0.55,
              ease: "power2.inOut",
              stagger: { amount: Math.min(wires.length * 0.06, 0.45) },
            },
            "<",
          );

          // Traffic. Each packet walks its own wire on a loop, offset so they
          // are not all in step. Positions come from the path itself, so the
          // motion follows the curve exactly however it is routed.
          packets.forEach((packet, index) => {
            const wire = wires.find(
              (candidate) => candidate.dataset.wire === packet.dataset.packet,
            );
            if (!wire) return;

            const length = wire.getTotalLength();
            const state = { t: 0 };

            timeline.to(
              state,
              {
                t: 1,
                duration: 2.6,
                ease: "none",
                repeat: -1,
                delay: index * 0.45,
                onUpdate: () => {
                  const point = wire.getPointAtLength(state.t * length);
                  packet.setAttribute("cx", String(point.x));
                  packet.setAttribute("cy", String(point.y));
                  // Fades at both ends so a packet arrives and departs rather
                  // than snapping back to the start of its wire.
                  packet.setAttribute(
                    "opacity",
                    String(Math.min(state.t, 1 - state.t, 0.12) / 0.12),
                  );
                },
              },
              // Starts as the wiring finishes: traffic on a connection that
              // does not exist yet reads as a glitch.
              ">-0.1",
            );
          });
        }, ref);
      })
      .catch(() => {
        // The static drawing is already complete and legible.
      });

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [reducedMotion, layout]);

  // A diagram can exist in the CMS with its title and alt text written but no
  // boxes placed yet. The description is the fallback rather than nothing: it
  // is what a screen reader would have received from the figure anyway.
  if (layout.nodes.length === 0) {
    return (
      <p className="text-body text-muted max-w-[68ch]">{diagram.altText}</p>
    );
  }

  return (
    <>
      <svg
        ref={ref}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={diagram.altText}
        aria-describedby={description.length ? describedById : undefined}
        className="architecture h-auto w-full"
        // A three-box diagram should not balloon to fill a wide column. Past
        // about a quarter over its natural size the labels stop looking like
        // labels and start looking like headings.
        style={{ maxWidth: layout.width * 1.25 }}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 7 4 L 0 7 z" className="fill-muted" opacity={0.75} />
          </marker>
        </defs>

        {layout.edges.map((edge) => {
          const dimmed = highlight ? !highlight.edges.has(edge.key) : false;
          return (
            <g
              key={edge.key}
              data-edge={edge.key}
              data-dim={dimmed ? "" : undefined}
            >
              <path
                data-wire={edge.key}
                d={edge.path}
                fill="none"
                className="stroke-muted"
                strokeWidth={1.5}
                strokeOpacity={0.45}
                markerEnd={`url(#${arrowId})`}
                markerStart={
                  edge.bidirectional ? `url(#${arrowId})` : undefined
                }
              />
              {/* Parked at the origin until script moves it, and carrying
                  opacity 0 so it is invisible with JavaScript off. */}
              <circle
                data-packet={edge.key}
                r={3}
                cx={0}
                cy={0}
                opacity={0}
                className="fill-accent"
              />
              {edge.label ? (
                <g>
                  {/* A plate in the page ground, so a label crossing a wire
                      stays readable instead of being struck through by it. */}
                  <rect
                    x={edge.labelX - edge.label.length * 3.7 - 5}
                    y={edge.labelY - 21}
                    width={edge.label.length * 7.4 + 10}
                    height={18}
                    rx={2}
                    className="fill-bg"
                  />
                  <text
                    x={edge.labelX}
                    y={edge.labelY - 8}
                    textAnchor="middle"
                    className="fill-muted"
                    fontSize={13}
                  >
                    {edge.label}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {layout.nodes.map((node) => {
          const dimmed = highlight ? !highlight.nodes.has(node.id) : false;
          return (
            <g
              key={node.key}
              data-node={node.id}
              data-dim={dimmed ? "" : undefined}
              data-on={active === node.id ? "" : undefined}
              onPointerEnter={() => setActive(node.id)}
            >
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={4}
                className="fill-surface stroke-line"
                strokeWidth={1}
              />
              <text
                x={node.x + node.width / 2}
                y={node.y + (node.sublabel ? 32 : 44)}
                textAnchor="middle"
                className="fill-fg"
                fontSize={16}
                fontWeight={500}
              >
                {node.label}
              </text>
              {node.sublabel ? (
                <text
                  x={node.x + node.width / 2}
                  y={node.y + 53}
                  textAnchor="middle"
                  className="fill-muted"
                  fontSize={13}
                >
                  {node.sublabel}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/*
        What is connected to what, in prose. The aria-label says what the system
        is; this says how it is wired, which is the part the picture carries and
        a one-line summary does not.
      */}
      {description.length ? (
        <p id={describedById} className="sr-only">
          {description.join(" ")}
        </p>
      ) : null}
    </>
  );
}
