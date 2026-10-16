import {
  nativeId,
  nativeKind,
  nativeRecord,
  nativeText,
} from "./native-values";

export type AtlasKeyTarget =
  | {
      readonly kind: "location";
      readonly atlasId: string;
      readonly documentId: string;
      readonly sectionId: string | null;
    }
  | {
      readonly kind: "room";
      readonly atlasId: string | null;
      readonly documentId: string;
      readonly roomId: string;
      readonly sectionId: string | null;
      readonly anchor: string | null;
    };
const optionalId = (value: unknown) =>
  value === null ? null : nativeId(value);
/** Stored targets name owners and stable sections, never a filename or screen coordinate. */
export function checkedKeyTarget(value: unknown): AtlasKeyTarget {
  const kind = nativeKind(value);
  if (kind === "location") {
    const v = nativeRecord(value, [
      "kind",
      "atlasId",
      "documentId",
      "sectionId",
    ]);
    return Object.freeze({
      kind,
      atlasId: nativeId(v.atlasId),
      documentId: nativeId(v.documentId),
      sectionId: optionalId(v.sectionId),
    });
  }
  if (kind === "room") {
    const v = nativeRecord(value, [
      "kind",
      "atlasId",
      "documentId",
      "roomId",
      "sectionId",
      "anchor",
    ]);
    return Object.freeze({
      kind,
      atlasId: optionalId(v.atlasId),
      documentId: nativeId(v.documentId),
      roomId: nativeId(v.roomId),
      sectionId: optionalId(v.sectionId),
      anchor: v.anchor === null ? null : nativeText(v.anchor, true),
    });
  }
  throw new Error("Unbekanntes Key-Ziel; Inhalt bleibt erhalten.");
}
