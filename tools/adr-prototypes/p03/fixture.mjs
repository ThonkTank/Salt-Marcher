export const PRIVATE_STRING_CANARIES = Object.freeze([
  "P03_PRIVATE_A_7d11e9",
  "P03_PRIVATE_B_91c64a",
  "/vault/campaigns/private-do-not-release.webp",
  "armor-class-19-secret-trigger-44",
]);

export const PRIVATE_IDENTITIES = Object.freeze([
  "hidden-monster-a",
  "unknown-room-b",
  "private-asset-a",
  "private-asset-b",
]);

export const RASTER_CANARY = Object.freeze({
  width: 8,
  height: 8,
  colors: Object.freeze([
    [248, 0, 248],
    [0, 248, 24],
    [248, 248, 0],
    [0, 24, 248],
  ]),
});

const marker = (id, label, x, y, color, knownAt) => ({
  id,
  label,
  x,
  y,
  color,
  knownAt,
});

export const PRIVATE_SCENES = Object.freeze({
  scene_a: Object.freeze({
    sceneId: "scene_a",
    publicMap: {
      label: "Harbor approach",
      backgroundColor: "#15324a",
      gridColor: "#4c7188",
    },
    publicImage: {
      id: "art_harbor",
      alt: "Moonlit harbor",
      color: "#245b78",
      accentColor: "#e7c76f",
    },
    markers: [
      marker("marker_gate", "Harbor gate", 22, 64, "#f6d365", 0),
      marker("marker_inn", "Lantern inn", 57, 40, "#8ee3ef", 50),
      marker("marker_ship", "Moored ship", 78, 72, "#f29e74", 100),
    ],
    privateNote: PRIVATE_STRING_CANARIES[0],
    hiddenMonsterId: PRIVATE_IDENTITIES[0],
    privateMechanics: PRIVATE_STRING_CANARIES[3],
    privatePath: PRIVATE_STRING_CANARIES[2],
    privateAsset: { id: PRIVATE_IDENTITIES[2], raster: RASTER_CANARY },
  }),
  scene_b: Object.freeze({
    sceneId: "scene_b",
    publicMap: {
      label: "Old observatory",
      backgroundColor: "#35294d",
      gridColor: "#75638e",
    },
    publicImage: {
      id: "art_observatory",
      alt: "Silent observatory",
      color: "#594278",
      accentColor: "#bde0fe",
    },
    markers: [
      marker("marker_stairs", "Stone stair", 31, 66, "#bde0fe", 0),
      marker("marker_dome", "Copper dome", 65, 31, "#ffafcc", 50),
      marker("marker_telescope", "Old telescope", 74, 55, "#cdb4db", 100),
    ],
    privateNote: PRIVATE_STRING_CANARIES[1],
    hiddenMonsterId: PRIVATE_IDENTITIES[1],
    privateMechanics: "private-save-dc-23",
    privatePath: "/vault/scene-b/unknown-room.png",
    privateAsset: { id: PRIVATE_IDENTITIES[3], raster: RASTER_CANARY },
  }),
});

export function releasedFixture(sceneId, knowledgePercent) {
  const source = PRIVATE_SCENES[sceneId];
  if (!source) throw new Error("SCENE_NOT_FOUND");
  if (![0, 50, 100].includes(knowledgePercent))
    throw new Error("KNOWLEDGE_LEVEL_INVALID");
  return {
    map: structuredClone(source.publicMap),
    releasedMarkers: source.markers
      .filter((entry) => entry.knownAt <= knowledgePercent)
      .map(({ knownAt: _privateThreshold, ...entry }) =>
        structuredClone(entry),
      ),
    releasedImage: structuredClone(source.publicImage),
  };
}
