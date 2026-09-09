import Link from "next/link";
import { Container } from "@/components/container";
import { KineticText } from "@/components/kinetic-text";
import { Magnetic } from "@/components/magnetic";
import { PortableText } from "@/components/portable-text";
import { Reveal } from "@/components/reveal";
import { WorkRow } from "@/components/work-row";
import { sanityFetch } from "@/sanity/fetch";
import { CASE_STUDIES_QUERY, PROFILE_QUERY } from "@/sanity/queries";
import type { CaseStudyCard, Profile } from "@/sanity/types";

export const revalidate = 3600;

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
        {/*
          The hero is deliberately NOT revealed. It is above the fold and its
          headline is the LCP element — hiding it until GSAP loads moved LCP
          from 2.3s to 2.9s, past the 2.5s budget, because the first paint then
          waits on JavaScript instead of just the webfont. Motion starts below
          the fold, where it costs nothing.
        */}
        {profile?.location ? (
          <p className="text-mono text-muted uppercase">{profile.location}</p>
        ) : null}

        {/* `focus` mode, not `mask`: these are above the fold and one of them
            is the LCP element, so they must be painted immediately and resolve
            in place rather than arriving from behind a clip. */}
        <KineticText
          as="h1"
          text={profile?.name ?? ""}
          mode="focus"
          stagger={0.03}
          className="text-display mt-8 block max-w-[14ch] text-balance"
        />

        {profile?.headline ? (
          <KineticText
            as="p"
            text={profile.headline}
            mode="focus"
            delay={0.25}
            stagger={0.008}
            className="text-h2 text-muted mt-10 block max-w-[24ch] text-balance"
          />
        ) : null}

        <p className="mt-16">
          <Magnetic>
            <Link
              href="#work"
              className="text-mono border-line hover:border-accent hover:text-accent inline-flex items-center gap-3 border-b pb-2 uppercase transition-colors"
            >
              Selected work
              <span aria-hidden="true">↓</span>
            </Link>
          </Magnetic>
        </p>
      </Container>

      {/* Work index. Rows, not thumbnails — there are no screenshots. */}
      <Container as="section" id="work" className="border-line border-t py-24 sm:py-32">
        <KineticText
          as="h2"
          text="Selected work"
          className="text-mono text-muted block uppercase"
        />

        {/* Staggered: the rows arrive in sequence rather than as one block. */}
        <Reveal as="ul" stagger={0.06} className="work-list mt-12 sm:mt-16">
          {caseStudies.map((item, index) => (
            <li key={item._id} className="border-line border-b">
              <WorkRow item={item} index={index} />
            </li>
          ))}
        </Reveal>
      </Container>

      {/* About. */}
      <Container as="section" id="about" className="border-line border-t py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <KineticText
            as="h2"
            text="About"
            className="text-mono text-muted block uppercase lg:col-span-3"
          />

          <div className="lg:col-span-9">
            <Reveal>
              <PortableText
                value={profile?.intro}
                className="text-h3 max-w-[38ch] font-normal"
              />
            </Reveal>

            {profile?.skillGroups?.length ? (
              <Reveal
                as="dl"
                stagger={0.05}
                className="border-line mt-20 grid gap-10 border-t pt-12 sm:grid-cols-2 lg:grid-cols-3"
              >
                {profile.skillGroups.map((group) => (
                  <div key={group._key}>
                    <dt className="text-mono text-muted uppercase">
                      {group.label}
                    </dt>
                    <dd className="text-body mt-4">
                      {group.items?.join(", ")}
                    </dd>
                  </div>
                ))}
              </Reveal>
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
          <KineticText
            as="h2"
            text="Contact"
            className="text-mono text-muted block uppercase lg:col-span-3"
          />

          <Reveal className="lg:col-span-9">
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
          </Reveal>
        </div>
      </Container>
    </main>
  );
}
