import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Singleton. The site's identity and contact details.
 * Creation and deletion are disabled in sanity.config.ts.
 */
export const profile = defineType({
  name: "profile",
  title: "Profile",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "headline",
      title: "Headline",
      type: "string",
      description: "One line. Appears under the name in the hero.",
      validation: (rule) => rule.required().max(90),
    }),
    defineField({
      name: "intro",
      title: "Intro",
      type: "richText",
      description: "The About section.",
    }),
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      validation: (rule) => rule.required().email(),
    }),
    defineField({
      name: "linkedin",
      title: "LinkedIn URL",
      type: "url",
    }),
    defineField({
      name: "github",
      title: "GitHub URL",
      type: "url",
    }),
    defineField({
      name: "resumeFile",
      title: "Resume (PDF)",
      type: "file",
      options: { accept: "application/pdf" },
    }),
    defineField({
      name: "skillGroups",
      title: "Skill groups",
      type: "array",
      of: [defineArrayMember({ type: "skillGroup" })],
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "headline" },
  },
});
