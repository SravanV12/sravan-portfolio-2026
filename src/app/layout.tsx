import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
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
      <body className="bg-bg text-fg font-sans text-body flex min-h-full flex-col">
        {/* Off-screen until focused, so a keyboard user can skip straight to
            the content instead of tabbing the whole page. */}
        <a
          href="#main"
          className="text-mono bg-surface text-fg sr-only rounded px-4 py-2 uppercase focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
