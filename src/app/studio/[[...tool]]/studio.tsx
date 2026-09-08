"use client";

import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

/**
 * The Studio is a browser application. Keeping it behind a client boundary
 * stops the CMS library being pulled into the server component graph, where
 * its dependencies resolve against React's server build and fail.
 */
export default function Studio() {
  return <NextStudio config={config} />;
}
