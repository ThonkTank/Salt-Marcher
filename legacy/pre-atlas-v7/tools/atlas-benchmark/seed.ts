import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { CampaignStore } from "../../src/app/storage/store";
import type { AtlasCommand } from "../../src/app/atlas/campaign-atlas-contracts";
import type { GroupRecipe } from '../../src/app/atlas/room-group-contracts';
import {
  SCENE_VERSION,
  anchors,
  buildings,
  landscape,
  territories,
} from "./scene";

/** Only canonical commands write fixture data. Caller owns the fresh database. */
export function seedBenchmark(
  store: CampaignStore,
  onProgress: (stage: string) => void = () => {},
) {
  const campaign = store.create("Atlas-Prüfwelt v1");
  const workspace = store.activate(campaign.id);
  const context = { token: workspace.token, campaignId: campaign.id };
  const write = (action: AtlasCommand["action"], commandId = randomUUID()) =>
    store.executeAtlasCommit({ ...context, commandId, action });
  const records = landscape(),
    regions = territories(),
    houses = buildings(36);
  const interiors = {
    village: {
      version: 1,
      profile: "Taverne",
      width: 16,
      depth: 18,
      seed: "atlas-benchmark-village",
    },
    dungeon: {
      version: 1,
      profile: "Krypta",
      width: 32,
      depth: 28,
      seed: "atlas-benchmark-dungeon",
    },
  } satisfies Record<string, GroupRecipe>;
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        version: SCENE_VERSION,
        anchors,
        records,
        regions,
        houses,
        interiors,
      }),
    )
    .digest("hex");
  onProgress("terrain");
  write({ kind: "landscape-sea-level", seaLevelM: 0 });
  const writable = records.filter((record) => !record.terrainSettings);
  // Bound each transaction; fixture setup time is never reported as interaction time.
  for (let offset = 0; offset < writable.length; offset += 16)
    write({
      kind: "landscape-batch",
      records: writable
        .slice(offset, offset + 16)
        .map((record) => ({ record, expectedRevision: null })),
    });
  onProgress("regions");
  write({
    kind: "territory-layer",
    expectedRevision: null,
    layer: {
      id: "bench:politics",
      revision: 0,
      name: "Prüfwelt",
      visible: true,
      order: 10,
      types: [
        { id: "realm", name: "Land", rank: 5 },
        { id: "region", name: "Region", rank: 4 },
        { id: "ward", name: "Viertel", rank: 1 },
      ],
    },
  });
  for (const territory of regions)
    write({ kind: "territory-put", territory, expectedRevision: null });
  onProgress("city");
  const cityId = write({
    kind: "city-create",
    name: "Silberhafen",
    ...anchors.city,
    width: 500,
    height: 400,
  }).result?.id;
  if (!cityId) throw Error("City creation returned no ID.");
  const commandId = randomUUID();
  write(
    {
      kind: "city",
      command: {
        ...context,
        commandId,
        cityId,
        expectedRevision: store.city(workspace.token, cityId).header.revision,
        action: {
          kind: "change",
          upsert: houses,
          remove: [],
          label: "Prüfwelt bebauen",
        },
      },
    },
    commandId,
  );
  onProgress("interiors");
  const villageId = write({
    kind: "group-generate",
    name: "Weidenfurter Taverne",
    ...anchors.village,
    recipe: interiors.village,
  }).result?.id;
  const dungeonId = write({
    kind: "group-generate",
    name: "Krypta am Silberlauf",
    ...anchors.dungeon,
    recipe: interiors.dungeon,
  }).result?.id;
  if (!villageId || !dungeonId)
    throw Error("Room-group creation returned no ID.");
  store.tutorial("skipped");
  return {
    version: SCENE_VERSION,
    fingerprintVersion: 2,
    recipeSha256: digest,
    interiors,
    campaignId: campaign.id,
    cityId,
    villageId,
    dungeonId,
    anchors,
    authored: {
      landscapeRecords: records.length,
      heightTiles: records.filter((r) => r.height).length,
      regions: regions.length,
      cityBuildings: houses.length,
    },
  };
}
