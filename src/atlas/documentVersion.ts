import type { Version, Status, Bounds } from "./model";
export const sameVersion = (
  a: Version | null | undefined,
  b: Version | null | undefined,
) => !!a && !!b && a.sessionId === b.sessionId && a.revision === b.revision;

// Reject incomplete or malformed hints: without a journal they cannot prove
// anything about data retained from the preceding revision.
export function knownChanges(
  status: Status,
): NonNullable<Status["changes"]> | null {
  const c = status.changes;
  const bounds = (b: unknown): b is Bounds =>
    Array.isArray(b) &&
    b.length === 4 &&
    b.every(Number.isFinite) &&
    b[0] <= b[2] &&
    b[1] <= b[3];
  if (
    !c ||
    !Array.isArray(c.world) ||
    !c.world.every(bounds) ||
    !Array.isArray(c.metadata) ||
    !c.metadata.every((id) => typeof id === "string") ||
    !Array.isArray(c.relations) ||
    !c.relations.every((id) => typeof id === "string") ||
    !Array.isArray(c.interiors) ||
    !c.interiors.every(
      (r) =>
        r &&
        typeof r.buildingId === "string" &&
        Number.isSafeInteger(r.floor) &&
        bounds(r.bounds),
    )
  )
    return null;
  return c;
}

/** Only a complete, immediately preceding revision can retain cached geometry. */
export function incrementalChanges(previous: Version | null, next: Status) {
  return previous?.sessionId === next.sessionId &&
    previous.revision + 1 === next.revision
    ? knownChanges(next)
    : null;
}
