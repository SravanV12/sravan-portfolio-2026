import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { Container } from "@/components/container";
import { EducationList } from "@/components/education-list";
import { KineticText } from "@/components/kinetic-text";
import { Magnetic } from "@/components/magnetic";
import { PortableText } from "@/components/portable-text";
import { ProseReveal } from "@/components/prose-reveal";
import { Reveal } from "@/components/reveal";
import { SkillCard } from "@/components/skill-card";
import { WorkRow } from "@/components/work-row";
import { DURATION, STAGGER } from "@/lib/motion";
import { sanityFetch } from "@/sanity/fetch";
import { CASE_STUDIES_QUERY, PROFILE_QUERY } from "@/sanity/queries";
import type { CaseStudyCard, Profile } from "@/sanity/types";

export const revalidate = 3600;

export default async function HomePage() {
  const [profile, caseStudies] = await Promise.all([
    sanityFetch<Profile | null>(PROFILE_QUERY),
    sanityFetch<CaseStudyCard[]>(CASE_STUDIES_QUERY),
  ]);

  // Read on the server and never sent to the browser: this is whether the mail
  // provider is configured, not what it is configured with.
  const mailConfigured = Boolean(
    process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL,
  );

  // Hidden only where a broken form would cost a real visitor their message.
  // In development it always renders, because hiding it there means whoever is
  // building the page cannot see the thing they are building, and a submission
  // that fails with a clear error is far more useful to them than an absence
  // they have to go and diagnose.
  const contactReady = mailConfigured || process.env.NODE_ENV !== "production";

  return (
    <main id="main" className="flex flex-col">
      {/* Hero. Type carries this; there is nothing else in it. */}
      <Container
        as="section"
        id="intro"
        className="flex min-h-svh flex-col justify-end pb-20 pt-32 sm:pb-28"
      >
        {/*
          The hero is deliberately NOT revealed. It is above the fold and its
          headline is the LCP element. Hiding it until GSAP loads moved LCP
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

      {/* Work index. Rows, not thumbnails: there are no screenshots. */}
      <Container as="section" id="work" className="border-line border-t py-24 sm:py-32">
        <KineticText
          as="h2"
          text="Selected work"
          className="text-mono text-muted block uppercase"
        />

        {/* Staggered: the rows arrive in sequence rather than as one block. */}
        <Reveal
          as="ul"
          variant="depth"
          stagger={STAGGER.base}
          className="work-list mt-12 sm:mt-16"
        >
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
            <Reveal variant="slide-right" duration={DURATION.slow}>
              {/* The intro resolves line by line as it is read, rather than
                  arriving as one block. */}
              <ProseReveal>
                <PortableText
                  value={profile?.intro}
                  className="text-h3 max-w-[38ch] font-normal"
                />
              </ProseReveal>
            </Reveal>

            {profile?.skillGroups?.length ? (
              <Reveal
                as="dl"
                variant="scale"
                stagger={STAGGER.tight}
                className="skill-grid border-line mt-20 grid gap-10 border-t pt-12 sm:grid-cols-2 lg:grid-cols-3"
              >
                {profile.skillGroups.map((group) => (
                  <SkillCard key={group._key} group={group} />
                ))}
              </Reveal>
            ) : null}
          </div>
        </div>
      </Container>

      {/* Education. Its own section rather than a footnote inside About: it
          answers a question hiring managers ask directly, and burying it in a
          paragraph makes it look like something being played down. */}
      {profile?.education?.length ? (
        <Container
          as="section"
          id="education"
          className="border-line border-t py-24 sm:py-32"
        >
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
            <KineticText
              as="h2"
              text="Education"
              className="text-mono text-muted block uppercase lg:col-span-3"
            />

            <div className="lg:col-span-9">
              <Reveal variant="slide-up" stagger={STAGGER.base}>
                <EducationList entries={profile.education} />
              </Reveal>
            </div>
          </div>
        </Container>
      ) : null}

      {/* Contact. The form posts to an endpoint that sends the message on by
          email, with the visitor's address as the reply-to, so answering is
          one keystroke. The direct links stay underneath it. */}
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

          <Reveal variant="slide-up" duration={DURATION.slow} className="lg:col-span-9">
            <p className="text-h3 max-w-[26ch] text-balance">
              Have something you would like to build, or a role you think fits?
              {contactReady ? " Send me a message." : " Get in touch."}
            </p>

            {/*
              Only shown once the endpoint has somewhere to send to. A form that
              is certain to fail is worse than no form: it costs the reader their
              message and their time, and the direct links below do the job. The
              same reasoning as the education section, which stays hidden until
              there is something in it.
            */}
            {contactReady ? (
              <div className="mt-12">
                {/*
                  The form needs script to submit, so with script off it is
                  hidden rather than left sitting there looking usable. The
                  direct links below are the route in that case, which is the
                  reason they were kept rather than replaced.
                */}
                <noscript>
                  <style>{`.contact-form{display:none}`}</style>
                  <p className="text-body text-muted max-w-[42ch]">
                    The message form needs JavaScript. Email or LinkedIn below
                    both reach me just as well.
                  </p>
                </noscript>
                <ContactForm />
              </div>
            ) : null}

            {/* The direct routes stay. Some readers would rather not use a
                form, and a form that is the only way through is a dead end if
                it ever breaks. */}
            <ul className="border-line text-mono mt-16 flex flex-wrap gap-x-10 gap-y-4 border-t pt-10 uppercase">
              {profile?.email ? (
                <li>
                  <a
                    href={`mailto:${profile.email}`}
                    className="border-line hover:border-accent hover:text-accent inline-block border-b pt-3 pb-1 wrap-anywhere transition-colors"
                  >
                    {profile.email}
                  </a>
                </li>
              ) : null}
              {profile?.linkedin ? (
                <li>
                  <a
                    href={profile.linkedin}
                    rel="me noreferrer"
                    target="_blank"
                    className="border-line hover:border-accent hover:text-accent inline-block border-b pt-3 pb-1 transition-colors"
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
                    className="border-line hover:border-accent hover:text-accent inline-block border-b pt-3 pb-1 transition-colors"
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
                    className="border-line hover:border-accent hover:text-accent inline-block border-b pt-3 pb-1 transition-colors"
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
