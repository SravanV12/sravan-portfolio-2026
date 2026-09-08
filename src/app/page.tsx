import Link from "next/link";
import { Container } from "@/components/container";

/**
 * Placeholder structure only. Real content arrives from the CMS at build
 * time in step 04 — nothing here fetches anything.
 */
const placeholderWork = [
  { slug: "case-study-one", title: "Case study one", year: "2025" },
  { slug: "case-study-two", title: "Case study two", year: "2024" },
  { slug: "case-study-three", title: "Case study three", year: "2023" },
];

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <Container as="section" className="flex min-h-svh flex-col justify-end py-24">
        <p className="text-mono text-muted uppercase">Palakkad, Kerala — India</p>
        <h1 className="text-display mt-6 max-w-[16ch]">Sravan V</h1>
        <p className="text-h3 text-muted mt-6 max-w-[38ch]">
          Full-stack developer — web, mobile and desktop.
        </p>
      </Container>

      <Container as="section" id="work" className="border-line border-t py-24">
        <h2 className="text-mono text-muted uppercase">Selected work</h2>
        <ul className="mt-10">
          {placeholderWork.map((item) => (
            <li key={item.slug} className="border-line border-b">
              <Link
                href={`/work/${item.slug}`}
                className="flex items-baseline justify-between gap-8 py-8"
              >
                <span className="text-h2">{item.title}</span>
                <span className="text-mono text-muted">{item.year}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <Container as="section" id="about" className="border-line border-t py-24">
        <h2 className="text-mono text-muted uppercase">About</h2>
        <p className="text-h3 mt-10 max-w-[52ch]">
          Placeholder. Profile copy is authored in the CMS and rendered here at
          build time.
        </p>
      </Container>

      <Container as="footer" id="contact" className="border-line border-t py-24">
        <h2 className="text-mono text-muted uppercase">Contact</h2>
        <ul className="text-h3 mt-10 flex flex-col gap-3">
          <li>
            <a href="mailto:sravanvijayakumar97@gmail.com">
              sravanvijayakumar97@gmail.com
            </a>
          </li>
          <li>
            <a
              href="https://www.linkedin.com/in/sravan-vijayakumar-8378b2163"
              rel="me noreferrer"
              target="_blank"
            >
              LinkedIn
            </a>
          </li>
          <li>
            <a
              href="https://github.com/SravanV12/sravan-portfolio-2026"
              rel="noreferrer"
              target="_blank"
            >
              Source on GitHub
            </a>
          </li>
        </ul>
      </Container>
    </main>
  );
}
