import type { ReactNode } from "react";

/**
 * Abstract outlines standing in for a browser, a desktop window and a phone.
 *
 * Deliberately empty inside. PAAS is client work, so there are no product
 * screenshots and nothing here may resemble the real interface — these are
 * shapes that say "this shipped on three surfaces", not mock UI.
 *
 * Everything is drawn from `line`, `surface` and `muted` tokens.
 */

type FrameKind = "web" | "desktop" | "mobile" | "generic";

/** Infers the shape from the CMS label, since labels are editable. */
export function frameKindFor(label?: string): FrameKind {
  const value = label?.toLowerCase() ?? "";
  if (value.includes("web") || value.includes("browser")) return "web";
  if (value.includes("desktop")) return "desktop";
  if (value.includes("mobile") || value.includes("phone")) return "mobile";
  return "generic";
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="border-line bg-surface/40 flex h-full w-full flex-col overflow-hidden rounded-md border">
      {children}
    </div>
  );
}

/** The three dots of a browser toolbar, drawn as outlines. */
function Dots() {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      <span className="border-line size-2 rounded-full border" />
      <span className="border-line size-2 rounded-full border" />
      <span className="border-line size-2 rounded-full border" />
    </div>
  );
}

/** Suggestion of content. Bars, not text — nothing readable, nothing real. */
function Bars({ rows = 4 }: { rows?: number }) {
  const widths = ["w-4/5", "w-3/5", "w-11/12", "w-2/5", "w-3/4", "w-1/2"];
  return (
    <div className="flex flex-1 flex-col gap-3 p-5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          className={`bg-line h-2 rounded-full ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

export function DeviceFrame({ kind }: { kind: FrameKind }) {
  if (kind === "mobile") {
    return (
      <div className="mx-auto aspect-[9/17] h-full max-h-[22rem]">
        <div className="border-line bg-surface/40 flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] border-2">
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="bg-line h-1 w-10 rounded-full" />
          </div>
          <Bars rows={5} />
        </div>
      </div>
    );
  }

  if (kind === "desktop") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center">
        <div className="aspect-[16/10] w-full max-w-[26rem]">
          <Shell>
            <div className="border-line flex items-center gap-3 border-b px-4 py-3">
              <Dots />
              <span className="bg-line ml-2 h-2 w-16 rounded-full" aria-hidden="true" />
            </div>
            <Bars rows={4} />
          </Shell>
        </div>
        {/* Stand, so it reads as a monitor rather than a second browser. */}
        <div className="border-line mt-0 h-6 w-16 border-x" aria-hidden="true" />
        <div className="bg-line h-0.5 w-32 rounded-full" aria-hidden="true" />
      </div>
    );
  }

  if (kind === "web") {
    return (
      <div className="aspect-[16/10] w-full max-w-[30rem]">
        <Shell>
          <div className="border-line flex items-center gap-3 border-b px-4 py-3">
            <Dots />
            {/* Address bar */}
            <span
              className="border-line h-4 flex-1 rounded-full border"
              aria-hidden="true"
            />
          </div>
          <Bars rows={4} />
        </Shell>
      </div>
    );
  }

  return (
    <div className="aspect-[16/10] w-full max-w-[28rem]">
      <Shell>
        <Bars rows={4} />
      </Shell>
    </div>
  );
}
