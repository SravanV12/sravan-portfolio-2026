import Link from "next/link";
import { Container } from "@/components/container";
import { PortableText } from "@/components/portable-text";
import { sanityFetch } from "@/sanity/fetch";
import { CASE_STUDIES_QUERY, PROFILE_QUERY } from "@/sanity/queries";
import type { CaseStudyCard, Profile } from "@/sanity/types";

export const revalidate = 3600;

export default async function HomePage() {
  // Server component. Both queries run at build time; nothing here is fetched
  // in the browser.
  const [profile, caseStudies] = await Promise.all([
    sanityFetch<Profile | null>(PROFILE_QUERY),
    sanityFetch<CaseStudyCard[]>(CASE_STUDIES_QUERY),
  ]);

  return (
    <main className="flex flex-col">
      <Container as="section" className="flex min-h-svh flex-col justify-end py-24">
        <p className="text-mono text-muted uppercase">Palakkad, Kerala — India</p>
        <h1 className="text-display mt-6 max-w-[16ch]">{profile?.name}</h1>
        {profile?.headline ? (
          <p className="text-h3 text-muted mt-6 max-w-[38ch]">
            {profile.headline}
          </p>
        ) : null}
      </Container>

      <Container as="section" id="work" className="border-line border-t py-24">
        <h2 className="text-mono text-muted uppercase">Selected work</h2>
        <ul className="mt-10">
          {caseStudies.map((item) => (
            <li key={item._id} className="border-line border-b">
              <Link
                href={`/work/${item.slug}`}
                className="flex flex-col gap-2 py-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <span className="text-h2">{item.title}</span>
                <span className="text-mono text-muted shrink-0">
                  {item.timeframe}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <Container as="section" id="about" className="border-line border-t py-24">
        <h2 className="text-mono text-muted uppercase">About</h2>
        <div className="mt-10 max-w-[62ch]">
          <PortableText value={profile?.intro} />
        </div>

        {profile?.skillGroups?.length ? (
          <dl className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {profile.skillGroups.map((group) => (
              <div key={group.label}>
                <dt className="text-mono text-muted uppercase">{group.label}</dt>
                <dd className="text-body mt-3">{group.items?.join(", ")}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Container>

      <Container as="footer" id="contact" className="border-line border-t py-24">
        <h2 className="text-mono text-muted uppercase">Contact</h2>
        <ul className="text-h3 mt-10 flex flex-col gap-3">
          {profile?.email ? (
            <li>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            </li>
          ) : null}
          {profile?.linkedin ? (
            <li>
              <a href={profile.linkedin} rel="me noreferrer" target="_blank">
                LinkedIn
              </a>
            </li>
          ) : null}
          {profile?.github ? (
            <li>
              <a href={profile.github} rel="me noreferrer" target="_blank">
                GitHub
              </a>
            </li>
          ) : null}
          {profile?.resumeUrl ? (
            <li>
              <a href={profile.resumeUrl} rel="noreferrer" target="_blank">
                Resume
              </a>
            </li>
          ) : null}
        </ul>
      </Container>
    </main>
  );
}
