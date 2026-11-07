import {
  parseLocationDocument,
  type LocationDocument,
} from "../location/location-schema";
import type { AtlasNativeFile } from "./atlas-campaign-source";
import type { LocationPlacement } from "./location-placement";
import { newLocationPath } from "./location-owners";
import { parseSpatialWorld } from "./spatial-schema";

export interface AtlasLocationSaveExtension {
  readonly file: AtlasNativeFile;
  readonly document: LocationDocument;
  readonly placement: LocationPlacement;
}

/** Local Location drafts are not Registry authority. This only checks their native closure. */
export function atlasLocationSaveExtensions(
  files: readonly AtlasNativeFile[],
  confirmed: readonly Pick<AtlasNativeFile, "kind" | "id" | "path">[],
  worldId: string,
  confirmedIds: Iterable<string>,
): readonly AtlasLocationSaveExtension[] {
  if (new Set(files.map((f) => f.path)).size !== files.length)
    throw new Error("Doppelte native Save-Datei.");
  const extra = files.filter((f) => !confirmed.some((c) => c.path === f.path));
  if (!extra.length) return [];
  const world = files.find((f) => f.kind === "world" && f.id === worldId);
  if (!world?.before || !world.after)
    throw new Error("Ortsanlage besitzt keine native Weltbasis.");
  const before = parseSpatialWorld(world.before),
    after = parseSpatialWorld(world.after);
  if (before.id !== worldId || after.id !== worldId)
    throw new Error("Ortsanlage gehört einer fremden Welt.");
  for (const p of before.placements) {
    const next = after.placements.find((n) => n.id === p.id);
    if (!next || next.locationId !== p.locationId)
      throw new Error("Ortsanlage verändert eine bestehende Markerbindung.");
  }
  const placements = after.placements.filter(
    (p) => !before.placements.some((b) => b.id === p.id),
  );
  const ids = new Set(confirmedIds);
  const claim = (id: string) => {
    if (ids.has(id))
      throw new Error("Ortsanlage besitzt eine bereits belegte Kennung.");
    ids.add(id);
  };
  const extensions = extra.map((file) => {
    if (
      file.kind !== "location" ||
      file.id === null ||
      file.before !== null ||
      file.after === null ||
      file.path !== newLocationPath(file.id)
    )
      throw new Error(
        "Ortsanlage benötigt eine neue kanonische Locationdatei mit BeforeNull.",
      );
    const document = parseLocationDocument(file.after);
    if (
      document.id !== file.id ||
      document.detailMaps.length ||
      document.keyLinks.length
    )
      throw new Error(
        "Ortsanlage besitzt eine fremde Kennung oder unbelegte Detaillinks.",
      );
    const matches = placements.filter((p) => p.locationId === document.id);
    if (
      matches.length !== 1 ||
      after.placements.filter((p) => p.locationId === document.id).length !== 1
    )
      throw new Error("Ortsanlage benötigt genau einen eigenen World-Marker.");
    claim(document.id);
    for (const section of document.sections) claim(section.id);
    claim(matches[0]!.id);
    return { file, document, placement: matches[0]! };
  });
  if (placements.length !== extensions.length)
    throw new Error(
      "Neue World-Marker besitzen keine vollständige Ortsclosure.",
    );
  return extensions;
}
