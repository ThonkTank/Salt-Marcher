import type { Version } from "./model";
export const sameVersion = (
  a: Version | null | undefined,
  b: Version | null | undefined,
) => !!a && !!b && a.sessionId === b.sessionId && a.revision === b.revision;
