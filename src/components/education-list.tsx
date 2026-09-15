import type { EducationEntry } from "@/sanity/types";

/**
 * Academic background, drawn as nodes on a rail.
 *
 * The shape is borrowed rather than invented. The whole site already speaks in
 * services wired together: the background is a system graph, the case studies
 * are architecture diagrams, and both use a small rotated square for a node and
 * a thin accent line for a connection. Education is a sequence of points on a
 * line, so it is drawn with the same two marks. That is what stops it reading
 * as a CV block pasted into a portfolio.
 *
 * A server component. There is no interaction here beyond hover, which CSS
 * handles, so none of this needs to reach the browser as JavaScript.
 */
export function EducationList({ entries }: { entries: EducationEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <ol className="education-rail">
      {entries.map((entry) => (
        <li key={entry._key} className="education-entry">
          {/* The node. Decorative, so it is never announced. */}
          <span aria-hidden="true" className="education-node" />

          <div className="min-w-0">
            {entry.timeframe ? (
              <p className="text-mono text-muted uppercase">
                {entry.timeframe}
              </p>
            ) : null}

            <h3 className="text-h3 mt-3 text-balance">{entry.qualification}</h3>

            {/*
              Institution, place and result read as one line of provenance.
              Separated by a middot rather than a dash: a dash between a place
              and a grade looks like a range, which is the one thing it is not.
            */}
            {entry.institution || entry.location || entry.result ? (
              <p className="text-body text-muted mt-2">
                {[entry.institution, entry.location, entry.result]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}

            {entry.notes?.length ? (
              <ul className="mt-5 flex flex-wrap gap-x-2 gap-y-2">
                {entry.notes.map((note) => (
                  <li
                    key={note}
                    className="text-mono border-line text-muted rounded-full border px-3 py-1.5"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
