import { Container } from "@/components/container";

/**
 * Placeholder. Step 02 mounts the embedded Sanity Studio here.
 */
export default function StudioPage() {
  return (
    <main className="flex flex-col">
      <Container className="py-24">
        <h1 className="text-h2">Studio</h1>
        <p className="text-body text-muted mt-6 max-w-[62ch]">
          Placeholder. The CMS Studio is mounted at this route in step 02.
        </p>
      </Container>
    </main>
  );
}
