import Link from "next/link";
import { Container } from "@/components/container";
import { PortableText } from "@/components/portable-text";
import { sanityFetch } from "@/sanity/fetch";
import { CASE_STUDIES_QUERY, PROFILE_QUERY } from "@/sanity/queries";
import type { CaseStudyCard, Profile } from "@/sanity/types";

export const revalidate = 3600;

/** Two-digit index for the work rows. Editorial, not decorative. */
function ordinal(index: number) {
  return String(index + 1).padStart(2, "0");
}

export default async function HomePage() {
  const [profile, caseStudies] = await Promise.all([
    sanityFetch<Profile | null>(PROFILE_QUERY),
    sanityFetch<CaseStudyCard[]>(CASE_STUDIES_QUERY),
  ]);

  return (
    <main id="main" className="flex flex-col">
      {/* Hero. Type carries this; there is nothing else in it. */}
      <Container
        as="section"
        className="flex min-h-svh flex-col justify-end pb-20 pt-32 sm:pb-28"
      >
        {profile?.location ? (
          <p className="text-mono text-muted uppercase">{profile.location}</p>
        ) : null}

        <h1 className="text-display mt-8 max-w-[14ch] text-balance">
          {profile?.name}
        </h1>

        {profile?.headline ? (
          <p className="text-h2 text-muted mt-10 max-w-[24ch] text-balance">
            {profile.headline}
          </p>
        ) : null}

        <p className="mt-16">
          <Link
            href="#work"
            className="text-mono border-line hover:border-accent hover:text-accent inline-flex items-center gap-3 border-b pb-2 uppercase transition-colors"
          >
            Selected work
            <span aria-hidden="true">↓</span>
          </Link>
        </p>
      </Container>

      {/* Work index. Rows, not thumbnails — there are no screenshots. */}
      <Container as="section" id="work" className="border-line border-t py-24 sm:py-32">
        <h2 className="text-mono text-muted uppercase">Selected work</h2>

        <ul className="mt-12 sm:mt-16">
          {caseStudies.map((item, index) => (
            <li key={item._id} className="border-line border-b">
              <Link
                href={`/work/${item.slug}`}
                className="group grid gap-4 py-10 sm:py-12 lg:grid-cols-12 lg:gap-8"
              >
                <span className="text-mono text-muted lg:col-span-1">
                  {ordinal(index)}
                </span>

                <div className="lg:col-span-7">
                  <h3 className="text-h2 group-hover:text-accent transition-colors">
                    {item.title}
                  </h3>
                  {item.summary ? (
                    <p className="text-body text-muted mt-4 max-w-[52ch]">
                      {item.summary}
                    </p>
                  ) : null}
                </div>

                <div className="lg:col-span-4 lg:text-right">
                  <p className="text-mono text-muted uppercase">
                    {item.timeframe}
                  </p>
                  {item.stack?.length ? (
                    <p className="text-mono text-muted mt-3 wrap-break-word">
                      {item.stack.slice(0, 4).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      {/* About. */}
      <Container as="section" id="about" className="border-line border-t py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <h2 className="text-mono text-muted uppercase lg:col-span-3">About</h2>

          <div className="lg:col-span-9">
            <PortableText
              value={profile?.intro}
              className="text-h3 max-w-[38ch] font-normal"
            />

            {profile?.skillGroups?.length ? (
              <dl className="border-line mt-20 grid gap-10 border-t pt-12 sm:grid-cols-2 lg:grid-cols-3">
                {profile.skillGroups.map((group) => (
                  <div key={group.label}>
                    <dt className="text-mono text-muted uppercase">
                      {group.label}
                    </dt>
                    <dd className="text-body mt-4">
                      {group.items?.join(", ")}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </Container>

      {/* Contact. No form: it would need a backend and spam handling for
          nothing an email link does not already do. */}
      <Container
        as="footer"
        id="contact"
        className="border-line border-t py-24 sm:py-32"
      >
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <h2 className="text-mono text-muted uppercase lg:col-span-3">
            Contact
          </h2>

          <div className="lg:col-span-9">
            {profile?.email ? (
              // An email has no spaces to break at, so it is sized to fit its
              // column rather than left to split mid-word. `anywhere` is the
              // safety net, not the plan.
              <a
                href={`mailto:${profile.email}`}
                className="text-h3 sm:text-h2 hover:text-accent inline-block wrap-anywhere transition-colors"
              >
                {profile.email}
              </a>
            ) : null}

            <ul className="text-mono mt-16 flex flex-wrap gap-x-10 gap-y-4 uppercase">
              {profile?.linkedin ? (
                <li>
                  <a
                    href={profile.linkedin}
                    rel="me noreferrer"
                    target="_blank"
                    className="border-line hover:border-accent hover:text-accent border-b pb-1 transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
              ) : null}
              {profile?.github ? (
                <li>
                  <a
                    href={profile.github}
                    rel="me noreferrer"
                    target="_blank"
                    className="border-line hover:border-accent hover:text-accent border-b pb-1 transition-colors"
                  >
                    GitHub
                  </a>
                </li>
              ) : null}
              {profile?.resumeUrl ? (
                <li>
                  <a
                    href={profile.resumeUrl}
                    rel="noreferrer"
                    target="_blank"
                    className="border-line hover:border-accent hover:text-accent border-b pb-1 transition-colors"
                  >
                    Resume (PDF)
                  </a>
                </li>
              ) : null}
            </ul>

            <p className="text-mono text-muted mt-24 uppercase">
              © {new Date().getFullYear()} {profile?.name}
            </p>
          </div>
        </div>
      </Container>
    </main>
  );
}
