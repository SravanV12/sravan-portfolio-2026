import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * The one rich-text format used across the site.
 *
 * Deliberately narrow: headings below h3 would compete with the page's own
 * type scale, and images are excluded because case study bodies must not carry
 * client screenshots.
 */
export const richText = defineType({
  name: "richText",
  title: "Rich text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "Heading", value: "h3" },
      ],
      lists: [{ title: "Bullet", value: "bullet" }],
      marks: {
        decorators: [
          { title: "Bold", value: "strong" },
          { title: "Italic", value: "em" },
          { title: "Code", value: "code" },
        ],
        annotations: [
          defineArrayMember({
            name: "link",
            type: "object",
            title: "Link",
            fields: [
              defineField({
                name: "href",
                title: "URL",
                type: "url",
                validation: (rule) =>
                  rule
                    .required()
                    .uri({ scheme: ["http", "https", "mailto"] }),
              }),
            ],
          }),
        ],
      },
    }),
  ],
});
