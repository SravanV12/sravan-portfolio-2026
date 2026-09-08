import { defineArrayMember, defineField, defineType } from "sanity";

export const caseStudy = defineType({
  name: "caseStudy",
  title: "Case study",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "client",
      title: "Client",
      type: "string",
      description: "Optional. Leave empty where the engagement is private.",
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "timeframe",
      title: "Timeframe",
      type: "string",
      description: 'For example "Mar 2025 – Present".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      description: "Lower numbers come first on the index.",
      validation: (rule) => rule.required().integer(),
    }),
    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
      rows: 3,
      description: "Shown on the index card. Maximum 200 characters.",
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: "stack",
      title: "Stack",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "array",
      of: [defineArrayMember({ type: "caseStudySection" })],
      description: "The written narrative. Context, Problem, Approach, Outcome.",
    }),
    defineField({
      name: "diagram",
      title: "Architecture diagram",
      type: "reference",
      to: [{ type: "architectureDiagram" }],
    }),
    defineField({
      name: "showPlatformSection",
      title: "Show platform section",
      type: "boolean",
      description: "Drives the pinned platforms sequence on the case study.",
      initialValue: false,
    }),
    defineField({
      name: "platforms",
      title: "Platforms",
      type: "array",
      of: [defineArrayMember({ type: "platform" })],
      hidden: ({ document }) => !document?.showPlatformSection,
      validation: (rule) =>
        rule.custom((platforms, context) => {
          const show = context.document?.showPlatformSection;
          const list = (platforms ?? []) as unknown[];
          if (show && list.length === 0) {
            return "Add at least one platform, or turn the section off.";
          }
          return true;
        }),
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "displayOrder",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "timeframe", order: "order" },
    prepare({ title, subtitle, order }) {
      return { title: `${order ?? "–"}. ${title}`, subtitle };
    },
  },
});
