import {
  campaignId,
  campaignLocalId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
  identityType,
  ownerId,
  payloadDigest,
  referenceSchema,
  revisionToken,
  type CampaignDeliveryV1,
  type CampaignId,
  type CampaignIdRemapV1,
  type CampaignLocalId,
  type CampaignNamespace,
  type CampaignOwnerInventoryV1,
  type CampaignParticipantStageV1,
  type CampaignRemapPlanV1,
  type CampaignSnapshotV1,
} from "./campaign-contracts";

export interface CampaignRemapFactories {
  campaignId(): CampaignId;
  namespace(): CampaignNamespace;
  localId(ownerId: string, recordType: string, sourceId: CampaignLocalId): CampaignLocalId;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length)
    throw new Error(`Ungültige ${label}.`);
  return value;
}
function identityReferenceId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 200 || /\s/.test(value))
    throw new Error("Ungültige Referenz-ID.");
  return value;
}
function supportedSchemas(value: unknown): readonly string[] {
  const result = array(value, "Referenzschemas").map((schema) => referenceSchema(String(schema))).sort();
  if (!result.length || new Set(result).size !== result.length)
    throw new Error("Ungültige unterstützte Referenzschemas.");
  return Object.freeze(result);
}
function checkedInventory(value: CampaignOwnerInventoryV1): CampaignOwnerInventoryV1 {
  if (!value || typeof value !== "object" || value.version !== 1)
    throw new Error("Ungültiges Ownerinventar.");
  const schemas = supportedSchemas(value.referenceSchemas), records = array(value.records, "Ownerrecords").map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Ungültiger Ownerrecord.");
    const record = raw as CampaignOwnerInventoryV1["records"][number];
    return Object.freeze({
      id: campaignLocalId(String(record.id)),
      recordType: identityType(record.recordType),
      references: Object.freeze(array(record.references, "Recordreferenzen").map((referenceRaw) => {
        if (!referenceRaw || typeof referenceRaw !== "object")
          throw new Error("Ungültige Recordreferenz.");
        const reference = referenceRaw as typeof record.references[number];
        if (reference.scope !== "campaign-local" && reference.scope !== "shared")
          throw new Error("Unklassifizierte Recordreferenz.");
        const schema = referenceSchema(reference.schema);
        if (!schemas.includes(schema)) throw new Error("Nicht unterstütztes Referenzschema.");
        return Object.freeze({
          id: identityReferenceId(reference.id),
          scope: reference.scope,
          schema,
        });
      })),
    });
  });
  const payloadEvidence = array(value.payloadEvidence, "Payloadbelege").map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Ungültiger Payloadbeleg.");
    const evidence = raw as CampaignOwnerInventoryV1["payloadEvidence"][number];
    const schema = referenceSchema(evidence.referenceSchema);
    if (!schemas.includes(schema)) throw new Error("Nicht unterstütztes Referenzschema.");
    let media: { readonly metadataDigest: string; readonly byteDigest: string } | null = null;
    if (evidence.media !== null) {
      if (!evidence.media || typeof evidence.media !== "object")
        throw new Error("Ungültiger Medienbeleg.");
      media = Object.freeze({
        metadataDigest: payloadDigest(evidence.media.metadataDigest),
        byteDigest: payloadDigest(evidence.media.byteDigest),
      });
    }
    return Object.freeze({
      recordId: campaignLocalId(String(evidence.recordId)),
      digest: payloadDigest(evidence.digest),
      referenceSchema: schema,
      media,
    });
  });
  if (!Number.isSafeInteger(value.recordCount) || value.recordCount < 0 || value.recordCount !== records.length)
    throw new Error("Ownerinventar ist nicht vollständig.");
  if ((records.length === 0) !== value.emptyConfirmed)
    throw new Error("Owner-Leerzustand ist nicht bestätigt.");
  if (value.availability !== "confirmed")
    throw new Error("Ownerinventar ist nicht verfügbar.");
  return Object.freeze({
    version: 1,
    sourceCampaignId: campaignId(String(value.sourceCampaignId)),
    ownerId: ownerId(value.ownerId),
    ownerRevision: revisionToken(value.ownerRevision, "Ownerrevision"),
    schemaRevision: revisionToken(value.schemaRevision, "Schemarevision"),
    snapshotRevision: revisionToken(value.snapshotRevision, "Snapshotrevision"),
    referenceSchemas: schemas,
    availability: "confirmed",
    emptyConfirmed: value.emptyConfirmed,
    recordCount: value.recordCount,
    records: Object.freeze(records),
    payloadEvidence: Object.freeze(payloadEvidence),
  });
}

export function stageCampaignRemap(
  sourceRaw: CampaignSnapshotV1,
  delivery: CampaignDeliveryV1,
  targetName: string,
  factories: CampaignRemapFactories,
): CampaignParticipantStageV1 {
  const source = campaignSnapshot(sourceRaw);
  if (!delivery || typeof delivery !== "object" || delivery.version !== 1)
    throw new Error("Ungültige Campaign-Lieferung.");
  if (campaignId(String(delivery.sourceCampaignId)) !== source.campaignId ||
      campaignNamespace(String(delivery.sourceNamespace)) !== source.namespace)
    throw new Error("Campaign-Lieferung gehört zu einer anderen Quelle.");
  const expected = array(delivery.expectedOwners, "Ownerliste"),
    inventories = array(delivery.inventories, "Ownerinventare").map((value) =>
      checkedInventory(value as CampaignOwnerInventoryV1));
  if (!expected.length) throw new Error("Campaign-Lieferung hat keine Owner.");
  const expectedById = new Map<string, {
    ownerRevision: string;
    schemaRevision: string;
    snapshotRevision: string;
    referenceSchemas: readonly string[];
  }>();
  for (const raw of expected) {
    if (!raw || typeof raw !== "object") throw new Error("Ungültiger erwarteter Owner.");
    const value = raw as CampaignDeliveryV1["expectedOwners"][number], id = ownerId(value.ownerId);
    if (expectedById.has(id)) throw new Error("Doppelter erwarteter Owner.");
    expectedById.set(id, {
      ownerRevision: revisionToken(value.ownerRevision, "Ownerrevision"),
      schemaRevision: revisionToken(value.schemaRevision, "Schemarevision"),
      snapshotRevision: revisionToken(value.snapshotRevision, "Snapshotrevision"),
      referenceSchemas: supportedSchemas(value.referenceSchemas),
    });
  }
  const inventoryById = new Map<string, CampaignOwnerInventoryV1>();
  for (const inventory of inventories) {
    if (inventory.sourceCampaignId !== source.campaignId || inventoryById.has(inventory.ownerId))
      throw new Error("Fremdes oder doppeltes Ownerinventar.");
    inventoryById.set(inventory.ownerId, inventory);
  }
  if (inventoryById.size !== expectedById.size)
    throw new Error("Ownerabdeckung ist unvollständig.");
  for (const [id, revisions] of expectedById) {
    const inventory = inventoryById.get(id);
    if (!inventory) throw new Error("Ownerabdeckung ist unvollständig.");
    if (inventory.ownerRevision !== revisions.ownerRevision ||
        inventory.schemaRevision !== revisions.schemaRevision ||
        inventory.snapshotRevision !== revisions.snapshotRevision ||
        JSON.stringify(inventory.referenceSchemas) !== JSON.stringify(revisions.referenceSchemas))
      throw new Error("Ownerinventar ist stale.");
  }

  const records = new Map<string, { owner: string; type: string }>(),
    scopes = new Map<string, "campaign-local" | "shared">(),
    shared = new Set<string>();
  for (const inventory of inventories) {
    const evidence = new Map<string, CampaignOwnerInventoryV1["payloadEvidence"][number]>();
    for (const item of inventory.payloadEvidence) {
      if (evidence.has(item.recordId)) throw new Error("Doppelter Payloadbeleg.");
      evidence.set(item.recordId, item);
    }
    if (evidence.size !== inventory.records.length)
      throw new Error("Payloadabdeckung ist unvollständig.");
    for (const record of inventory.records) {
      if (records.has(record.id) || scopes.get(record.id) === "shared")
        throw new Error("Doppelte oder kollidierende lokale Identität.");
      if (!evidence.has(record.id)) throw new Error("Payloadbeleg fehlt.");
      const recordEvidence = evidence.get(record.id)!;
      if ((record.recordType === "audio-source") !== (recordEvidence.media !== null))
        throw new Error("AudioSource-Metadaten- oder Bytebeleg fehlt oder ist fremd.");
      records.set(record.id, { owner: inventory.ownerId, type: record.recordType });
      scopes.set(record.id, "campaign-local");
    }
  }
  for (const inventory of inventories)
    for (const record of inventory.records)
      for (const reference of record.references) {
        const known = scopes.get(reference.id);
        if (known && known !== reference.scope)
          throw new Error("Shared-/Local-Identität kollidiert.");
        if (reference.scope === "campaign-local") {
          if (!records.has(reference.id)) throw new Error("Lokale Referenz hängt frei.");
          scopes.set(reference.id, "campaign-local");
        } else {
          scopes.set(reference.id, "shared");
          shared.add(reference.id);
        }
      }

  const targetCampaignId = campaignId(String(factories.campaignId())),
    targetNamespace = campaignNamespace(String(factories.namespace())),
    usedTargets = new Set<string>([targetCampaignId, targetNamespace]),
    forbiddenTargets = new Set<string>([source.campaignId, source.namespace, ...records.keys(), ...shared]);
  if (targetCampaignId === source.campaignId || targetNamespace === source.namespace ||
      String(targetCampaignId) === String(targetNamespace) || forbiddenTargets.has(targetCampaignId) ||
      forbiddenTargets.has(targetNamespace))
    throw new Error("Zielidentität ist nicht unabhängig.");
  const closure: CampaignIdRemapV1[] = [
    Object.freeze({ entityType: "campaign", sourceId: source.campaignId, targetId: targetCampaignId }),
    Object.freeze({ entityType: "namespace", sourceId: source.namespace, targetId: targetNamespace }),
  ];
  for (const [sourceId, record] of records) {
    const targetId = campaignLocalId(String(factories.localId(record.owner, record.type, campaignLocalId(sourceId))));
    if (usedTargets.has(targetId) || forbiddenTargets.has(targetId))
      throw new Error("Remap-Fabrik erzeugt keine eindeutigen IDs.");
    usedTargets.add(targetId);
    closure.push(Object.freeze({ entityType: record.type, sourceId, targetId }));
  }
  const plan: CampaignRemapPlanV1 = Object.freeze({
    version: 1,
    sourceCampaignId: source.campaignId,
    targetCampaignId,
    sourceNamespace: source.namespace,
    targetNamespace,
    ownerIds: Object.freeze([...expectedById.keys()].sort()),
    closure: Object.freeze(closure),
    sharedReferences: Object.freeze([...shared].sort()),
  });
  const snapshot = campaignSnapshot({
    schemaVersion: 1,
    campaignId: targetCampaignId,
    revision: campaignRevision(1),
    name: targetName,
    namespace: targetNamespace,
    lifecycle: "active",
  });
  return Object.freeze({ version: 1, ownerId: "campaign-data", plan, snapshot, visible: false });
}
