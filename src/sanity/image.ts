import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { dataset, projectId } from "./env";

const builder = imageUrlBuilder({ projectId, dataset });

/**
 * Builds a CDN URL for a CMS image.
 *
 * Always chain an explicit width/height before calling .url(), so the markup
 * carries real dimensions. Images without them cause layout shift, which in
 * turn makes ScrollTrigger measure the wrong page height.
 *
 *   urlFor(image).width(1200).height(675).url()
 */
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
