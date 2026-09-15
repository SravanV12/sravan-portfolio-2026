import { NextResponse } from "next/server";
import {
  MIN_FILL_MS,
  isValid,
  normalise,
  validate,
  type ContactInput,
} from "@/lib/contact";

/**
 * Takes a message from the contact form and sends it on by email.
 *
 * Server-side because it has to be: the provider key is a credential, and the
 * only way to keep it out of the browser is for the browser never to hold it.
 * The form posts here, this talks to the provider, and nothing secret crosses
 * the boundary.
 *
 * The provider is reached over plain HTTP rather than through its SDK. It is
 * one request, the SDK would be another dependency to keep current, and
 * swapping providers later means editing `send`, not the route.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resend's REST endpoint.
 *
 * Overridable so a compatible provider or a relay can be pointed at without a
 * code change, and so the whole path can be exercised against a local stub
 * rather than only up to the point where the real send begins.
 */
const PROVIDER = process.env.CONTACT_API_URL ?? "https://api.resend.com/emails";

/**
 * Per-address limit, held in module scope.
 *
 * Honest about what this is: a serverless instance holds its own copy, so it
 * bounds one instance rather than the deployment. That still removes the easy
 * case of a single client hammering the endpoint, and the alternative is a
 * datastore this site does not otherwise need. The honeypot and the fill timer
 * do the rest.
 */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;
const seen = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (seen.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  seen.set(key, hits);

  // Keep the map from growing without bound on a long-lived instance.
  if (seen.size > 500) {
    for (const [k, v] of seen) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) seen.delete(k);
    }
  }

  return hits.length > RATE_MAX;
}

/** Strips anything that could inject a second header into the subject line. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

async function send(value: ContactInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!key || !to) return false;

  // Resend allows this sender with no domain set up, which is what lets the
  // form work before a domain is verified. Override it once one is.
  const from = process.env.CONTACT_FROM_EMAIL ?? "Portfolio <onboarding@resend.dev>";

  const response = await fetch(PROVIDER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      // The whole point of the form: replying goes to the visitor, not to the
      // sending address, so a reply is one keystroke rather than a copy-paste.
      reply_to: value.email,
      subject: `Portfolio message from ${headerSafe(value.name)}`,
      text: [
        `From: ${value.name} <${value.email}>`,
        "",
        value.message,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    // Logged for the operator, never returned to the caller.
    console.error(
      "Contact provider rejected the message:",
      response.status,
      (await response.text()).slice(0, 300),
    );
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  // Honeypot. Hidden from anyone reading the page, so a value here is a bot.
  // Answered with success so there is nothing to learn from the response.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // Filled impossibly fast, or on a page left open for hours and probably
  // replayed. Same silent success.
  const startedAt = Number(body.startedAt);
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < MIN_FILL_MS || elapsed > 6 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: true });
  }

  const value = normalise(body as Partial<ContactInput>);
  const errors = validate(value);
  if (!isValid(errors)) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(`${ip}:${value.email}`)) {
    return NextResponse.json(
      { error: "That is a few messages in a short time. Please try again shortly." },
      { status: 429 },
    );
  }

  const delivered = await send(value).catch((error) => {
    console.error("Contact send threw:", error);
    return false;
  });

  if (!delivered) {
    return NextResponse.json(
      { error: "The message could not be sent. Please email me directly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
