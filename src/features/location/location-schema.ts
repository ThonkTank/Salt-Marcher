import { checkedKeyTarget, type AtlasKeyTarget } from "../atlas/key-target";
import {
  nativeArray,
  nativeId,
  nativeRecord,
  nativeText,
} from "../atlas/native-values";

export interface LocationSection {
  readonly id: string;
  readonly title: string;
  readonly markdown: string;
}
export interface LocationDetailMap {
  readonly kind: "city" | "dungeon";
  readonly documentId: string;
}
export interface LocationDocument {
  readonly kind: "location";
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly type: "city" | "poi";
  readonly sections: readonly LocationSection[];
  readonly detailMaps: readonly LocationDetailMap[];
  readonly keyLinks: readonly AtlasKeyTarget[];
}
/** Preserve all Markdown bytes and section order; reject unknown data before serialization. */
export function checkedLocationDocument(value: unknown): LocationDocument {
  const v = nativeRecord(value, [
    "kind",
    "version",
    "id",
    "name",
    "type",
    "sections",
    "detailMaps",
    "keyLinks",
  ]);
  if (
    v.kind !== "location" ||
    v.version !== 1 ||
    !["city", "poi"].includes(v.type as string)
  )
    throw new Error("Ungültige Ortsdatei oder unbekannte Version.");
  const name = nativeText(v.name, true);
  if (name.length > 200) throw new Error("Ortsname ist zu lang.");
  const ids = new Set<string>(),
    maps = new Set<string>();
  const sections = nativeArray(v.sections).map((value) => {
    const s = nativeRecord(value, ["id", "title", "markdown"]),
      id = nativeId(s.id);
    if (ids.has(id)) throw new Error("Doppelte Ortsabschnittskennung.");
    ids.add(id);
    return Object.freeze({
      id,
      title: nativeText(s.title, true),
      markdown: nativeText(s.markdown),
    });
  });
  const detailMaps = nativeArray(v.detailMaps).map((value) => {
    const m = nativeRecord(value, ["kind", "documentId"]),
      documentId = nativeId(m.documentId);
    if (m.kind !== "city" && m.kind !== "dungeon")
      throw new Error("Unbekannter Ortskartentyp.");
    const key = `${m.kind}/${documentId}`;
    if (maps.has(key)) throw new Error("Doppelter Ortskartenverweis.");
    maps.add(key);
    return Object.freeze({ kind: m.kind, documentId });
  });
  return Object.freeze({
    kind: "location",
    version: 1,
    id: nativeId(v.id),
    name,
    type: v.type as "city" | "poi",
    sections: Object.freeze(sections),
    detailMaps: Object.freeze(detailMaps),
    keyLinks: Object.freeze(nativeArray(v.keyLinks).map(checkedKeyTarget)),
  });
}
export function parseLocationDocument(text: string): LocationDocument {
  return checkedLocationDocument(JSON.parse(text));
}
export function serializeLocationDocument(document: LocationDocument): string {
  return JSON.stringify(checkedLocationDocument(document), null, 2) + "\n";
}
export function newLocation(
  id: string,
  name: string,
  type: "city" | "poi",
  sectionIds: readonly [string, string],
): LocationDocument {
  return checkedLocationDocument({
    kind: "location",
    version: 1,
    id,
    name: name.trim(),
    type,
    sections: [
      { id: sectionIds[0], title: "Beschreibung", markdown: "" },
      { id: sectionIds[1], title: "Notizen", markdown: "" },
    ],
    detailMaps: [],
    keyLinks: [],
  });
}
