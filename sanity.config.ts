import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { apiVersion, dataset, projectId } from "@/sanity/env";
import { schemaTypes, singletonTypes } from "@/sanity/schemaTypes";

/**
 * Studio configuration. Mounted inside the Next app at /studio, so the CMS is
 * editable from the deployed site itself rather than a separate deployment.
 */

/** A singleton can be edited and published, but not created or deleted. */
const singletonActions = new Set(["publish", "discardChanges", "restore"]);

export default defineConfig({
  name: "default",
  title: "Sravan V — Portfolio",
  basePath: "/studio",
  projectId,
  dataset,

  schema: {
    types: schemaTypes,
    // Remove "create new" entries for singletons.
    templates: (templates) =>
      templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
  },

  document: {
    // Strip create/delete/duplicate from singletons.
    actions: (input, { schemaType }) =>
      singletonTypes.has(schemaType)
        ? input.filter(({ action }) => action && singletonActions.has(action))
        : input,
  },

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("Profile")
              .id("profile")
              .child(
                S.document().schemaType("profile").documentId("profile"),
              ),
            S.divider(),
            ...S.documentTypeListItems().filter(
              (item) => !singletonTypes.has(item.getId() ?? ""),
            ),
          ]),
    }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
});
