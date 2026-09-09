import type { ReactNode } from "react";
import type {
  PortableTextBlock,
  PortableTextMarkDef,
  PortableTextSpan,
} from "@/sanity/types";

/**
 * Renders the CMS rich text on the server, so the prose is in the HTML before
 * any JavaScript runs.
 *
 * Written by hand rather than pulling in @portabletext/react: the schema
 * allows exactly one heading level, bold, italic, inline code, links and
 * bullet lists, which is little enough to render directly. If the schema grows
 * — nested lists, images, custom blocks — swap this for the library instead of
 * growing it.
 */

type Props = {
  value?: PortableTextBlock[];
  className?: string;
};

function renderSpan(
  span: PortableTextSpan,
  markDefs: PortableTextMarkDef[],
): ReactNode {
  let node: ReactNode = span.text ?? "";

  for (const mark of span.marks ?? []) {
    if (mark === "strong") {
      node = <strong className="font-semibold">{node}</strong>;
    } else if (mark === "em") {
      node = <em>{node}</em>;
    } else if (mark === "code") {
      node = (
        <code className="font-mono text-mono bg-surface border-line rounded border px-1 py-0.5">
          {node}
        </code>
      );
    } else {
      // Anything else is an annotation, resolved against markDefs.
      const def = markDefs.find((d) => d._key === mark);
      if (def?._type === "link" && def.href) {
        const external = /^https?:\/\//.test(def.href);
        node = (
          <a
            href={def.href}
            className="text-accent underline underline-offset-4"
            {...(external
              ? { rel: "noreferrer", target: "_blank" }
              : {})}
          >
            {node}
          </a>
        );
      }
    }
  }

  return node;
}

function blockChildren(block: PortableTextBlock): ReactNode[] {
  const markDefs = block.markDefs ?? [];
  return (block.children ?? []).map((span) => (
    <span key={span._key}>{renderSpan(span, markDefs)}</span>
  ));
}

export function PortableText({ value, className }: Props) {
  if (!value?.length) return null;

  // Group consecutive bullet items so they render inside one <ul>.
  const groups: Array<PortableTextBlock | PortableTextBlock[]> = [];
  for (const block of value) {
    if (block.listItem === "bullet") {
      const last = groups[groups.length - 1];
      if (Array.isArray(last)) {
        last.push(block);
      } else {
        groups.push([block]);
      }
    } else {
      groups.push(block);
    }
  }

  return (
    <div className={className}>
      {groups.map((group) => {
        if (Array.isArray(group)) {
          return (
            <ul
              key={group[0]._key}
              className="text-body marker:text-muted mt-6 list-disc space-y-3 pl-6"
            >
              {group.map((item) => (
                <li key={item._key}>{blockChildren(item)}</li>
              ))}
            </ul>
          );
        }

        if (group.style === "h3") {
          return (
            <h3 key={group._key} className="text-h3 mt-12 first:mt-0">
              {blockChildren(group)}
            </h3>
          );
        }

        return (
          <p key={group._key} className="text-body mt-6 first:mt-0">
            {blockChildren(group)}
          </p>
        );
      })}
    </div>
  );
}
