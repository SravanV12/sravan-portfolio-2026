import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "./env";

/**
 * Read-only client. Every query runs at build time or during revalidation —
 * never from a client component. See the architecture rule in the project docs.
 *
 * useCdn: true serves reads from Sanity's edge cache, which is what we want for
 * published content. On-demand revalidation keeps it fresh.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});
