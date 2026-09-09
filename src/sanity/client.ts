import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "./env";

/**
 * Read-only client. Every query runs at build time or during revalidation —
 * never from a client component. See the architecture rule in the project docs.
 *
 * useCdn is OFF, against the original instruction, because it broke on-demand
 * revalidation. Measured on the same query at the same moment: the CDN returned
 * 6 documents while the live API returned 7, and it stayed stale for minutes
 * after the change was published. The webhook fired, the page regenerated, and
 * it rebuilt itself from the stale response — an edit would not appear until
 * the edge cache aged out.
 *
 * The CDN costs nothing to give up here. Queries run at build time and on
 * revalidation, not per visitor, so this is a handful of requests rather than
 * one per page view. The Full Route Cache is what serves readers.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
});
