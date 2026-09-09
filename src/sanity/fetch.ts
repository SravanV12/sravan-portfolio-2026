import { client } from "./client";

/** Matches the `revalidate` exported by every page. */
export const REVALIDATE_SECONDS = 3600;

/**
 * The only way content enters the app. Server components only.
 *
 * Content must be in the HTML before hydration: anything fetched later arrives
 * after layout, shifts the page, and leaves ScrollTrigger holding measurements
 * taken against the wrong heights.
 *
 * The `server-only` package would make a client-side import a build error
 * rather than a review catch. It is not installed — adding it needs approval.
 */
export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return client.fetch<T>(query, params, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
}
