import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { EnvironmentLayer } from "@/components/environment/environment-layer";
import { SiteNav } from "@/components/site-nav";
import { RouteTransition } from "@/components/route-transition";
import { SmoothScroll } from "@/components/smooth-scroll";
import "./globals.css";

/**
 * Runs before first paint. Marks the document only when script is running AND
 * motion is allowed, which is what gates the reveal system's hidden state.
 * Doing this here rather than in React avoids a frame of visible content that
 * then disappears.
 */
const MOTION_FLAG = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("motion-js")}catch(e){}`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  // Not preloaded: mono is only used for small metadata labels, none of which
  // are the LCP element. Preloading both faces made them compete for
  // bandwidth and delayed the headline, which is what LCP actually measures.
  preload: false,
});

export const metadata: Metadata = {
  title: "Sravan V — Full-Stack Developer",
  description:
    "Full-stack developer building for web, mobile and desktop. Based in Palakkad, Kerala.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_FLAG }} />
      </head>
      <body className="bg-bg text-fg font-sans text-body flex min-h-full flex-col">
        <SmoothScroll />
        {/* Decorative background. Absent on mobile, with reduced motion, or
            without WebGL — the page reads identically either way. */}
        <EnvironmentLayer />
        {/* Off-screen until focused, so a keyboard user can skip straight to
            the content instead of tabbing the whole page. */}
        <a
          href="#main"
          className="text-mono bg-surface text-fg sr-only rounded px-5 py-3 uppercase focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50"
        >
          Skip to content
        </a>
        {/* Content sits above the environment. Sections have no background of
            their own, so the field shows through behind the type. The
            environment stays mounted across navigations, so the world carries
            on while only the content changes. */}
        <SiteNav />
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
