import { client } from "./client";

/**
 * Stands in for the `server-only` package, which would turn a client-side
 * import into a build error. Adding a dependency needs approval, so this throws
 * at module load instead — the moment any client component pulls this in, the
 * page breaks loudly in development rather than quietly shipping CMS content
 * and credentials to the browser.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/sanity/fetch.ts was imported in the browser. CMS content is fetched " +
      "at build time in server components only — pass it down as props.",
  );
}

/** Matches the `revalidate` exported by every page. */
export const REVALIDATE_SECONDS = 3600;

/**
 * The only way content enters the app. Server components only.
 *
 * Content must be in the HTML before hydration: anything fetched later arrives
 * after layout, shifts the page, and leaves ScrollTrigger holding measurements
 * taken against the wrong heights.
 *
 * Caching is deliberately left to the page's own ISR window rather than being
 * duplicated here. Passing `next: { revalidate, tags }` puts a second entry in
 * the Data Cache that outlives `revalidatePath`, so the page regenerates and
 * reads back the same stale response — verified: the route cache went
 * HIT → MISS → HIT while the content never changed. The Sanity client does not
 * forward Next cache tags, so the entry could not be dropped by tag either.
 * With no entry to go stale, regeneration always re-queries.
 *
 * The `server-only` package would make a client-side import a build error
 * rather than a review catch. It is not installed — adding it needs approval.
 */
export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return client.fetch<T>(query, params);
}
