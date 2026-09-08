/**
 * Environment values for the CMS connection, read once and validated here so
 * a missing variable fails loudly at startup rather than as a confusing
 * runtime error later.
 *
 * Only NEXT_PUBLIC_ values belong in this file — it is imported by the Studio,
 * which runs in the browser.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const projectId = required(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
);

export const dataset = required(
  process.env.NEXT_PUBLIC_SANITY_DATASET,
  "NEXT_PUBLIC_SANITY_DATASET",
);

export const apiVersion = required(
  process.env.NEXT_PUBLIC_SANITY_API_VERSION,
  "NEXT_PUBLIC_SANITY_API_VERSION",
);
