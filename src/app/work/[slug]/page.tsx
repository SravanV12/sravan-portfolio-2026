import Link from "next/link";
import { Container } from "@/components/container";

/**
 * Placeholder detail route. Step 04 replaces this with a build-time GROQ
 * query plus generateStaticParams.
 */
export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;

  return (
    <main className="flex flex-col">
      <Container as="article" className="py-24">
        <Link href="/#work" className="text-mono text-muted uppercase">
          Back to work
        </Link>
        <h1 className="text-h1 mt-10 max-w-[20ch]">Case study</h1>
        <p className="text-mono text-muted mt-6 uppercase">{slug}</p>
        <p className="text-body text-muted mt-10 max-w-[62ch]">
          Placeholder. Narrative and architecture diagrams are authored in the
          CMS and rendered here at build time.
        </p>
      </Container>
    </main>
  );
}
