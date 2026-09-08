import type { Metadata, Viewport } from "next";
import Studio from "./studio";

/**
 * The embedded Studio. It is an editing application, not content, so it is
 * rendered on demand and never prerendered or cached.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio",
  // The editor is not part of the site's public surface.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function StudioPage() {
  return <Studio />;
}
