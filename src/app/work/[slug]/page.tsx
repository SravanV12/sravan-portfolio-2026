import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/container";
import { PortableText } from "@/components/portable-text";
import { sanityFetch } from "@/sanity/fetch";
import { CASE_STUDY_QUERY, CASE_STUDY_SLUGS_QUERY } from "@/sanity/queries";
import type { CaseStudy, CaseStudySlug } from "@/sanity/types";

export const revalidate = 3600;

/** Prerenders every case study at build time. */
export async function generateStaticParams() {
  const slugs = await sanityFetch<CaseStudySlug[]>(CASE_STUDY_SLUGS_QUERY);
  return slugs
    .filter((item): item is { slug: string } => Boolean(item.slug))
    .map((item) => ({ slug: item.slug }));
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
    <main className="flex flex-col">
      <Container as="article" className="py-24">
        <Link href="/#work" className="text-mono text-muted uppercase">
          Back to work
        </Link>

        <header className="mt-10">
          <h1 className="text-h1 max-w-[20ch]">{caseStudy.title}</h1>
          {caseStudy.summary ? (
            <p className="text-h3 text-muted mt-6 max-w-[48ch]">
              {caseStudy.summary}
            </p>
          ) : null}

          <dl className="border-line mt-12 grid gap-8 border-t pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {caseStudy.client ? (
              <div>
                <dt className="text-mono text-muted uppercase">Client</dt>
                <dd className="text-body mt-2">{caseStudy.client}</dd>
              </div>
            ) : null}
            {caseStudy.role ? (
              <div>
                <dt className="text-mono text-muted uppercase">Role</dt>
                <dd className="text-body mt-2">{caseStudy.role}</dd>
              </div>
            ) : null}
            {caseStudy.timeframe ? (
              <div>
                <dt className="text-mono text-muted uppercase">Timeframe</dt>
                <dd className="text-body mt-2">{caseStudy.timeframe}</dd>
              </div>
            ) : null}
            {caseStudy.stack?.length ? (
              <div>
                <dt className="text-mono text-muted uppercase">Stack</dt>
                <dd className="text-body mt-2">{caseStudy.stack.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        {caseStudy.sections?.length ? (
          <div className="mt-24 max-w-[68ch]">
            {caseStudy.sections.map((section) => (
              <section key={section.heading} className="mt-20 first:mt-0">
                <h2 className="text-mono text-muted uppercase">
                  {section.heading}
                </h2>
                <div className="mt-6">
                  <PortableText value={section.body} />
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {caseStudy.showPlatformSection && caseStudy.platforms?.length ? (
          <section className="border-line mt-24 border-t pt-16">
            <h2 className="text-mono text-muted uppercase">Platforms</h2>
            <div className="mt-10 grid gap-12 lg:grid-cols-3">
              {caseStudy.platforms.map((platform) => (
                <div key={platform.label}>
                  <h3 className="text-h3">{platform.label}</h3>
                  <p className="text-body text-muted mt-4">
                    {platform.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {caseStudy.diagram ? (
          <section className="border-line mt-24 border-t pt-16">
            <h2 className="text-mono text-muted uppercase">Architecture</h2>
            <h3 className="text-h3 mt-6">{caseStudy.diagram.title}</h3>
            {/* The animated figure is built in step 09. Until then the alt
                text carries the meaning, which is what a screen reader gets
                either way. */}
            <p className="text-body text-muted mt-6 max-w-[68ch]">
              {caseStudy.diagram.altText}
            </p>
          </section>
        ) : null}
      </Container>
    </main>
  );
}
