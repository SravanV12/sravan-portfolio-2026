import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { apiVersion, dataset, projectId } from "@/sanity/env";

/**
 * Studio configuration. Mounted inside the Next app at /studio, so the CMS is
 * editable from the deployed site itself rather than a separate deployment.
 *
 * Schema types are added in the next step — an empty list is expected here.
 */
export default defineConfig({
  name: "default",
  title: "Sravan V — Portfolio",
  basePath: "/studio",
  projectId,
  dataset,
  schema: {
    types: [],
  },
  plugins: [structureTool(), visionTool({ defaultApiVersion: apiVersion })],
});
