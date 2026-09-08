import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Diagrams are data, not hand-drawn SVG, so labels stay editable and the
 * rendered figure can be described to a screen reader.
 */
export const architectureDiagram = defineType({
  name: "architectureDiagram",
  title: "Architecture diagram",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "altText",
      title: "Alt text",
      type: "text",
      rows: 3,
      description:
        "Describes the diagram for someone who cannot see it. Required.",
      validation: (rule) => rule.required().min(20),
    }),
    defineField({
      name: "nodes",
      title: "Nodes",
      type: "array",
      of: [defineArrayMember({ type: "diagramNode" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "edges",
      title: "Edges",
      type: "array",
      of: [defineArrayMember({ type: "diagramEdge" })],
    }),
  ],
  preview: {
    select: { title: "title", nodes: "nodes" },
    prepare({ title, nodes }) {
      const list: unknown[] = nodes ?? [];
      return { title, subtitle: `${list.length} node(s)` };
    },
  },
});
