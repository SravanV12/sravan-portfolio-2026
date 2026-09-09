import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PlatformSection } from "@/components/platform-section";
import { PortableText } from "@/components/portable-text";
import { Reveal } from "@/components/reveal";
import { sanityFetch } from "@/sanity/fetch";
import { CASE_STUDY_QUERY, CASE_STUDY_SLUGS_QUERY } from "@/sanity/queries";
import type { CaseStudy, CaseStudySlug } from "@/sanity/types";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await sanityFetch<CaseStudySlug[]>(CASE_STUDY_SLUGS_QUERY);
  return slugs
    .filter((item): item is { slug: string } => Boolean(item.slug))
    .map((item) => ({ slug: item.slug }));
}

/** One row of the meta rail. */
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-mono text-muted uppercase">{label}</dt>
      <dd className="text-small mt-2">{value}</dd>
    </div>
  );
}

export default async function CaseStudyPage({
  params,
}: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const caseStudy = await sanityFetch<CaseStudy | null>(CASE_STUDY_QUERY, {
    slug,
  });

  if (!caseStudy) {
    notFound();
  }

  return (
    <main id="main" className="flex flex-col">
      <Container as="article" className="pb-24 pt-32 sm:pb-32">
        <Link
          href="/#work"
          className="text-mono text-muted hover:text-accent uppercase transition-colors"
        >
          ← Work
        </Link>

        {/* Above the fold, so not revealed — same LCP reasoning as the hero. */}
        <header className="mt-16">
          <h1 className="text-h1 max-w-[18ch] text-balance">
            {caseStudy.title}
          </h1>
          {caseStudy.summary ? (
            <p className="text-h3 text-muted mt-8 max-w-[44ch]">
              {caseStudy.summary}
            </p>
          ) : null}
        </header>

        {/* Meta rail: sticky beside the prose on desktop, stacked above it on
            mobile. Same markup, same order — no duplication to keep in sync. */}
        <div className="mt-20 grid gap-12 lg:grid-cols-12 lg:gap-8">
          <aside className="lg:col-span-3">
            <dl className="border-line grid gap-8 border-t pt-8 sm:grid-cols-2 lg:sticky lg:top-16 lg:block lg:space-y-8">
              {caseStudy.client ? (
                <Meta label="Client" value={caseStudy.client} />
              ) : null}
              {caseStudy.role ? (
                <Meta label="Role" value={caseStudy.role} />
              ) : null}
              {caseStudy.timeframe ? (
                <Meta label="Timeframe" value={caseStudy.timeframe} />
              ) : null}
              {caseStudy.stack?.length ? (
                <Meta label="Stack" value={caseStudy.stack.join(", ")} />
              ) : null}
            </dl>
          </aside>

          <div className="lg:col-span-8 lg:col-start-5">
            {caseStudy.sections?.length ? (
              <div>
                {caseStudy.sections.map((section) => (
                  <Reveal
                    as="section"
                    key={section._key}
                    className="border-line mt-16 border-t pt-8 first:mt-0 first:border-t-0 first:pt-0"
                  >
                    <h2 className="text-mono text-muted uppercase">
                      {section.heading}
                    </h2>
                    <div className="mt-6 max-w-[68ch]">
                      <PortableText value={section.body} />
                    </div>
                  </Reveal>
                ))}
              </div>
            ) : null}

            {caseStudy.showPlatformSection && caseStudy.platforms?.length ? (
              <PlatformSection platforms={caseStudy.platforms} />
            ) : null}

            {caseStudy.diagram ? (
              <Reveal as="section" className="border-line mt-16 border-t pt-8">
                <h2 className="text-mono text-muted uppercase">Architecture</h2>
                <h3 className="text-h3 mt-6">{caseStudy.diagram.title}</h3>
                {/* The animated figure is built in step 09. Until then the alt
                    text carries the meaning, which is what a screen reader
                    receives either way. */}
                <p className="text-body text-muted mt-4 max-w-[68ch]">
                  {caseStudy.diagram.altText}
                </p>
              </Reveal>
            ) : null}
          </div>
        </div>

        <p className="border-line mt-24 border-t pt-8">
          <Link
            href="/#work"
            className="text-mono text-muted hover:text-accent uppercase transition-colors"
          >
            ← All work
          </Link>
        </p>
      </Container>
    </main>
  );
}
