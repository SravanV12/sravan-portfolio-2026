import { defineArrayMember, defineField, defineType } from "sanity";

/** A named group of skills, e.g. "Front end" → React, TypeScript, … */
export const skillGroup = defineType({
  name: "skillGroup",
  title: "Skill group",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { title: "label", items: "items" },
    prepare({ title, items }) {
      const list: string[] = items ?? [];
      return { title, subtitle: list.join(", ") };
    },
  },
});

/** One titled block of a case study narrative. */
export const caseStudySection = defineType({
  name: "caseStudySection",
  title: "Section",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Usually Context, Problem, Approach or Outcome.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "richText",
    }),
  ],
  preview: {
    select: { title: "heading", body: "body" },
    prepare({ title, body }) {
      const blocks: unknown[] = body ?? [];
      return {
        title,
        subtitle: blocks.length ? `${blocks.length} block(s)` : "Empty",
      };
    },
  },
});

/** A platform a project shipped on, used by the pinned section. */
export const platform = defineType({
  name: "platform",
  title: "Platform",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "description" },
  },
});

/** A box in an architecture diagram. Position is a grid cell, not pixels. */
export const diagramNode = defineType({
  name: "diagramNode",
  title: "Node",
  type: "object",
  fields: [
    defineField({
      name: "id",
      title: "ID",
      type: "string",
      description: "Short and unique within this diagram. Edges refer to it.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sublabel",
      title: "Sublabel",
      type: "string",
    }),
    defineField({
      name: "column",
      title: "Column",
      type: "number",
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "row",
      title: "Row",
      type: "number",
      validation: (rule) => rule.required().integer().min(0),
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "sublabel", id: "id" },
    prepare({ title, subtitle, id }) {
      return { title: `${title} (${id})`, subtitle };
    },
  },
});

/** A connection between two nodes. */
export const diagramEdge = defineType({
  name: "diagramEdge",
  title: "Edge",
  type: "object",
  fields: [
    defineField({
      name: "from",
      title: "From node ID",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "to",
      title: "To node ID",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
    }),
    defineField({
      name: "bidirectional",
      title: "Bidirectional",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: { from: "from", to: "to", label: "label", both: "bidirectional" },
    prepare({ from, to, label, both }) {
      return { title: `${from} ${both ? "<->" : "->"} ${to}`, subtitle: label };
    },
  },
});
