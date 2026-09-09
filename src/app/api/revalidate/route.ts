import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Called by the CMS webhook when content changes, so an edit goes live without
 * a redeploy.
 *
 * Responses are deliberately blank. A caller who does not already hold the
 * secret learns nothing from the reply beyond whether it was accepted, and
 * never why it was refused.
 */

export const dynamic = "force-dynamic";

/** Constant-time compare that does not leak length through early return. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still burn a comparison so timing does not distinguish the two cases.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.SANITY_REVALIDATE_SECRET;

  // A missing secret means the endpoint is unconfigured. Refuse rather than
  // accepting everything.
  if (!expected) {
    return new NextResponse(null, { status: 401 });
  }

  const provided =
    request.headers.get("x-revalidate-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!provided || !secretMatches(provided, expected)) {
    return new NextResponse(null, { status: 401 });
  }

  revalidatePath("/");
  revalidatePath("/work/[slug]", "page");

  return NextResponse.json({ revalidated: true });
}
